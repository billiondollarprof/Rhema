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
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import PersonBadge from '@/components/auth/PersonBadge'
import PatientDetail, { lastSeenWords } from './_parts/PatientDetail'
import styles from './_parts/patients.module.css'
import { ageFrom } from '@/lib/patients/age'
import { getPatient, searchPatients, type PatientResult } from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'
import { CATEGORY_LABELS } from '@/lib/queue/queue'

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

  if (auth.status !== 'ready' || !client || !staff) return null

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.head}>
          <h2>Find patient</h2>
          <div className={styles.buttons}>
            <Link className={`${styles.button} ${styles.quiet}`} href="/patients/old-file/">
              <Icon name="file" size={16} /> Register from old file
            </Link>
            <Link className={`${styles.button} ${styles.primary}`} href="/patients/register/">
              <Icon name="reg" size={16} /> Register patient
            </Link>
          </div>
        </div>

        <div className={styles.split}>
          {/* ===== 3. Search box and results ===== */}
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
              <button
                key={patient.id}
                className={styles.result}
                aria-current={chosenId === patient.id ? 'true' : undefined}
                onClick={() => router.replace(`/patients/?p=${patient.id}`, { scroll: false })}
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
                {patient.open_visit ? (
                  <span className={`${styles.tag} ${styles.tagBusy}`}>In hospital</span>
                ) : (
                  <span className={styles.tag}>
                    {CATEGORY_LABELS[patient.category] ?? patient.category}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ===== 4. The chosen patient ===== */}
          <div>
            {chosen && chosen.id === chosenId ? (
              <PatientDetail
                key={chosen.id}
                client={client}
                staffId={staff.id}
                canMedical={staff.can_medical}
                patient={chosen}
                onChanged={() => {
                  loadChosen()
                  searchPatients(client, typed).then(setResults)
                }}
              />
            ) : (
              <section className={styles.card}>
                <b>Search for a patient</b>
                <p className={styles.muted}>
                  Pick a result to see their details, edit them or send them to a room.
                </p>
              </section>
            )}
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
