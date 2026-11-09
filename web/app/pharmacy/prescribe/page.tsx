/*
 * app/pharmacy/prescribe/page.tsx: Prescribe.
 *
 * Why: request 123 (Anthony, 2026-10-31): "It's a hospital, so the doctor
 * prescribes." Opened from the patient's record (?p=12). One block per drug:
 * name, strength, dose, how often (tap a usual one), how many days, the
 * quantity, a note. Then send it to the Front Desk for payment, or straight
 * to the Pharmacy (for example, an admitted patient).
 *
 * Never: let anybody but a doctor send it. The database refuses it too.
 */
'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from '../_parts/pharmacy.module.css'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import { getPatient, type PatientResult } from '@/lib/patients/patients'
import { HOW_OFTEN, prescribe, sendAlso, type PrescriptionItem } from '@/lib/pharmacy/pharmacy'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

type SendTo = 'front_desk' | 'pharmacy'

// What the doctor types for one drug, kept as text until it is sent.
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

function Prescribe() {
  const auth = useAuth()
  useRightPage(auth.status, '/pharmacy/prescribe/')
  const params = useSearchParams()
  const patientId = Number(params.get('p')) || null
  const { client, staff } = auth

  const [patient, setPatient] = useState<PatientResult | null | undefined>(undefined)
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

  // ===== 1. The patient, from the address =====
  useEffect(() => {
    if (!client || !patientId || auth.status !== 'ready') return
    let current = true
    getPatient(client, patientId).then((found) => {
      if (current) setPatient(found)
    })
    return () => {
      current = false
    }
  }, [client, patientId, auth.status])

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 2. Changing one drug =====
  function change(index: number, part: keyof Draft, value: string) {
    setDrafts((all) => all.map((draft, at) => (at === index ? { ...draft, [part]: value } : draft)))
  }

  const ready = drafts.every((draft) => draft.drug.trim().length >= 2)

  // ===== 3. Send =====
  async function send() {
    if (!client || !patient) return
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
      const also = await sendAlso(client, patient.id, staff?.id ?? '')
      if (also) setAlsoProblem(also)
      else setAlsoSent(true)
    }
    setBusy(false)
    setSent(true)
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Prescribe</h2>

        {staff.role !== 'doctor' ? (
          <p className={styles.muted}>Prescriptions are written by doctors.</p>
        ) : !patientId ? (
          <p className={styles.muted}>Open a patient&apos;s record, then tap Prescribe.</p>
        ) : patient === undefined ? (
          <p className={styles.muted}>Loading the patient…</p>
        ) : patient === null ? (
          <p className={styles.muted}>This patient was not found.</p>
        ) : sent ? (
          // ----- Done -----
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
              <Link
                className={`${styles.button} ${styles.primary}`}
                href={`/patients/record/?p=${patient.id}`}
              >
                Back to the record
              </Link>
              {!alsoSent ? (
                <button
                  className={`${styles.button} ${styles.soft}`}
                  disabled={alsoBusy}
                  onClick={async () => {
                    setAlsoBusy(true)
                    setAlsoProblem(null)
                    const problem = await sendAlso(client, patient.id, staff.id)
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
        ) : (
          <div className={styles.card}>
            {/* ----- The patient ----- */}
            <div className={styles.sectionHead}>
              <i>
                <Icon name="pill" size={20} />
              </i>
              <div>
                <b>{patient.full_name}</b>
                <small>{patient.patient_number}</small>
              </div>
            </div>

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
                      Drug name
                    </label>
                    <input
                      id={`drug-${index}`}
                      className={styles.input}
                      placeholder="e.g. Paracetamol"
                      maxLength={160}
                      value={draft.drug}
                      onChange={(event) => change(index, 'drug', event.target.value)}
                    />
                  </div>
                  <div>
                    <label className={styles.label} htmlFor={`strength-${index}`}>
                      Strength
                    </label>
                    <input
                      id={`strength-${index}`}
                      className={styles.input}
                      placeholder="500 mg"
                      maxLength={60}
                      value={draft.strength}
                      onChange={(event) => change(index, 'strength', event.target.value)}
                    />
                  </div>
                  <div>
                    <label className={styles.label} htmlFor={`dose-${index}`}>
                      Dose
                    </label>
                    <input
                      id={`dose-${index}`}
                      className={styles.input}
                      placeholder="2 tablets"
                      maxLength={120}
                      value={draft.dose}
                      onChange={(event) => change(index, 'dose', event.target.value)}
                    />
                  </div>
                  <div className={styles.wide}>
                    <span className={styles.label}>How often</span>
                    <div className={styles.chips}>
                      {HOW_OFTEN.map((words) => (
                        <button
                          key={words}
                          className={styles.chip}
                          aria-pressed={draft.how_often === words}
                          onClick={() =>
                            change(index, 'how_often', draft.how_often === words ? '' : words)
                          }
                        >
                          {words}
                        </button>
                      ))}
                    </div>
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
                      placeholder="30 tablets"
                      maxLength={60}
                      value={draft.quantity}
                      onChange={(event) => change(index, 'quantity', event.target.value)}
                    />
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
                <button
                  aria-pressed={sendTo === 'front_desk'}
                  onClick={() => setSendTo('front_desk')}
                >
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
          </div>
        )}
      </div>
    </AppShell>
  )
}

// The address is read in the browser, so the page waits for it.
export default function PrescribePage() {
  return (
    <Suspense fallback={null}>
      <Prescribe />
    </Suspense>
  )
}
