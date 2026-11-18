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
 *   2. A note for the lab, if needed.
 *   3. Send to the Lab and the Front Desk (payment), or straight to the Lab.
 *
 * Never: let somebody without medical record access send a request. The
 * database refuses it too.
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import TestSearch from './TestSearch'
import styles from './orders.module.css'
import { COMMON_TESTS, requestLab } from '@/lib/lab/lab'
import { draftWords, useDraft } from '@/lib/drafts/drafts'
import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import type { PatientResult } from '@/lib/patients/patients'

type SendTo = 'front_desk' | 'laboratory'

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
  const [sendTo, setSendTo] = useState<SendTo>('front_desk')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  // The unsaved request, kept 30 minutes on this device (227j).
  const draft = useDraft({
    staffId,
    name: `lab-${patient.id}`,
    value: { tests, note, sendTo },
    isEmpty: (typed) => typed.tests.length === 0 && !typed.note.trim(),
    restore: (typed) => {
      setTests(typed.tests)
      setNote(typed.note)
      setSendTo(typed.sendTo)
    },
  })

  // ===== 1. Choosing tests =====
  function toggle(test: string) {
    setTests((chosen) =>
      chosen.includes(test) ? chosen.filter((item) => item !== test) : [...chosen, test],
    )
  }

  // ===== 2. Send =====
  async function send() {
    setBusy(true)
    setError(null)
    const problem = await requestLab(client, patient.id, tests, note, sendTo)
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    draft.clear()
    setSent(
      sendTo === 'front_desk'
        ? `Sent to the Lab, and to the Front Desk for payment: ${tests.join(', ')}.`
        : `Sent to the Laboratory: ${tests.join(', ')}.`,
    )
  }

  const custom = tests.filter((test) => !COMMON_TESTS.includes(test))

  // ===== 3. Sent =====
  if (sent)
    return (
      <>
        <p className={styles.good}>{sent}</p>
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
        <p className={styles.draftBack}>
          {draftWords(draft.restoredAt, HOSPITAL_TIME_ZONE)}{' '}
          <button
            type="button"
            className={`${styles.button} ${styles.small}`}
            onClick={() => {
              setTests([])
              setNote('')
              draft.clear()
            }}
          >
            Discard draft
          </button>
        </p>
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
          <button
            type="button"
            aria-pressed={sendTo === 'front_desk'}
            onClick={() => setSendTo('front_desk')}
          >
            Lab and Front Desk (payment)
          </button>
          <button
            type="button"
            aria-pressed={sendTo === 'laboratory'}
            onClick={() => setSendTo('laboratory')}
          >
            Straight to the lab
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={send}
          disabled={tests.length === 0 || busy}
        >
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </>
  )
}
