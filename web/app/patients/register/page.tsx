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
 * Family (request 128, step 2): after saving a patient with Family chosen,
 * "Add family member" starts the family (it gets a FAM number) and opens
 * this form again with the family already set (?family=12). No surname.
 *
 * Never: register silently over a possible duplicate. Two numbers for one
 * person splits their history.
 */
'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import PatientForm, { EMPTY_DETAILS } from '../_parts/PatientForm'
import SendToRoom from '../_parts/SendToRoom'
import styles from '../_parts/patients.module.css'
import { lastSeenWords } from '../_parts/PatientDetail'
import { ageFrom } from '@/lib/patients/age'
import {
  familyNumber,
  findPossibleDuplicates,
  registerPatient,
  startFamily,
  type PatientCard,
  type PatientDetails,
  type PatientResult,
} from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

function RegisterPatient() {
  const auth = useAuth()
  useRightPage(auth.status, '/patients/register/')
  const router = useRouter()
  const { client, staff } = auth
  // Adding a member to a family: the family comes from the address.
  const familyId = Number(useSearchParams().get('family')) || null
  const [familyCard, setFamilyCard] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  // The name of a patient saved on this device while the network was down.
  const [queued, setQueued] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<PatientDetails | null>(null)
  const [matches, setMatches] = useState<PatientResult[]>([])
  const [saved, setSaved] = useState<PatientCard | null>(null)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  // The family's card number, to show while adding members.
  useEffect(() => {
    if (!client || !familyId) return
    let current = true
    familyNumber(client, familyId).then((found) => {
      if (current) setFamilyCard(found)
    })
    return () => {
      current = false
    }
  }, [client, familyId])

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 0. Add family member: start the family (once), then a fresh form =====
  async function addMember(patientId: number) {
    if (!client) return
    setJoining(true)
    const family = await startFamily(client, patientId)
    setJoining(false)
    if (!family) {
      setProblem('The family could not be started. Check the network and try again.')
      return
    }
    setSaved(null)
    setSentTo(null)
    setFormKey((key) => key + 1)
    router.push(`/patients/register/?family=${family}`)
  }

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
    if (result.queued) setQueued(details.full_name)
    else if (result.problem) setProblem(result.problem)
    else setSaved(result.patient)
  }

  // ===== 1b. No network: saved on this device, sent later =====
  if (queued) {
    return (
      <AppShell>
        <div className={styles.page}>
          <div className={styles.head}>
            <h2>Registering…</h2>
          </div>
          <div className={styles.waitingCard}>
            <Icon name="reg" size={22} />
            <div>
              <b>{queued}</b>
              <small>
                No network. Saved on this device. It registers by itself when the network is back.
              </small>
            </div>
          </div>
          <div className={styles.buttons}>
            <button
              className={`${styles.button} ${styles.primary}`}
              onClick={() => {
                setQueued(null)
                setFormKey((key) => key + 1)
              }}
            >
              Register another patient
            </button>
            <Link className={styles.button} href="/">
              Home
            </Link>
          </div>
        </div>
      </AppShell>
    )
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
            {familyCard && saved.family_id ? ` · Family ${familyCard}` : ''}
          </p>
          {problem ? <p className={styles.error}>{problem}</p> : null}
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
              {saved.category === 'family' ? (
                <button
                  className={`${styles.button} ${styles.familyButton}`}
                  disabled={joining}
                  onClick={() => addMember(saved.id)}
                >
                  <Icon name="users" size={16} /> {joining ? 'Starting…' : 'Add family member'}
                </button>
              ) : null}
              <button
                className={styles.button}
                onClick={() => {
                  setSaved(null)
                  setSentTo(null)
                  setFormKey((key) => key + 1)
                  if (familyId) router.push('/patients/register/')
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
            <Link className={`${styles.button} ${styles.oldFile}`} href="/patients/old-file/">
              <Icon name="file" size={16} /> Register from old file
            </Link>
            <Link
              className={`${styles.button} ${styles.oldFile} ${styles.findPatient}`}
              href="/patients/"
            >
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

        {familyId ? (
          <div className={styles.familyBanner}>
            <Icon name="users" size={18} />
            <span>
              Adding to family <b>{familyCard ?? '…'}</b>
            </span>
          </div>
        ) : null}

        <PatientForm
          key={`${formKey}-${familyId ?? 'none'}`}
          initial={
            familyId ? { ...EMPTY_DETAILS, category: 'family', family_id: familyId } : EMPTY_DETAILS
          }
          saveLabel="Save patient"
          busy={busy}
          problem={problem}
          onSave={(details) => save(details)}
        />
      </div>
    </AppShell>
  )
}

// The address (?family=) is read in the browser, so the page waits for it.
export default function RegisterPatientPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPatient />
    </Suspense>
  )
}
