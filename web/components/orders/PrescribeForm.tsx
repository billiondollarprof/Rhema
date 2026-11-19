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
 *      days, quantity, a note. "Add another drug" adds a block.
 *   2. Send to the Pharmacy and the Front Desk (payment), or straight to
 *      the Pharmacy (for example, an admitted patient).
 *   3. Sent: what happened, and "Also send to" the other place.
 *
 * Never: let anybody but a doctor send it. The database refuses it too.
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import MedicinePicker from '@/components/medicines/MedicinePicker'
import OptionSelect from '@/components/options/OptionSelect'
import styles from './orders.module.css'
import { knownMedicines } from '@/lib/medicines/medicines'
import type { PatientResult } from '@/lib/patients/patients'
import { prescribe, sendAlso, type PrescriptionItem } from '@/lib/pharmacy/pharmacy'
import { useDraft } from '@/lib/drafts/drafts'
import DraftBack from '@/components/drafts/DraftBack'
import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'

type SendTo = 'front_desk' | 'pharmacy'

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
}

const EMPTY: Omit<Draft, 'key'> = {
  drug: '',
  strength: '',
  dose: '',
  how_often: '',
  days: '',
  quantity: '',
  note: '',
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
  const [sendTo, setSendTo] = useState<SendTo>('front_desk')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
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
      setSendTo(typed.sendTo)
    },
  })

  // ===== 2. Changing one drug =====
  function change(index: number, part: keyof Draft, value: string) {
    setDrafts((all) => all.map((draft, at) => (at === index ? { ...draft, [part]: value } : draft)))
  }

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
  async function send() {
    setBusy(true)
    setError(null)
    const items: PrescriptionItem[] = drafts.map((draft) => ({
      drug: draft.drug.trim(),
      strength: draft.strength.trim() || null,
      dose: draft.dose.trim() || null,
      how_often: draft.how_often.trim() || null,
      days: Number(draft.days) > 0 ? Math.min(365, Math.round(Number(draft.days))) : null,
      quantity: draft.quantity.trim() || null,
      note: draft.note.trim() || null,
    }))
    const problem = await prescribe(client, patient.id, items, note, sendTo)
    if (problem) {
      setBusy(false)
      setError(problem)
      return
    }
    // Front Desk and Pharmacy at the same time (Anthony, 2026-11-09:
    // "pharmacy request too, simultaneously send to pharmacy and front desk
    // for payment"): the pharmacy sees it at once while the Front Desk
    // takes the payment.
    if (sendTo === 'front_desk') {
      const also = await sendAlso(client, patient.id, staffId)
      if (also) setAlsoProblem(also)
      else setAlsoSent(true)
    }
    setBusy(false)
    setSent(true)
    draft.clear()
  }

  // ===== 4. Sent =====
  if (sent)
    return (
      <div className={styles.card}>
        <p className={styles.good}>
          {sendTo === 'front_desk'
            ? 'Sent to the Front Desk for payment and to the Pharmacy.'
            : 'Sent to the Pharmacy.'}
        </p>
        <p className={styles.muted}>
          Once dispensed, the drugs join {patient.full_name}&apos;s current medications.
        </p>
        {alsoSent && sendTo === 'pharmacy' ? (
          <p className={styles.good}>Also sent to the Front Desk.</p>
        ) : null}
        {alsoProblem ? <p className={styles.error}>{alsoProblem}</p> : null}
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
              {sendTo === 'front_desk' ? 'Also send to Pharmacy' : 'Also send to Front Desk'}
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
                    all.map((one, at) =>
                      at === index ? { ...one, drug: name, strength: picked } : one,
                    ),
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
          <button aria-pressed={sendTo === 'front_desk'} onClick={() => setSendTo('front_desk')}>
            Pharmacy and Front Desk (payment)
          </button>
          <button aria-pressed={sendTo === 'pharmacy'} onClick={() => setSendTo('pharmacy')}>
            Straight to the pharmacy
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      <button
        className={`${styles.button} ${styles.primary}`}
        onClick={send}
        disabled={!ready || busy}
      >
        {busy ? 'Sending…' : 'Send prescription'}
      </button>
    </>
  )
}
