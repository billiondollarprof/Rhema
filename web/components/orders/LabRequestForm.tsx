/*
 * components/orders/LabRequestForm.tsx: the lab request form: tap the
 * common tests or find any other, a note, then send.
 *
 * Why: request 115 (the demo's "Request lab test") and 196a (search or
 * browse every test). Request 227d (Anthony, 2026-11-18): the same request
 * inside the consultation, "the request lab button behaves the same way as
 * the prescription button." So the Request lab page and the consultation
 * both show this one form.
 *
 * How it goes:
 *   1. Tap the common tests, or "Add a test" to find any other.
 *   2. A doctor or the matron sets a price for each test (request 235),
 *      filled in from their last price, or else the price list; the total
 *      shows. A note for the lab, if needed.
 *   3. Send to the Front Desk and the Lab (the default), or to the Front
 *      Desk only: the Lab gets it once it is paid (request 233).
 *   4. A test already asked for this patient and not done yet: a warning
 *      first, with Send anyway or Cancel (request 251).
 *
 * Never: let somebody without medical record access send a request. The
 * database refuses it too.
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import TestSearch from './TestSearch'
import styles from './orders.module.css'
import { COMMON_TESTS, naira, requestLab } from '@/lib/lab/lab'
import SameWarning from '@/components/warnings/SameWarning'
import { sameTestsOpen, sameTestsWords, type Earlier } from '@/lib/orders/duplicates'
import { useAuth } from '@/lib/auth/session'
import { setsPrices as canSetPrices } from '@/lib/auth/roles'
import {
  amountWrong,
  loadMyPrices,
  loadPrices,
  myPriceOf,
  priceKey,
  priceOf,
  readAmount,
  type MyPrice,
  type Price,
} from '@/lib/prices/prices'
import MakeStandard, { type Candidate } from './MakeStandard'
import { useDraft } from '@/lib/drafts/drafts'
import DraftBack from '@/components/drafts/DraftBack'
import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import type { PatientResult } from '@/lib/patients/patients'

// The Front Desk and the Lab at once (the default), or the Front Desk only:
// the Lab then gets it once it is paid (request 233, 2026-11-20).
type SendTo = 'both' | 'front_desk'

export default function LabRequestForm({
  client,
  staffId,
  patient,
  inConsultation = false,
  onClose,
}: {
  client: SupabaseClient
  staffId: string
  patient: Pick<PatientResult, 'id' | 'full_name'>
  // Inside the consultation: "Done" closes the form instead of leaving.
  inConsultation?: boolean
  onClose?: () => void
}) {
  const [tests, setTests] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [sendTo, setSendTo] = useState<SendTo>('both')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  // The same tests already asked for and not done yet (request 251): the
  // warning shows instead of the Send button until Send anyway or Cancel.
  // It belongs to the tests it was found for; other tests, no warning.
  const [same, setSame] = useState<{ earlier: Earlier[]; forTests: string } | null>(null)
  const warning = same && same.forTests === tests.join('|') ? same.earlier : null
  // ===== 0. Prices (request 235): a doctor or the matron sets one per test,
  // filled in from their own last price, or else the price list. =====
  const { staff } = useAuth()
  const setsPrices = staff ? canSetPrices(staff) : false
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [mine, setMine] = useState<MyPrice[]>([])
  const [list, setList] = useState<Price[]>([])
  useEffect(() => {
    if (!setsPrices) return
    let current = true
    void Promise.all([loadMyPrices(client), loadPrices(client)]).then(([own, standard]) => {
      if (!current) return
      setMine(own)
      setList(standard ?? [])
    })
    return () => {
      current = false
    }
  }, [client, setsPrices])
  // The standard price first, else this person's last price (236).
  const priceFor = (test: string) =>
    prices[test] ??
    String(priceOf(list, 'lab_test', test) ?? myPriceOf(mine, 'lab_test', priceKey(test)) ?? '')
  // After sending: the prices to offer as standard (request 236).
  const [toStandard, setToStandard] = useState<Candidate[]>([])
  const total = tests.reduce((sum, test) => sum + (readAmount(priceFor(test)) ?? 0), 0)

  // The unsaved request, kept 30 minutes on this device (227j).
  const draft = useDraft({
    staffId,
    name: `lab-${patient.id}`,
    value: { tests, note, sendTo },
    isEmpty: (typed) => typed.tests.length === 0 && !typed.note.trim(),
    restore: (typed) => {
      setTests(typed.tests)
      setNote(typed.note)
      // A draft from before 2026-11-20 may say 'laboratory': now both.
      setSendTo(typed.sendTo === 'front_desk' ? 'front_desk' : 'both')
    },
  })

  // ===== 1. Choosing tests =====
  function toggle(test: string) {
    setTests((chosen) =>
      chosen.includes(test) ? chosen.filter((item) => item !== test) : [...chosen, test],
    )
  }

  // ===== 2. Send =====
  // anyway: true after the person saw the warning and chose Send anyway.
  async function send(anyway = false) {
    const priced: Record<string, number> = {}
    if (setsPrices) {
      for (const test of tests) {
        const typed = priceFor(test).trim()
        if (!typed) continue
        const amount = readAmount(typed)
        if (amount === null) {
          setError('Type each price in naira, like 3,000, or leave it empty.')
          return
        }
        priced[test] = amount
      }
    }
    setBusy(true)
    setError(null)
    // ===== 2a. Already asked for? Warn first (request 251) =====
    if (!anyway) {
      const earlier = await sameTestsOpen(client, patient.id, tests)
      if (earlier.length > 0) {
        setBusy(false)
        setSame({ earlier, forTests: tests.join('|') })
        return
      }
    }
    setSame(null)
    const problem = await requestLab(client, patient.id, tests, note, sendTo, priced)
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    draft.clear()
    // Prices that are new, or not the standard: offer them as standard (236).
    setToStandard(
      Object.entries(priced).flatMap(([test, amount]) => {
        const now = priceOf(list, 'lab_test', test)
        return now === amount ? [] : [{ kind: 'lab_test' as const, item: test, amount, now }]
      }),
    )
    setSent(
      sendTo === 'both'
        ? `Sent to the Lab, and to the Front Desk for payment: ${tests.join(', ')}.`
        : `Sent to the Front Desk for payment: ${tests.join(', ')}. The Lab gets it once it is paid.`,
    )
  }

  const custom = tests.filter((test) => !COMMON_TESTS.includes(test))

  // ===== 3. Sent =====
  if (sent)
    return (
      <>
        <p className={styles.good}>{sent}</p>
        <MakeStandard client={client} candidates={toStandard} />
        <p className={styles.muted}>
          You will be told when the result is ready. It goes straight into {patient.full_name}
          &apos;s record.
        </p>
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
            <>
              <Link
                className={`${styles.button} ${styles.primary}`}
                href={`/patients/record/?p=${patient.id}`}
              >
                Open the record
              </Link>
              <Link className={styles.button} href="/">
                Home
              </Link>
            </>
          )}
        </div>
      </>
    )

  // ===== 4. The form =====
  return (
    <>
      {draft.restoredAt ? (
        <DraftBack
          savedAt={draft.restoredAt}
          what="lab request"
          onContinue={draft.keep}
          onDiscard={() => {
            setTests([])
            setNote('')
            draft.clear()
          }}
        />
      ) : null}
      {/* ----- The tests ----- */}
      <div>
        <span className={styles.label}>Common tests</span>
        <div className={styles.chips}>
          {[...COMMON_TESTS, ...custom].map((test) => (
            <button
              key={test}
              type="button"
              className={styles.chip}
              aria-pressed={tests.includes(test)}
              onClick={() => toggle(test)}
            >
              {test}
            </button>
          ))}
        </div>
      </div>
      {/* ----- Every other test: search or browse (request 196a) ----- */}
      <TestSearch client={client} staffId={staffId} chosen={tests} onToggle={toggle} />

      {/* ----- The price of each test, for a doctor or the matron (235) ----- */}
      {setsPrices && tests.length > 0 ? (
        <div className={styles.prices}>
          <span className={styles.label}>Prices ₦ (optional)</span>
          {tests.map((test) => (
            <div key={test} className={styles.priceRow}>
              <label htmlFor={`lab-price-${test}`}>{test}</label>
              <input
                id={`lab-price-${test}`}
                className={styles.input}
                inputMode="decimal"
                placeholder="e.g. 3,000"
                aria-invalid={amountWrong(priceFor(test)) ? 'true' : undefined}
                value={priceFor(test)}
                onChange={(event) =>
                  setPrices({ ...prices, [test]: event.target.value.replace(/[^\d.,\s]/g, '') })
                }
              />
            </div>
          ))}
          {/* A wrong price shows red, and says what to type (request 252). */}
          {tests.some((test) => amountWrong(priceFor(test))) ? (
            <small className={styles.error}>
              The price in red is not an amount. Type it in naira, like 3,000.
            </small>
          ) : null}
          {total > 0 ? (
            <p className={styles.total}>
              Total <b>{naira(total)}</b>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ----- A note for the lab ----- */}
      <div>
        <label className={styles.label} htmlFor={inConsultation ? 'consult-lab-note' : 'lab-note'}>
          Note for the lab (optional)
        </label>
        <textarea
          id={inConsultation ? 'consult-lab-note' : 'lab-note'}
          className={styles.input}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {/* ----- Where it goes ----- */}
      <div>
        <span className={styles.label}>Send to</span>
        <div className={styles.segments} role="group" aria-label="Send to">
          <button type="button" aria-pressed={sendTo === 'both'} onClick={() => setSendTo('both')}>
            Front Desk and Lab
          </button>
          <button
            type="button"
            aria-pressed={sendTo === 'front_desk'}
            onClick={() => setSendTo('front_desk')}
          >
            Front Desk only
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {warning ? (
        <SameWarning
          words={sameTestsWords(warning)}
          goLabel="Send anyway"
          busy={busy}
          onGo={() => void send(true)}
          // Cancel keeps the form as it is.
          onCancel={() => setSame(null)}
        />
      ) : (
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={() => void send()}
            disabled={tests.length === 0 || busy}
          >
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </div>
      )}
    </>
  )
}
