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
 * Files (request 128): scans, results and old paper files sit in their own
 * section. Download asks "Full medical history" (printed, or saved as a
 * PDF from the print window) or "Attachments only" (each file to the
 * device).
 *
 * Never: show any part of the record before openRecord succeeds.
 */
'use client'

import { markDispensedSeenFor } from '@/lib/pharmacy/pharmacy'
import { AntenatalSection, ConsentSection } from './_parts/Antenatal'
import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { onChange } from '@/lib/live/changes'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import PersonBadge from '@/components/auth/PersonBadge'
import Icon from '@/components/shell/Icon'
import { AllergiesSection, ConditionsSection, ProfileSection } from './_parts/Background'
import { DosesSection, MedicationsSection } from './_parts/Medications'
import AttachmentPicker from './_parts/AttachmentPicker'
import FilesSection from './_parts/Files'
import LabSection from './_parts/Lab'
import NotSent from './_parts/NotSent'
import PrescriptionsSection from './_parts/Prescriptions'
import { ConsultationsSection, NursingNotesSection, VitalsSection } from './_parts/Observations'
import styles from './_parts/record.module.css'
import buttons from '../_parts/patients.module.css'
import { ageFrom } from '@/lib/patients/age'
import type { PatientFile } from '@/lib/patients/patientFiles'
import { getPatient, sexWords, type PatientResult } from '@/lib/patients/patients'
import { loadRecord, openRecord, type MedicalRecord } from '@/lib/record/record'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'
import { emailRecord } from '@/lib/record/emailRecord'

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
      Allergies not recorded yet. Remember to ask the patient about allergies.
    </div>
  )
}

