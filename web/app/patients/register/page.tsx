/*
 * app/patients/register/page.tsx: Register patient.
 *
 * Why: the demo's registration. In order:
 *   1. the front desk fills in the card (PatientForm);
 *   2. before saving, the database is asked whether a patient with the same
 *      name and date of birth already exists. If so, the front desk sees
 *      them and can open that patient instead (Anthony, 2026-10-29: "reuse
 *      this patient's information since it's already there"), or register
 *      a new patient anyway when it really is somebody else;
 *   3. once saved, the new RMC number shows, with Send to room.
 *
 * Never: register silently over a possible duplicate. Two numbers for one
 * person splits their history.
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import PatientForm, { EMPTY_DETAILS } from '../_parts/PatientForm'
import SendToRoom from '../_parts/SendToRoom'
import styles from '../_parts/patients.module.css'
import { lastSeenWords } from '../_parts/PatientDetail'
import { ageFrom } from '@/lib/patients/age'
import {
  findPossibleDuplicates,
  registerPatient,
  type PatientCard,
  type PatientDetails,
  type PatientResult,
} from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

export default function RegisterPatientPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/patients/register/')
  const router = useRouter()
  const { client, staff } = auth

  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<PatientDetails | null>(null)
  const [matches, setMatches] = useState<PatientResult[]>([])
  const [saved, setSaved] = useState<PatientCard | null>(null)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 1. Save, but look for the same patient first =====
  async function save(details: PatientDetails, skipCheck = false) {
    if (!client || !staff) return
    setBusy(true)
    setProblem(null)
    if (!skipCheck) {
      const found = await findPossibleDuplicates(client, details.full_name, details.date_of_birth)
      if (found.length > 0) {
        setBusy(false)
        setWaiting(details)
        setMatches(found)
        return
      }
    }
    const result = await registerPatient(client, details, staff.id)
    setBusy(false)
    setWaiting(null)
    setMatches([])
    if (result.problem) setProblem(result.problem)
    else setSaved(result.patient)
  }

  // ===== 2. After saving: the number, then Send to room =====
  if (saved) {
    return (
      <AppShell>
        <div className={styles.page}>
          <div className={styles.head}>
            <h2>Patient registered</h2>
          </div>
          <div className={styles.ok}>
            <Icon name="reg" size={22} />
            <div>
              <small className={styles.muted}>Patient number</small>
              <br />
              <b>{saved.patient_number}</b>
            </div>
          </div>
          <p className={styles.muted}>
            {saved.full_name} · {ageFrom(saved.date_of_birth)}
          </p>
          {sentTo ? (
            <div className={styles.ok}>
              <b>Sent to {sentTo}</b>
            </div>
          ) : null}
          {sending ? (
            <SendToRoom
              client={client}
              staffId={staff.id}
              patientId={saved.id}
              patientName={saved.full_name}
              onCancel={() => setSending(false)}
              onSent={(room) => {
                setSending(false)
                setSentTo(room)
              }}
            />
          ) : (
            <div className={styles.buttons}>
              {!sentTo ? (
                <button
                  className={`${styles.button} ${styles.primary}`}
                  onClick={() => setSending(true)}
                >
                  <Icon name="door" size={16} /> Send to room
                </button>
              ) : null}
              <button
                className={styles.button}
                onClick={() => {
                  setSaved(null)
                  setSentTo(null)
                  setFormKey((key) => key + 1)
                }}
              >
                Register another patient
              </button>
              <Link className={styles.button} href={`/patients/?p=${saved.id}`}>
                Open patient
              </Link>
            </div>
          )}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.head}>
          <h2>Register patient</h2>
          <div className={styles.buttons}>
            <Link className={`${styles.button} ${styles.quiet}`} href="/patients/old-file/">
              <Icon name="file" size={16} /> Register from old file
            </Link>
            <Link className={styles.button} href="/patients/">
              <Icon name="find" size={16} /> Find patient
            </Link>
          </div>
        </div>

        {/* ===== 3. A patient with the same name and date of birth ===== */}
        {waiting && matches.length > 0 ? (
          <div className={styles.warn} role="alert">
            <b>This patient may already be registered</b>
            <p className={styles.muted}>
              Same name and date of birth. Open the existing patient to keep one record, unless this
              really is somebody else.
            </p>
            {matches.map((match) => (
              <div
                key={match.id}
                className={`${styles.result} ${styles.match}`}
                style={{ cursor: 'default' }}
              >
                <div>
                  <b>{match.full_name}</b>
                  <small>
                    {match.patient_number} · {ageFrom(match.date_of_birth)}
                    {match.phone ? ` · ${match.phone}` : ''}
                  </small>
                  <small>Last seen: {lastSeenWords(match.last_seen)}</small>
                </div>
                <button
                  className={`${styles.button} ${styles.primary}`}
                  onClick={() => router.push(`/patients/?p=${match.id}`)}
                >
                  Use this patient
                </button>
              </div>
            ))}
            <div className={styles.buttons}>
              <button className={styles.button} disabled={busy} onClick={() => save(waiting, true)}>
                No, register a new patient
              </button>
            </div>
          </div>
        ) : null}

        <PatientForm
          key={formKey}
          initial={EMPTY_DETAILS}
          saveLabel="Save patient"
          busy={busy}
          problem={problem}
          onSave={(details) => save(details)}
        />
      </div>
    </AppShell>
  )
}
