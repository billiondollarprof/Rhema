/*
 * app/pharmacy/prescribe/page.tsx: Prescribe.
 *
 * Why: request 123 (Anthony, 2026-10-31): "It's a hospital, so the doctor
 * prescribes." Opened from the patient's record (?p=12). One block per drug:
 * name, strength, dose, how often (tap a usual one), how many days, the
 * quantity, a note. Then send it to the Front Desk for payment, or straight
 * to the Pharmacy (for example, an admitted patient).
 *
 * The form itself is components/orders/PrescribeForm.tsx, shared with the
 * consultation (request 227d), so both roads send the same prescription.
 *
 * Never: let anybody but a doctor send it. The database refuses it too.
 */
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from '../_parts/pharmacy.module.css'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import { getPatient, type PatientResult } from '@/lib/patients/patients'
import PrescribeForm from '@/components/orders/PrescribeForm'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'
import { actsAsDoctor } from '@/lib/auth/roles'

function Prescribe() {
  const auth = useAuth()
  useRightPage(auth.status, '/pharmacy/prescribe/')
  const params = useSearchParams()
  const patientId = Number(params.get('p')) || null
  const { client, staff } = auth

  const [patient, setPatient] = useState<PatientResult | null | undefined>(undefined)

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

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Prescribe</h2>

        {!actsAsDoctor(staff) ? (
          <p className={styles.muted}>
            Prescriptions are written by doctors, and by anybody working in a consulting room.
          </p>
        ) : !patientId ? (
          <p className={styles.muted}>Open a patient&apos;s record, then tap Prescribe.</p>
        ) : patient === undefined ? (
          <p className={styles.muted}>Loading the patient…</p>
        ) : patient === null ? (
          <p className={styles.muted}>This patient was not found.</p>
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
            <PrescribeForm client={client} staffId={staff.id} patient={patient} />
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