function PatientRecord() {
  const auth = useAuth()
  useRightPage(auth.status, '/patients/record/')
  const id = Number(useSearchParams().get('p')) || null
  const { client, staff } = auth
  const allowed = Boolean(staff?.can_medical)
  const staffId = staff?.id ?? null

  const [patient, setPatient] = useState<PatientResult | null | undefined>(undefined)
  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [refused, setRefused] = useState(false)
  // The files on the record, for Download (Files section tells us).
  const [files, setFiles] = useState<PatientFile[]>([])
  const [choosing, setChoosing] = useState(false)
  const [picking, setPicking] = useState(false)
  // Emailing the record to the patient: asking, sending, then the answer.
  const [emailStep, setEmailStep] = useState<'ask' | 'sending' | null>(null)
  const [emailAnswer, setEmailAnswer] = useState<string | null>(null)

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
      // Opening the record clears this doctor's "dispensed" notices for
      // this patient (request 171c).
      if (staffId) void markDispensedSeenFor(client, staffId, id)
    })()
    return () => {
      current = false
    }
  }, [client, id, auth.status, allowed, staffId])

  // Read again after a change. The opening is still fresh, so no new one.
  const reload = useCallback(() => {
    if (client && id) loadRecord(client, id).then(setRecord)
  }, [client, id])

  // Something saved by anybody (a nurse's vitals, a lab result): show it at
  // once, without leaving the record (request 157).
  const opened = record !== null
  useEffect(() => {
    if (!client || !opened) return
    return onChange(client, 'records', reload)
  }, [client, opened, reload])

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 2b. Download =====
  const liveFiles = files.filter((file) => !file.removed_at)

  // The name a saved file starts with, so files sort by patient
  // (Anthony, 2026-11-02): "Ngozi Okafor RMC-000077".
  const fileStem = patient ? `${patient.full_name} ${patient.patient_number}` : 'Patient'

  function printHistory() {
    setChoosing(false)
    // Every part of the record open on paper, then the print window, where
    // "Save as PDF" makes a file of it. The browser names that file after
    // the page title, so the title is the patient's name and number while
    // the window is open.
    document.querySelectorAll('details').forEach((part) => {
      part.open = true
    })
    const title = document.title
    document.title = `${fileStem} medical history`
    // Put the title back once the print window closes (some browsers do
    // not wait at print(), so this listens for the close instead).
    window.addEventListener('afterprint', () => (document.title = title), { once: true })
    window.setTimeout(() => window.print(), 100)
  }

  const back = id ? (
    <>
      {/* Always in view, so a lab request never hides in a folded section. */}
      {allowed && patient && staff.role === 'doctor' ? (
        <Link
          className={`${buttons.button} ${buttons.primary}`}
          href={`/pharmacy/prescribe/?p=${id}`}
        >
          Prescribe
        </Link>
      ) : null}
      {allowed && patient ? (
        <Link className={`${buttons.button} ${buttons.primary}`} href={`/lab/request/?p=${id}`}>
          Request lab
        </Link>
      ) : null}
      {allowed && record ? (
        <button
          className={buttons.button}
          onClick={() => {
            setPicking(false)
            setChoosing(!choosing)
          }}
        >
          Download
        </button>
      ) : null}
      {allowed && record && patient?.email ? (
        <button
          className={buttons.button}
          onClick={() => {
            setChoosing(false)
            setEmailAnswer(null)
            setEmailStep('ask')
          }}
        >
          Email record
        </button>
      ) : null}
      <Link className={buttons.button} href={`/patients/?p=${id}`}>
        Back to patient
      </Link>
    </>
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
        <div className={`${styles.header} ${styles.noPrint}`}>
          {patient ? <PersonBadge name={patient.full_name} /> : null}
          <div>
            <h2>{patient ? patient.full_name : 'Medical record'}</h2>
            {patient ? (
              <small>
                {patient.patient_number} · {ageFrom(patient.date_of_birth)} ·{' '}
                {sexWords(patient.sex)}
              </small>
            ) : null}
            {patient?.from_old_file ? (
              <span className={buttons.oldFileMark}>
                <Icon name="file" size={13} /> From old file
              </span>
            ) : null}
          </div>
          {back}
        </div>

        {/* ----- Download: which part ----- */}
        {choosing ? (
          <div className={`${styles.choice} ${styles.noPrint}`}>
            <b>What do you want to download?</b>
            <div className={buttons.buttons}>
              <button className={`${buttons.button} ${buttons.primary}`} onClick={printHistory}>
                Full medical history
              </button>
              {liveFiles.length > 0 ? (
                <button
                  className={buttons.button}
                  onClick={() => {
                    setChoosing(false)
                    setPicking(true)
                  }}
                >
                  Attachments ({liveFiles.length})
                </button>
              ) : null}
              <button className={buttons.button} onClick={() => setChoosing(false)}>
                Cancel
              </button>
            </div>
            <small className={styles.muted}>To keep a file, choose Save as PDF.</small>
          </div>
        ) : null}
        {/* ----- Email the record, to the patient's own email only ----- */}
        {emailStep && patient?.email ? (
          <div className={`${styles.choice} ${styles.noPrint}`}>
            <b>Email the medical record to {patient.email}?</b>
            <small className={styles.muted}>
              Only send it because the patient asked. It goes to this email address and no other.
            </small>
            <div className={buttons.buttons}>
              <button
                className={`${buttons.button} ${buttons.primary}`}
                disabled={emailStep === 'sending'}
                onClick={async () => {
                  setEmailStep('sending')
                  const result = await emailRecord(client, patient.id)
                  setEmailStep(null)
                  setEmailAnswer(result ?? `Sent to ${patient.email}.`)
                }}
              >
                {emailStep === 'sending' ? 'Sending…' : 'Send'}
              </button>
              <button
                className={buttons.button}
                disabled={emailStep === 'sending'}
                onClick={() => setEmailStep(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {emailAnswer ? <p className={`${styles.muted} ${styles.noPrint}`}>{emailAnswer}</p> : null}
        {picking ? (
          <AttachmentPicker
            client={client}
            files={liveFiles}
            zipName={`${fileStem} attachments.zip`}
            onClose={() => setPicking(false)}
          />
        ) : null}

        {/* On paper, the patient's name and number head the history. */}
        {patient ? (
          <p className={styles.printOnly}>
            <b>{patient.full_name}</b> · {patient.patient_number} · {ageFrom(patient.date_of_birth)}{' '}
            · {sexWords(patient.sex)}
          </p>
        ) : null}

        {stop ? <p className={styles.muted}>{stop}</p> : null}
        {!stop && !props ? <p className={styles.muted}>Opening the record…</p> : null}

        {/* ===== 4. The record ===== */}
        {!stop && props && patient ? (
          <>
            <NotSent staffId={staff.id} patientId={props.patientId} />
            <AllergyBanner record={props.record} />
            <div className={styles.columns}>
              <div className={styles.column}>
                <MedicationsSection {...props} />
                <DosesSection {...props} />
                <VitalsSection {...props} />
                <NursingNotesSection {...props} />
                <ConsultationsSection {...props} canWrite={staff.room?.kind === 'consultation'} />
                <LabSection client={client} patientId={props.patientId} />
                <PrescriptionsSection client={client} patientId={props.patientId} />
                <FilesSection
                  client={client}
                  staffId={staff.id}
                  patientId={props.patientId}
                  fromOldFile={patient.from_old_file}
                  onLoaded={setFiles}
                />
              </div>
              <div className={styles.column}>
                <AllergiesSection {...props} />
                <ProfileSection
                  key={props.record.profile ? 'saved' : 'new'}
                  {...props}
                  female={patient.sex === 'female'}
                />
                <ConditionsSection {...props} />
                {/* The hospital's antenatal card (request 170), for antenatal
                    patients; the operation consent for every patient. */}
                {patient.category === 'antenatal' ? (
                  <AntenatalSection
                    client={client}
                    staffId={staff.id}
                    patientId={props.patientId}
                  />
                ) : null}
                <ConsentSection client={client} staffId={staff.id} patientId={props.patientId} />
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
