/*
 * components/orders/PrescribeForm.tsx: the prescription form, one block per
 * drug, then send.
 *
 * Why: request 123 (2026-10-31): "It's a hospital, so the doctor
 * prescribes." Request 227d (Anthony, 2026-11-18): the same prescription
 * inside the consultation, "the same thing, but different routes... a bit
 * different road now that leads to the same place." So the Prescribe page
 * and the consultation both show this one form.
 *
 * How it goes:
 *   1. One block per drug: name and strength, dose, how often, how many
 *      days, quantity, a price (request 235: the doctor sets it, filled in
 *      from their last price for that drug), a note. "Add another drug" adds
 *      a block. The total shows as prices are typed.
 *   2. Send to the Front Desk and the Pharmacy (the default), or to the
 *      Front Desk only: the Pharmacy gets it once it is paid (request 233).
 *   3. Sent: what happened; Front Desk only offers "Also send to Pharmacy".
 *   4. A drug already prescribed for this patient and not given yet: a
 *      warning first, with Send anyway or Cancel (request 251).
 *
 * Never: let anybody but a doctor send it. The database refuses it too.
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import SameWarning from '@/components/warnings/SameWarning'
import { sameDrugsOpen, sameDrugsWords, type Earlier } from '@/lib/orders/duplicates'
import MedicinePicker from '@/components/medicines/MedicinePicker'
import OptionSelect from '@/components/options/OptionSelect'
import styles from './orders.module.css'
import { knownMedicines } from '@/lib/medicines/medicines'
import type { PatientResult } from '@/lib/patients/patients'
import { prescribe, sendAlso, type PrescriptionItem } from '@/lib/pharmacy/pharmacy'
import { useDraft } from '@/lib/drafts/drafts'
import { naira } from '@/lib/lab/lab'
import {
  amountWrong,
  loadMyPrices,
  loadPrices,
  myPriceOf,
  priceKey,
  readAmount,
  type MyPrice,
  type Price,
} from '@/lib/prices/prices'
import MakeStandard, { type Candidate } from './MakeStandard'
import DraftBack from '@/components/drafts/DraftBack'
import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import { countWrong } from '@/lib/forms/wrong'

// The Front Desk and the Pharmacy at once (the default), or the Front Desk
// only: the Pharmacy then gets it once it is paid. Never straight to the
// Pharmacy (request 233, 2026-11-20: "There's no time you will send... straight
// to pharmacy without it sending to front desk").
type SendTo = 'both' | 'front_desk'

// ===== 1. What the doctor types for one drug, kept as text until sent =====
type Draft = {
  // A number that stays with this drug, so removing one block never mixes up
  // what was typed in the others.
  key: number
  drug: string
  strength: string
  dose: string
  how_often: string
  days: string
  quantity: string
  note: string
  // The price in naira, set by the doctor (request 235); empty: the Front
  // Desk prices it. Older drafts have none.
  price?: string
}

const EMPTY: Omit<Draft, 'key'> = {
  drug: '',
  strength: '',
  dose: '',
  how_often: '',
  days: '',
  quantity: '',
  note: '',
  price: '',
}

export default function PrescribeForm({
  client,
  staffId,
  patient,
  inConsultation = false,
  onClose,
}: {
  client: SupabaseClient
  staffId: string
  patient: Pick<PatientResult, 'id' | 'full_name'>
  // Inside the consultation: no "Back to the record" (the doctor is still
  // on it), and a way to close the form and write another.
  inConsultation?: boolean
  onClose?: () => void
}) {
  const [drafts, setDrafts] = useState<Draft[]>([{ ...EMPTY, key: 0 }])
  const [nextKey, setNextKey] = useState(1)
  const [note, setNote] = useState('')
  const [sendTo, setSendTo] = useState<SendTo>('both')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  // A drug already prescribed and not given yet (request 251): the warning
  // shows instead of the Send button until Send anyway or Cancel. It
  // belongs to the drugs it was found for; other drugs, no warning.
  const [same, setSame] = useState<{ earlier: Earlier[]; forDrugs: string } | null>(null)
  // "Send also to" the other place, after sending (request 130c).
  const [alsoBusy, setAlsoBusy] = useState(false)
  const [alsoSent, setAlsoSent] = useState(false)
  const [alsoProblem, setAlsoProblem] = useState<string | null>(null)

  // The unsaved prescription, kept 30 minutes on this device (227j).
  const draft = useDraft({
    staffId,
    name: `rx-${patient.id}`,
    value: { drafts, note, sendTo },
    isEmpty: (typed) => !typed.note.trim() && typed.drafts.every((one) => !one.drug.trim()),
    restore: (typed) => {
      setDrafts(typed.drafts)
      setNextKey(Math.max(0, ...typed.drafts.map((one) => one.key)) + 1)
      setNote(typed.note)
      // A draft from before 2026-11-20 may say 'pharmacy': now both.
      setSendTo(typed.sendTo === 'front_desk' ? 'front_desk' : 'both')
    },
  })

  // The standard price of each drug, else this doctor's last price, to fill
  // in (requests 235 and 236).
  const [mine, setMine] = useState<MyPrice[]>([])
  const [standard, setStandard] = useState<Price[]>([])
  useEffect(() => {
    let current = true
    void Promise.all([loadMyPrices(client), loadPrices(client)]).then(([own, list]) => {
      if (!current) return
      setMine(own)
      setStandard(list ?? [])
    })
    return () => {
      current = false
    }
  }, [client])
  const standardOf = (drug: string, strength: string) =>
    standard.find(
      (price) => price.kind === 'drug' && price.item.toLowerCase() === priceKey(drug, strength),
    )?.amount
  const fillPrice = (drug: string, strength: string) =>
    standardOf(drug, strength) ?? myPriceOf(mine, 'drug', priceKey(drug, strength))
  // After sending: the prices to offer as standard (request 236).
  const [toStandard, setToStandard] = useState<Candidate[]>([])

  // ===== 2. Changing one drug =====
  // A new drug or strength fills in this doctor's last price for it, when
  // the price box is still empty (it can be cleared and typed again).
  function change(index: number, part: keyof Draft, value: string) {
    setDrafts((all) =>
      all.map((draft, at) => {
        if (at !== index) return draft
        const next = { ...draft, [part]: value }
        if ((part === 'drug' || part === 'strength') && !(draft.price ?? '').trim()) {
          const last = fillPrice(next.drug, next.strength)
          if (last) next.price = String(last)
        }
        return next
      }),
    )
  }
  // The total of the prices typed, shown as they are typed (request 235).
  const total = drafts.reduce((sum, draft) => sum + (readAmount(draft.price ?? '') ?? 0), 0)

  // A medicine the Pharmacy counts needs a quantity (request 214); the others
  // do not.
  const counted = (draft: Draft) =>
    knownMedicines(staffId).find(
      (line) =>
        line.name.toLowerCase() === draft.drug.trim().toLowerCase() &&
        (line.strength ?? '').toLowerCase() === draft.strength.trim().toLowerCase() &&
        line.in_stock !== null,
    )
  const needsQuantity = (draft: Draft) => Boolean(counted(draft)) && !/^\s*\d/.test(draft.quantity)
  const ready = drafts.every((draft) => draft.drug.trim().length >= 2 && !needsQuantity(draft))

  // ===== 3. Send =====
  // The drugs on the form now, and one line naming them, so a warning found
  // for other drugs is not shown (request 251).
  const drugsNow = () =>
    drafts
      .filter((draft) => draft.drug.trim())
      .map((draft) => ({ drug: draft.drug.trim(), strength: draft.strength.trim() || null }))
  const drugsKey = () =>
    drugsNow()
      .map((one) => `${one.drug}/${one.strength ?? ''}`)
      .join('|')
  const warning = same && same.forDrugs === drugsKey() ? same.earlier : null

  // anyway: true after the person saw the warning and chose Send anyway.
  async function send(anyway = false) {
    // A price, when typed, must read as naira (request 235).
    if (
      drafts.some((draft) => (draft.price ?? '').trim() && readAmount(draft.price ?? '') === null)
    ) {
      setError('Type each price in naira, like 2,500, or leave it empty.')
      return
    }
    setBusy(true)
    setError(null)
    // ===== 3a. Already prescribed and not given? Warn first (request 251) =====
    if (!anyway) {
      const earlier = await sameDrugsOpen(client, patient.id, drugsNow())
      if (earlier.length > 0) {
        setBusy(false)
        setSame({ earlier, forDrugs: drugsKey() })
        return
      }
    }
    setSame(null)
    const items: PrescriptionItem[] = drafts.map((draft) => ({
      drug: draft.drug.trim(),
      strength: draft.strength.trim() || null,
      dose: draft.dose.trim() || null,
      how_often: draft.how_often.trim() || null,
      days: Number(draft.days) > 0 ? Math.min(365, Math.round(Number(draft.days))) : null,
      quantity: draft.quantity.trim() || null,
      note: draft.note.trim() || null,
      price: readAmount(draft.price ?? ''),
    }))
    // Always to the Front Desk for payment; then to the Pharmacy too, if asked.
    const problem = await prescribe(client, patient.id, items, note, 'front_desk')
    if (problem) {
      setBusy(false)
      setError(problem)
      return
    }
    // Front Desk and Pharmacy at the same time (Anthony, 2026-11-09:
    // "pharmacy request too, simultaneously send to pharmacy and front desk
    // for payment"): the pharmacy sees it at once while the Front Desk
    // takes the payment.
    if (sendTo === 'both') {
      const also = await sendAlso(client, patient.id, staffId)
      if (also) setAlsoProblem(also)
      else setAlsoSent(true)
    }
    setBusy(false)
    // Prices that are new, or not the standard: offer them as standard (236).
    setToStandard(
      drafts.flatMap((one) => {
        const amount = readAmount(one.price ?? '')
        if (!amount || !one.drug.trim()) return []
        const now = standardOf(one.drug, one.strength)
        if (now === amount) return []
        const item = [one.drug.trim(), one.strength.trim()].filter(Boolean).join(' ')
        return [{ kind: 'drug' as const, item, amount, now }]
      }),
    )
    setSent(true)
    draft.clear()
  }

  // ===== 4. Sent =====
  if (sent)
    return (
      <div className={styles.card}>
        <p className={styles.good}>
          {sendTo === 'both' || alsoSent
            ? 'Sent to the Front Desk for payment and to the Pharmacy.'
            : 'Sent to the Front Desk for payment. The Pharmacy gets it once it is paid.'}
        </p>
        <p className={styles.muted}>
          Once dispensed, the drugs join {patient.full_name}&apos;s current medications.
        </p>
        {alsoProblem ? <p className={styles.error}>{alsoProblem}</p> : null}
        <MakeStandard client={client} candidates={toStandard} />
        <div className={styles.buttons}>
          {inConsultation ? (
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={onClose}
            >
              Done
            </button>
          ) : (
            <Link
              className={`${styles.button} ${styles.primary}`}
              href={`/patients/record/?p=${patient.id}`}
            >
              Back to the record
            </Link>
          )}
          {/* Front Desk only: the Pharmacy can still be sent it now. */}
          {!alsoSent ? (
            <button
              className={`${styles.button} ${styles.soft}`}
              disabled={alsoBusy}
              onClick={async () => {
                setAlsoBusy(true)
                setAlsoProblem(null)
                const problem = await sendAlso(client, patient.id, staffId)
                setAlsoBusy(false)
                if (problem) setAlsoProblem(problem)
                else setAlsoSent(true)
              }}
            >
              Also send to Pharmacy
            </button>
          ) : null}
        </div>
      </div>
    )

  // ===== 5. The form =====
  return (
    <>
      {draft.restoredAt ? (
        <DraftBack
          savedAt={draft.restoredAt}
          what="prescription"
          onContinue={draft.keep}
          onDiscard={() => {
            setDrafts([{ ...EMPTY, key: nextKey }])
            setNextKey(nextKey + 1)
            setNote('')
            draft.clear()
          }}
        />
      ) : null}
      {/* ----- One block per drug ----- */}
      {drafts.map((draft, index) => (
        <div key={draft.key} className={styles.drug}>
          <div className={styles.drugTop}>
            <b>Drug {index + 1}</b>
            {drafts.length > 1 ? (
              <button
                className={`${styles.button} ${styles.small}`}
                onClick={() => setDrafts((all) => all.filter((_, at) => at !== index))}
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className={styles.grid}>
            <div className={styles.wide}>
              <label className={styles.label} htmlFor={`drug-${index}`}>
                Drug and strength
              </label>
              <MedicinePicker
                client={client}
                staffId={staffId}
                id={`drug-${index}`}
                name={draft.drug}
                strength={draft.strength}
                onChange={(name, picked) =>
                  setDrafts((all) =>
                    all.map((one, at) => {
                      if (at !== index) return one
                      const next = { ...one, drug: name, strength: picked }
                      // This doctor's last price for it, if the box is empty (235).
                      const last = fillPrice(name, picked)
                      if (last && !(one.price ?? '').trim()) next.price = String(last)
                      return next
                    }),
                  )
                }
              />
            </div>
            <div>
              <label className={styles.label} htmlFor={`dose-${index}`}>
                Dose
              </label>
              <OptionSelect
                client={client}
                staffId={staffId}
                list="dose"
                id={`dose-${index}`}
                value={draft.dose}
                onChange={(value) => change(index, 'dose', value)}
                placeholder="Choose the dose"
                otherLabel="Type the dose"
              />
            </div>
            <div className={styles.wide}>
              <label className={styles.label} htmlFor={`often-${index}`}>
                How often
              </label>
              <OptionSelect
                client={client}
                staffId={staffId}
                list="frequency"
                id={`often-${index}`}
                value={draft.how_often}
                onChange={(value) => change(index, 'how_often', value)}
                placeholder="Choose how often"
                otherLabel="Type how often"
              />
            </div>
            <div>
              <label className={styles.label} htmlFor={`days-${index}`}>
                For how many days
              </label>
              <input
                id={`days-${index}`}
                className={styles.input}
                inputMode="numeric"
                placeholder="5"
                aria-invalid={countWrong(draft.days, 1, 365) ? 'true' : undefined}
                value={draft.days}
                onChange={(event) =>
                  change(index, 'days', event.target.value.replace(/\D/g, '').slice(0, 3))
                }
              />
            </div>
            <div>
              <label className={styles.label} htmlFor={`quantity-${index}`}>
                Quantity
              </label>
              <input
                id={`quantity-${index}`}
                className={styles.input}
                placeholder={
                  counted(draft)?.unit ? `e.g. 30 ${counted(draft)?.unit}s` : '30 tablets'
                }
                maxLength={60}
                value={draft.quantity}
                onChange={(event) => change(index, 'quantity', event.target.value)}
              />
              {needsQuantity(draft) ? (
                <small className={styles.error}>
                  The Pharmacy counts this medicine: start with how many.
                </small>
              ) : null}
            </div>
            {/* The doctor's price (request 235): the Front Desk collects it. */}
            <div>
              <label className={styles.label} htmlFor={`price-${index}`}>
                Price ₦ (optional)
              </label>
              <input
                id={`price-${index}`}
                className={styles.input}
                inputMode="decimal"
                placeholder="e.g. 2,500"
                aria-invalid={amountWrong(draft.price) ? 'true' : undefined}
                value={draft.price ?? ''}
                onChange={(event) =>
                  change(index, 'price', event.target.value.replace(/[^\d.,\s]/g, ''))
                }
              />
              {amountWrong(draft.price) ? (
                <small className={styles.error}>Not an amount. Type it in naira, like 2,500.</small>
              ) : null}
            </div>
            <div className={styles.wide}>
              <label className={styles.label} htmlFor={`note-${index}`}>
                Note for this drug (optional)
              </label>
              <input
                id={`note-${index}`}
                className={styles.input}
                placeholder="After food"
                maxLength={300}
                value={draft.note}
                onChange={(event) => change(index, 'note', event.target.value)}
              />
            </div>
          </div>
        </div>
      ))}
      <button
        className={styles.button}
        onClick={() => {
          setDrafts((all) => [...all, { ...EMPTY, key: nextKey }])
          setNextKey(nextKey + 1)
        }}
        disabled={drafts.length >= 20}
      >
        Add another drug
      </button>
      {/* The total, worked out as prices are typed (request 235). */}
      {total > 0 ? (
        <p className={styles.total}>
          Total <b>{naira(total)}</b>
        </p>
      ) : null}

      {/* ----- A note, and where it goes ----- */}
      <div>
        <label className={styles.label} htmlFor="rx-note">
          Note for the pharmacy (optional)
        </label>
        <textarea
          id="rx-note"
          className={styles.input}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div>
        <span className={styles.label}>Send to</span>
        <div className={styles.segments} role="group" aria-label="Send to">
          <button aria-pressed={sendTo === 'both'} onClick={() => setSendTo('both')}>
            Front Desk and Pharmacy
          </button>
          <button aria-pressed={sendTo === 'front_desk'} onClick={() => setSendTo('front_desk')}>
            Front Desk only
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {warning ? (
        <SameWarning
          words={sameDrugsWords(warning)}
          goLabel="Send anyway"
          busy={busy}
          onGo={() => void send(true)}
          // Cancel keeps the form as it is.
          onCancel={() => setSame(null)}
        />
      ) : (
        <button
          className={`${styles.button} ${styles.primary}`}
          onClick={() => void send()}
          disabled={!ready || busy}
        >
          {busy ? 'Sending…' : 'Send prescription'}
        </button>
      )}
    </>
  )
}
