/*
 * app/lab/patient/page.tsx: Find a patient's tests. The Laboratory picks a
 * patient and sees every lab request, paid or not, waiting or finished, to
 * enter, add to or correct the results. Request 233 (2026-11-20): one sent
 * to the Front Desk only is found here before it is paid; it shows Not paid
 * yet, and the Front Desk keeps it as owed.
 *
 * Why: Anthony, 2026-11-16 (request 214): "the lab scientist should be able
 * to find and edit/add patients medical tests as long as the front desk has
 * confirmed them paid... they can make mistake and discover later and go to
 * edit or cancel."
 *
 * Each request opens Enter results: a waiting one to enter its results, a
 * finished one to cancel a wrong result and add the right one.
 *
 * Never: show a cancelled request, or anything about the patient beyond the
 * name and number. The database decides what the Lab may read.
 */
'use client'

import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PatientPicker from '../_parts/PatientPicker'
import styles from '../_parts/lab.module.css'
import AppShell from '@/components/shell/AppShell'
import { listPaidRequests, type LabRequest } from '@/lib/lab/lab'
import type { PatientResult } from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

export default function LabPatientPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/lab/patient/')
  const { client, staff } = auth
  const [patient, setPatient] = useState<PatientResult | null>(null)
  const [requests, setRequests] = useState<LabRequest[] | null>(null)

  // ===== 1. The patient's requests, paid or not =====
  useEffect(() => {
    if (!client || !patient) return
    let current = true
    listPaidRequests(client, patient.id).then((found) => {
      if (current) setRequests(found)
    })
    return () => {
      current = false
    }
  }, [client, patient])

  if (auth.status !== 'ready' || !client || !staff) return null

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Find a patient&apos;s tests</h2>
        {!staff.can_lab ? (
          <p className={styles.muted}>This is for the Laboratory.</p>
        ) : !patient ? (
          <PatientPicker client={client} onPick={setPatient} />
        ) : (
          <div className={styles.card}>
            <div className={styles.sectionHead}>
              <div>
                <b>{patient.full_name}</b>
                <small>{patient.patient_number}</small>
              </div>
              <button
                className={styles.button}
                onClick={() => {
                  setPatient(null)
                  setRequests(null)
                }}
              >
                Change
              </button>
            </div>
            {requests === null ? <p className={styles.muted}>Loading the tests…</p> : null}
            {requests && requests.length === 0 ? (
              <p className={styles.muted}>No lab tests for this patient.</p>
            ) : null}
            {(requests ?? []).map((request) => (
              <div key={request.id} className={styles.earlierLine}>
                <b>{request.tests.join(', ')}</b>
                <small className={styles.muted}>
                  {new Date(request.requested_at).toLocaleString('en-GB', {
                    timeZone: HOSPITAL_TIME_ZONE,
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ·{' '}
                  {request.status === 'completed' ? 'Results in the record' : 'Waiting for results'}
                  {request.status === 'awaiting_payment' ? ' · Not paid yet' : ''}
                  {request.requester ? ` · asked by ${request.requester.full_name}` : ''}
                </small>
                <Link
                  className={`${styles.button} ${request.status === 'completed' ? '' : styles.primary}`}
                  href={`/lab/result/?r=${request.id}`}
                >
                  {request.status === 'completed' ? 'Correct or add a result' : 'Enter results'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
