/*
 * app/lab/request/page.tsx: Request lab.
 *
 * Why: the demo's "Request lab test" (request 115). A doctor, nurse or
 * matron picks the patient, taps the common tests or finds any other one
 * (search or browse by section, request 196a, 2026-11-16), and
 * sends it to the Front Desk for payment or straight to the Laboratory.
 * Opened from Home (no patient yet) or from the patient's record (?p=12).
 *
 * The form itself is components/orders/LabRequestForm.tsx, shared with the
 * consultation (request 227d).
 *
 * Never: let somebody without medical record access send a request. The
 * database refuses it too.
 */
'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PatientPicker from '../_parts/PatientPicker'
import LabRequestForm from '@/components/orders/LabRequestForm'
import styles from '../_parts/lab.module.css'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import { getPatient, type PatientResult } from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

function RequestLab() {
  const auth = useAuth()
  useRightPage(auth.status, '/lab/request/')
  const params = useSearchParams()
  const givenId = Number(params.get('p')) || null
  const { client, staff } = auth

  const [patient, setPatient] = useState<PatientResult | null>(null)

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

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Request lab test</h2>

        {!staff.can_medical ? (
          <p className={styles.muted}>Lab tests are requested by doctors, nurses and the matron.</p>
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

            <LabRequestForm client={client} staffId={staff.id} patient={patient} />
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
