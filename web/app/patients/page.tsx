/*
 * app/patients/page.tsx: Find patient.
 *
 * Why: the demo's "Find patient". Search by name, patient number or phone.
 * Each result shows the category, whether the patient is in the hospital
 * now, and when they were last seen (Anthony's pick (e)). Picking one opens
 * their card beside the list on a wide screen, under it on a phone.
 * The address carries the chosen patient (?p=12), so a refresh or a link
 * opens the same patient.
 *
 * Never: show the medical record here. See PatientDetail.tsx.
 */
'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { onChange } from '@/lib/live/changes'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import PersonBadge from '@/components/auth/PersonBadge'
import PatientFilesCard from './_parts/PatientFilesCard'
import SendToRoom from './_parts/SendToRoom'
import PatientDetail, { lastSeenWords } from './_parts/PatientDetail'
import styles from './_parts/patients.module.css'
import { ageFrom } from '@/lib/patients/age'
import { getPatient, searchPatients, type PatientResult } from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'
import { CATEGORY_LABELS, STATUS_LABELS, type QueueStatus } from '@/lib/queue/queue'

function FindPatient() {
  const auth = useAuth()
  useRightPage(auth.status, '/patients/')
  const router = useRouter()
  const params = useSearchParams()
  const chosenId = Number(params.get('p')) || null
  const { client, staff } = auth

  const [typed, setTyped] = useState('')
  const [results, setResults] = useState<PatientResult[] | null>(null)
  const [chosen, setChosen] = useState<PatientResult | null>(null)
  // Whether the chosen patient was picked from the results on this screen.
  const cameFromList = useRef(false)
  // Send to room straight from a result card, without opening the patient
  // (Anthony, 2026-11-10): which card has the form open, and what was sent.
  const [sendingFor, setSendingFor] = useState<number | null>(null)
  const [sentTo, setSentTo] = useState<{ id: number; room: string } | null>(null)

  // ===== 1. Search as the person types (after a short pause) =====
  useEffect(() => {
    if (!client || auth.status !== 'ready') return
    let current = true
    const timer = window.setTimeout(() => {
      searchPatients(client, typed).then((found) => {
        if (current) setResults(found)
      })
    }, 250)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [client, auth.status, typed])

  // ===== 2. The chosen patient, from the address =====
  const loadChosen = useCallback(async () => {
    if (!client || !chosenId) return
    setChosen(await getPatient(client, chosenId))
  }, [client, chosenId])

  useEffect(() => {
    if (auth.status !== 'ready' || !chosenId) return
    const timer = window.setTimeout(loadChosen, 0)
    return () => window.clearTimeout(timer)
  }, [auth.status, chosenId, loadChosen])

  // Something saved by anybody (a new patient, a visit): the list and the
  // chosen patient update at once (request 157).
  useEffect(() => {
    if (!client || auth.status !== 'ready') return
    return onChange(client, 'records', () => {
      void searchPatients(client, typed).then(setResults)
      void loadChosen()
    })
  }, [client, auth.status, typed, loadChosen])

  if (auth.status !== 'ready' || !client || !staff) return null

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.head}>
          <h2>{chosenId ? 'Patient' : 'Find patient'}</h2>
          {chosenId || staff.role !== 'front_desk' ? null : (
            <div className={styles.buttons}>
              <Link className={`${styles.button} ${styles.oldFile}`} href="/patients/old-file/">
                <Icon name="file" size={16} /> Register from old file
              </Link>
              <Link className={`${styles.button} ${styles.primary}`} href="/patients/register/">
                <Icon name="reg" size={16} /> Register patient
              </Link>
            </div>
          )}
        </div>

        {/* A chosen patient opens on a screen of their own, with a way
            back to the search (Anthony, 2026-11-09: "when you click on a
            patient... it should open a new screen... What if the names are
            plenty?"). The search and its results are kept for the way back. */}
        <div className={chosenId ? styles.patientScreen : styles.searchScreen}>
          {/* ===== 3. Search box and results ===== */}
          {chosenId ? null : (
            <div className={styles.list}>
              <label className={styles.search}>
                <Icon name="find" size={18} />
                <input
                  aria-label="Search by name, patient number or phone"
                  placeholder="Search by name, patient number or phone"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                />
              </label>
              <small className={styles.muted}>
                Same name as another patient? Use the number or phone.
              </small>
              {results && results.length === 0 ? (
                <p className={styles.muted}>
                  {typed ? 'No patient found.' : 'No patients registered yet.'}
                </p>
              ) : null}
              {(results ?? []).map((patient) => (
                <div key={patient.id} className={styles.resultBox}>
                  <div className={styles.resultRow}>
                    <button
                      className={styles.result}
                      aria-current={chosenId === patient.id ? 'true' : undefined}
                      onClick={() => {
                        cameFromList.current = true
                        router.push(`/patients/?p=${patient.id}`)
                      }}
                    >
                      <PersonBadge name={patient.full_name} />
                      <div>
                        <b>{patient.full_name}</b>
                        <small>
                          {patient.patient_number} · {ageFrom(patient.date_of_birth)}
                          {patient.phone ? ` · ${patient.phone}` : ''}
                        </small>
                        <small>Last seen: {lastSeenWords(patient.last_seen)}</small>
                      </div>
                      {/* Where the patient is right now, e.g. "Waiting · Consultant Room 1"
                    (Anthony, 2026-11-02: "remove in hospital and then put the
                    actual tags"). */}
                      {patient.open_visit ? (
                        <span className={`${styles.tag} ${styles.tagBusy}`}>
                          {STATUS_LABELS[patient.open_visit.status as QueueStatus] ??
                            patient.open_visit.status}
                          {patient.open_visit.room ? ` · ${patient.open_visit.room}` : ''}
                        </span>
                      ) : (
                        <span className={styles.tag}>
                          {CATEGORY_LABELS[patient.category] ?? patient.category}
                          {patient.family ? ` · ${patient.family.family_number}` : ''}
                        </span>
                      )}
                    </button>
                    <button
                      className={`${styles.button} ${styles.resultSend}`}
                      onClick={() => {
                        setSentTo(null)
                        setSendingFor(sendingFor === patient.id ? null : patient.id)
                      }}
                    >
                      {patient.open_visit ? 'Move to room' : 'Send to room'}
                    </button>
                  </div>
                  {sendingFor === patient.id ? (
                    <SendToRoom
                      client={client}
                      staffId={staff.id}
                      patientId={patient.id}
                      patientName={patient.full_name}
                      openVisit={patient.open_visit}
                      onCancel={() => setSendingFor(null)}
                      onSent={(room) => {
                        setSendingFor(null)
                        setSentTo({ id: patient.id, room })
                        void searchPatients(client, typed).then(setResults)
                      }}
                    />
                  ) : null}
                  {sentTo?.id === patient.id ? (
                    <p className={styles.sentNote}>
                      {patient.full_name} sent to {sentTo.room}.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* ===== 4. The chosen patient, on its own screen ===== */}
          <div>
            {chosenId ? (
              <button
                type="button"
                className={`${styles.button} ${styles.backButton}`}
                // Back to the same search when the patient was picked from
                // it; otherwise (a link from elsewhere) to a fresh search.
                onClick={() => {
                  if (cameFromList.current) {
                    cameFromList.current = false
                    router.back()
                  } else router.push('/patients/')
                }}
              >
                ← Back to search
              </button>
            ) : null}
            {chosen && chosen.id === chosenId ? (
              <>
                <PatientDetail
                  key={chosen.id}
                  client={client}
                  staffId={staff.id}
                  canMedical={staff.can_medical}
                  // Payments: the Front Desk and admins (request 123, part 2).
                  canPay={staff.role === 'front_desk' || staff.can_admin}
                  // Only the Front Desk registers patients (Anthony, 2026-11-10).
                  canRegister={staff.role === 'front_desk'}
                  patient={chosen}
                  onChanged={() => {
                    loadChosen()
                    searchPatients(client, typed).then(setResults)
                  }}
                />
                {/* The files attached to this patient (scans, old file pages):
                  preview them here; only the person who attached a wrong one
                  to an old file patient may delete it (request 128). */}
                <PatientFilesCard
                  client={client}
                  staffId={staff.id}
                  patientId={chosen.id}
                  fromOldFile={chosen.from_old_file}
                />
              </>
            ) : chosenId ? (
              <p className={styles.muted}>Loading…</p>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

// useSearchParams needs a Suspense boundary in a static build.
export default function FindPatientPage() {
  return (
    <Suspense fallback={null}>
      <FindPatient />
    </Suspense>
  )
}
