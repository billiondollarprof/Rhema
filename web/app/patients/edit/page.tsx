/*
 * app/patients/edit/page.tsx: Edit patient.
 *
 * Why: the demo's "Edit patient". The same form as Register, filled in with
 * the patient's card. The patient number never changes (the database
 * refuses), and every change goes in the activity log with the names of
 * the fields that changed, never their values.
 *
 * The patient comes from the address: /patients/edit/?p=12.
 *
 * Below the form: the patient's files (PatientFilesCard), to preview, to
 * attach more, and for the person who attached them to an old file
 * patient, to delete a wrong one (request 128, 2026-11-02). Then, for the
 * Front Desk and admins, Payments, so a payment for something new can be
 * taken while editing (request 141, Anthony, 2026-11-04: "during edit it
 * can be found in case they're paying for something new/else").
 *
 * A family member changed to Individual pays the card fee before the change
 * saves (request 160, 2026-11-09).
 *
 * Never: delete a patient from here. A wrong registration is voided with a
 * reason, by the admin, in a later step.
 */
'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import PatientFilesCard from '../_parts/PatientFilesCard'
import PaymentsCard from '../_parts/PaymentsCard'
import PatientForm, { EMPTY_DETAILS, type CardFee } from '../_parts/PatientForm'
import styles from '../_parts/patients.module.css'
import {
  getPatient,
  updatePatient,
  type PatientDetails,
  type PatientResult,
} from '@/lib/patients/patients'
import { takePayment } from '@/lib/payments/payments'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

function EditPatient() {
  const auth = useAuth()
  useRightPage(auth.status, '/patients/edit/')
  const router = useRouter()
  const id = Number(useSearchParams().get('p')) || null
  const { client, staff } = auth

  const [patient, setPatient] = useState<PatientResult | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // ===== 1. Load the patient =====
  useEffect(() => {
    if (!client || !id || auth.status !== 'ready') return
    let current = true
    getPatient(client, id).then((found) => {
      if (current) setPatient(found)
    })
    return () => {
      current = false
    }
  }, [client, id, auth.status])

  if (auth.status !== 'ready' || !client) return null

  // Only the Front Desk edits a patient's details (Anthony, 2026-11-11: "it's
  // the job of the front desk"). Everybody else does their own duty.
  if (staff && staff.role !== 'front_desk') {
    return (
      <AppShell>
        <div className={styles.page}>
          <p className={styles.muted}>Only the Front Desk edits patient details.</p>
          <Link className={styles.button} href="/patients/">
            Find patient
          </Link>
        </div>
      </AppShell>
    )
  }

  // ===== 2. Save, then back to the patient =====
  async function save(details: PatientDetails, cardFee: CardFee) {
    if (!client || !id) return
    setBusy(true)
    setProblem(null)
    // A family member who becomes Individual pays their card fee first
    // (request 160). If the payment does not save, nothing changes.
    if (cardFee) {
      const paid = await takePayment(
        client,
        id,
        'registration_card',
        [{ label: 'Registration card', amount: cardFee.amount }],
        cardFee.mode,
      )
      if (typeof paid !== 'number') {
        setBusy(false)
        setProblem(typeof paid === 'string' ? paid : 'The card fee could not be saved. Try again.')
        return
      }
    }
    const result = await updatePatient(client, id, details)
    setBusy(false)
    if (result) setProblem(result)
    else router.push(`/patients/?p=${id}`)
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.head}>
          <h2>Edit patient</h2>
          {id ? (
            <Link className={styles.button} href={`/patients/?p=${id}`}>
              Cancel
            </Link>
          ) : null}
        </div>
        {patient === null || !id ? (
          <p className={styles.muted}>This patient was not found.</p>
        ) : null}
        {patient ? (
          <>
            <p className={styles.muted}>{patient.patient_number}</p>
            <PatientForm
              initial={{
                full_name: patient.full_name,
                // An old file patient has neither yet; the form asks for
                // both, with the same starting choice as a new patient.
                date_of_birth: patient.date_of_birth ?? '',
                sex: patient.sex ?? EMPTY_DETAILS.sex,
                category: patient.category,
                phone: patient.phone,
                email: patient.email,
                address: patient.address,
                town: patient.town,
                lga: patient.lga,
                state: patient.state,
                country: patient.country,
                next_of_kin_name: patient.next_of_kin_name,
                next_of_kin_relationship: patient.next_of_kin_relationship,
                next_of_kin_phone: patient.next_of_kin_phone,
                family_id: patient.family_id,
              }}
              saveLabel="Save changes"
              busy={busy}
              problem={problem}
              // A family member changed to Individual pays the card fee
              // (Anthony, 2026-11-09: "Yes if changed to individual").
              feeRequiredIf={(details) =>
                patient.category === 'family' && details.category === 'individual'
              }
              onSave={save}
            />
            {staff ? (
              <PatientFilesCard
                client={client}
                staffId={staff.id}
                patientId={patient.id}
                fromOldFile={patient.from_old_file}
              />
            ) : null}
            {staff && (staff.role === 'front_desk' || staff.can_admin) ? (
              <PaymentsCard client={client} patientId={patient.id} />
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  )
}

export default function EditPatientPage() {
  return (
    <Suspense fallback={null}>
      <EditPatient />
    </Suspense>
  )
}
