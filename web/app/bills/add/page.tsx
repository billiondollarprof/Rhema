/*
 * app/bills/add/page.tsx: Add a bill, for one patient (?p=12).
 *
 * Why: the director's voice note and Anthony, 2026-11-21 and 22 (request
 * 235, part 3). A doctor or the matron bills a patient for a procedure, an
 * operation, the bed fee and the rest; the Front Desk takes the money.
 * Opened from the patient's record (Add a bill).
 *
 * The form itself is components/orders/BillForm.tsx.
 *
 * Never: let anybody but a doctor or the matron send a bill. The database
 * refuses it too.
 */
'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BillForm from '@/components/orders/BillForm'
import styles from '@/components/orders/orders.module.css'
import AppShell from '@/components/shell/AppShell'
import { getPatient, type PatientResult } from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'
import { setsPrices } from '@/lib/auth/roles'

function AddBill() {
  const auth = useAuth()
  useRightPage(auth.status, '/bills/add/')
  const givenId = Number(useSearchParams().get('p')) || null
  const { client, staff } = auth

  // undefined: still loading. null: not found.
  const [patient, setPatient] = useState<PatientResult | null | undefined>(undefined)

  // ===== 1. The patient from the address =====
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

  // ===== 2. Who may, and the form =====
  const allowed = setsPrices(staff)
  let stop: string | null = null
  if (!allowed) stop = 'Bills are added by doctors, the matron and anybody in a consulting room.'
  else if (!givenId || patient === null) stop = 'Open the patient first, then Add a bill.'

  return (
    <AppShell>
      <div className={styles.card}>
        <h2>Add a bill</h2>
        {stop ? (
          <>
            <p className={styles.muted}>{stop}</p>
            <div className={styles.buttons}>
              <Link className={styles.button} href="/patients/">
                Patients
              </Link>
            </div>
          </>
        ) : !patient ? (
          <p className={styles.muted}>Loading the patient…</p>
        ) : (
          <>
            <p>
              <b>{patient.full_name}</b> · {patient.patient_number}
            </p>
            <BillForm client={client} staffId={staff.id} patient={patient} />
          </>
        )}
      </div>
    </AppShell>
  )
}

// The address is read in the browser, so the page waits for it.
export default function AddBillPage() {
  return (
    <Suspense fallback={null}>
      <AddBill />
    </Suspense>
  )
}
