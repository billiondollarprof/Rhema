/*
 * app/patients/record/page.tsx: one patient's medical record.
 *
 * Why: the demo's medical record, for the nursing station and the
 * consultant rooms. The patient comes from the address:
 * /patients/record/?p=12.
 *
 * The order on opening:
 *   1. Check this person has medical access. If not, say so and stop.
 *   2. Write "who opened this record" (openRecord). The database answers
 *      for nothing until that is done, and the admin sees every opening.
 *   3. Read the record, and show the allergy banner above everything.
 *
 * Layout (Anthony, 2026-10-29: simple, seamless, aligned): on a phone,
 * one column. On a wide screen, the day's work on the left (medicines,
 * doses, readings, notes) and the background facts on the right
 * (allergies, profile, conditions).
 *
 * Never: show any part of the record before openRecord succeeds.
 */
'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import PersonBadge from '@/components/auth/PersonBadge'
import { AllergiesSection, ConditionsSection, ProfileSection } from './_parts/Background'
import { DosesSection, MedicationsSection } from './_parts/Medications'
import { ConsultationsSection, NursingNotesSection, VitalsSection } from './_parts/Observations'
import styles from './_parts/record.module.css'
import buttons from '../_parts/patients.module.css'
import { ageFrom } from '@/lib/patients/age'
import { getPatient, type PatientResult } from '@/lib/patients/patients'
import { loadRecord, openRecord, type MedicalRecord } from '@/lib/record/record'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

// ===== 1. The allergy banner =====
// Red: allergies on file. Green: asked, and none. Amber: nobody has asked yet.
function AllergyBanner({ record }: { record: MedicalRecord }) {
  const allergies = record.allergies.filter((a) => !a.voided_at)
  if (allergies.length > 0) {
    return (
      <div className={`${styles.banner} ${styles.bannerRed}`} role="alert">
        Allergic to:{' '}
        {allergies.map((a) => `${a.allergen}${a.severe ? ' (severe)' : ''}`).join(', ')}
      </div>
    )
  }
  if (record.profile?.no_known_allergies) {
    return <div className={`${styles.banner} ${styles.bannerGreen}`}>No known allergies</div>
  }
  return (
    <div className={`${styles.banner} ${styles.bannerAmber}`}>
      Allergies not recorded yet. Ask the patient, then add them or tick &quot;No known
      allergies&quot;.
    </div>
  )
}

function PatientRecord() {
  const auth = useAuth()
  useRightPage(auth.status, '/patients/record/')
  const id = Number(useSearchParams().get('p')) || null
  const { client, staff } = auth
  const allowed = Boolean(staff?.can_medical)

  const [patient, setPatient] = useState<PatientResult | null | undefined>(undefined)
  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [refused, setRefused] = useState(false)

  // ===== 2. Open, then read =====
  useEffect(() => {
    if (!client || !id || auth.status !== 'ready' || !allowed) return
    let current = true
    ;(async () => {
      const found = await getPatient(client, id)
      if (!current) return
      setPatient(found)
      if (!found) return
      const opened = await openRecord(client, id)
      if (!current) return
      if (!opened) {
        setRefused(true)
        return
      }
      const loaded = await loadRecord(client, id)
      if (current) setRecord(loaded)
    })()
    return () => {
      current = false
    }
  }, [client, id, auth.status, allowed])

  // Read again after a change. The opening is still fresh, so no new one.
  const reload = useCallback(() => {
    if (client && id) loadRecord(client, id).then(setRecord)
  }, [client, id])

  if (auth.status !== 'ready' || !client || !staff) return null

  const back = id ? (
    <Link className={buttons.button} href={`/patients/?p=${id}`}>
      Back to patient
    </Link>
  ) : null

  // ===== 3. The reasons the record cannot be shown =====
  let stop: string | null = null
  if (!allowed) stop = 'The medical record is open to doctors, nurses and the matron only.'
  else if (!id || patient === null) stop = 'This patient was not found.'
  else if (refused) stop = 'The record could not be opened. Check your connection and try again.'

  const props = record && id ? { client, staffId: staff.id, patientId: id, record, reload } : null

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.header}>
          {patient ? <PersonBadge name={patient.full_name} /> : null}
          <div>
            <h2>{patient ? patient.full_name : 'Medical record'}</h2>
            {patient ? (
              <small>
                {patient.patient_number} · {ageFrom(patient.date_of_birth)} ·{' '}
                {patient.sex === 'female' ? 'Female' : 'Male'}
              </small>
            ) : null}
          </div>
          {back}
        </div>

        {stop ? <p className={styles.muted}>{stop}</p> : null}
        {!stop && !props ? <p className={styles.muted}>Opening the record…</p> : null}

        {/* ===== 4. The record ===== */}
        {!stop && props && patient ? (
          <>
            <AllergyBanner record={props.record} />
            <div className={styles.columns}>
              <div className={styles.column}>
                <MedicationsSection {...props} />
                <DosesSection {...props} />
                <VitalsSection {...props} />
                <NursingNotesSection {...props} />
                <ConsultationsSection {...props} />
              </div>
              <div className={styles.column}>
                <AllergiesSection {...props} />
                <ProfileSection
                  key={props.record.profile ? 'saved' : 'new'}
                  {...props}
                  female={patient.sex === 'female'}
                />
                <ConditionsSection {...props} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}

export default function PatientRecordPage() {
  return (
    <Suspense fallback={null}>
      <PatientRecord />
    </Suspense>
  )
}
