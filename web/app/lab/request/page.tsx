/*
 * app/lab/request/page.tsx: Request lab.
 *
 * Why: the demo's "Request lab test" (request 115). A doctor, nurse or
 * matron picks the patient, taps the common tests or types another, and
 * sends it to the Front Desk for payment or straight to the Laboratory.
 * Opened from Home (no patient yet) or from the patient's record (?p=12).
 *
 * Never: let somebody without medical record access send a request. The
 * database refuses it too.
 */
'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PatientPicker from '../_parts/PatientPicker'
import styles from '../_parts/lab.module.css'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import { COMMON_TESTS, requestLab } from '@/lib/lab/lab'
import { getPatient, type PatientResult } from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

type SendTo = 'front_desk' | 'laboratory'

function RequestLab() {
  const auth = useAuth()
  useRightPage(auth.status, '/lab/request/')
  const params = useSearchParams()
  const givenId = Number(params.get('p')) || null
  const { client, staff } = auth

  const [patient, setPatient] = useState<PatientResult | null>(null)
  const [tests, setTests] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const [sendTo, setSendTo] = useState<SendTo>('front_desk')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  // ===== 1. The patient from the address, when opened from the record =====
  useEffect(() => {
    if (!client || !givenId || auth.status !== 'ready') return
    let current = true
    getPatient(client, givenId).then((found) => {
      if (current) setPatient(found)
    })
    return () => {
      current = false
    }
  }, [client, givenId, auth.status])

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 2. Choosing tests =====
  function toggle(test: string) {
    setTests((chosen) =>
      chosen.includes(test) ? chosen.filter((item) => item !== test) : [...chosen, test],
    )
  }

  function addTyped() {
    const test = typed.trim()
    if (test.length < 2 || tests.includes(test)) return
    setTests((chosen) => [...chosen, test])
    setTyped('')
  }

  // ===== 3. Send =====
  async function send() {
    if (!client || !patient) return
    setBusy(true)
    setError(null)
    const problem = await requestLab(client, patient.id, tests, note, sendTo)
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    setSent(
      sendTo === 'front_desk'
        ? `Sent to the Lab, and to the Front Desk for payment: ${tests.join(', ')}.`
        : `Sent to the Laboratory: ${tests.join(', ')}.`,
    )
  }

  const custom = tests.filter((test) => !COMMON_TESTS.includes(test))

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Request lab test</h2>

        {!staff.can_medical ? (
          <p className={styles.muted}>Lab tests are requested by doctors, nurses and the matron.</p>
        ) : sent && patient ? (
          // ----- Done -----
          <div className={styles.card}>
            <p className={styles.good}>{sent}</p>
            <p className={styles.muted}>
              You will be told when the result is ready. It goes straight into {patient.full_name}
              &apos;s record.
            </p>
            <div className={styles.buttons}>
              <Link
                className={`${styles.button} ${styles.primary}`}
                href={`/patients/record/?p=${patient.id}`}
              >
                Open the record
              </Link>
              <Link className={styles.button} href="/">
                Home
              </Link>
            </div>
          </div>
        ) : !patient ? (
          givenId ? (
            <p className={styles.muted}>Loading the patient…</p>
          ) : (
            <PatientPicker client={client} onPick={setPatient} />
          )
        ) : (
          <div className={styles.card}>
            {/* ----- The patient ----- */}
            <div className={styles.sectionHead}>
              <i>
                <Icon name="lab" size={20} />
              </i>
              <div>
                <b>{patient.full_name}</b>
                <small>{patient.patient_number}</small>
              </div>
              {!givenId ? (
                <button className={styles.button} onClick={() => setPatient(null)}>
                  Change
                </button>
              ) : null}
            </div>

            {/* ----- The tests ----- */}
            <div>
              <span className={styles.label}>Tests</span>
              <div className={styles.chips}>
                {[...COMMON_TESTS, ...custom].map((test) => (
                  <button
                    key={test}
                    className={styles.chip}
                    aria-pressed={tests.includes(test)}
                    onClick={() => toggle(test)}
                  >
                    {test}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.row}>
              <input
                className={styles.input}
                aria-label="Another test"
                placeholder="Another test, e.g. Liver function test"
                value={typed}
                maxLength={80}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && addTyped()}
              />
              <button
                className={styles.button}
                onClick={addTyped}
                disabled={typed.trim().length < 2}
              >
                Add
              </button>
            </div>

            {/* ----- A note for the lab ----- */}
            <div>
              <label className={styles.label} htmlFor="lab-note">
                Note for the lab (optional)
              </label>
              <textarea
                id="lab-note"
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
                  aria-pressed={sendTo === 'front_desk'}
                  onClick={() => setSendTo('front_desk')}
                >
                  Lab and Front Desk (payment)
                </button>
                <button
                  aria-pressed={sendTo === 'laboratory'}
                  onClick={() => setSendTo('laboratory')}
                >
                  Straight to the lab
                </button>
              </div>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
            <button
              className={`${styles.button} ${styles.primary}`}
              onClick={send}
              disabled={tests.length === 0 || busy}
            >
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}

// The address is read in the browser, so the page waits for it.
export default function RequestLabPage() {
  return (
    <Suspense fallback={null}>
      <RequestLab />
    </Suspense>
  )
}
