/*
 * record/_parts/Chart.tsx: the medication chart. One row for each medicine
 * the patient is on, with the last dose (the time and the nurse) and when
 * the next one is due, and a Given button. Under it, every dose given, as a
 * table anybody can read.
 *
 * Why: the director, 2026-11-16 (request 217c, Anthony's yes 218b): nurses
 * need a chart "like a spreadsheet... so-so drug given at so-so time, so-so
 * dose by so-so person. So that any person that comes around will see it."
 * And picking the drug, then the milligram, then the dose for every dose
 * "will more difficult". So the doctor (or nurse) sets the medicine up once
 * in Current medications, and each dose after that is Given, then Yes.
 *
 * How a dose is recorded:
 *   1. Tap Given on the medicine's row.
 *   2. The row asks "Give 1 g now?". Tap "Yes, given". The time is now, the
 *      dose is the charted dose, and the nurse is the person signed in.
 *   3. Different dose or an earlier time? Tap Change first.
 *   4. Not given (request 219c, number 2)? Tap Not given and the reason
 *      (refused, vomited...). It is written down, never left blank, and the
 *      next dose is worked out from that time.
 *
 * "Add, suspend or stop a medicine" opens the medicine list here, in place
 * (request 221a, 2026-11-17: "why doesn't it open the charts?"), with its
 * reasons (the database insists on them). "Correct or add a dose" opens the
 * doses' own list here too: void a wrong one, or add a dose not charted.
 *
 * Never: record a dose in another person's name (the database refuses it),
 * or decide a dose. "Next due" is only a reminder from "How often".
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DosesSection, MedicationsSection } from './Medications'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import { isLate, lastDoseOf, nextDue } from '@/lib/record/chart'
import { addLine, when, type MedicalRecord, type Medication } from '@/lib/record/record'

type Props = {
  client: SupabaseClient
  staffId: string
  patientId: number
  record: MedicalRecord
  reload: () => void
}

// "now" in the form a time box expects (local time, to the minute).
function localNow() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

// Just the time today ("14:05"), or the day and time before today.
function shortTime(date: Date): string {
  const today = new Date().toDateString() === date.toDateString()
  return today
    ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : when(date.toISOString())
}

// ===== 1. The chart =====
export default function MedicationChart({ client, staffId, patientId, record, reload }: Props) {
  const [showAll, setShowAll] = useState(false)
  // The medicines' own list (add, suspend, stop) and the doses' own list
  // (correct, add one not on the chart) open here, in place (request 221a).
  const [managing, setManaging] = useState(false)
  const [fixingDoses, setFixingDoses] = useState(false)
  // Active medicines only: a suspended or stopped one is not given.
  const active = record.medications.filter((m) => !m.voided_at && m.status === 'active')
  const doses = record.doses
    .filter((dose) => !dose.voided_at)
    .sort((a, b) => b.given_at.localeCompare(a.given_at))
  const shown = showAll ? doses : doses.slice(0, 8)

  return (
    <Section title="Medication chart" count={active.length} open>
      {active.length === 0 ? (
        <EmptyLine text="No medicine to give. Add one in Current medications." />
      ) : (
        <div className={styles.chart} role="table" aria-label="Medicines to give">
          <div className={styles.chartHead} role="row">
            <span role="columnheader">Medicine</span>
            <span role="columnheader">Last given</span>
            <span role="columnheader">Next due</span>
            <span role="columnheader" className={styles.chartAction}>
              <span className={styles.srOnly}>Give</span>
            </span>
          </div>
          {active.map((medication) => (
            <ChartRow
              key={medication.id}
              client={client}
              staffId={staffId}
              patientId={patientId}
              medication={medication}
              record={record}
              reload={reload}
            />
          ))}
        </div>
      )}
      <div className={styles.actions}>
        {/* The whole treatment sheet, full page, like the ward's paper one
            (request 224). */}
        <Link
          className={`${styles.small} ${styles.primary}`}
          href={`/patients/record/sheet/?p=${patientId}&s=drugs`}
        >
          Open the treatment sheet
        </Link>
        <button
          className={styles.small}
          aria-expanded={managing}
          onClick={() => setManaging(!managing)}
        >
          {managing ? 'Close the medicine list' : 'Add, suspend or stop a medicine'}
        </button>
      </div>
      {managing ? (
        <MedicationsSection
          client={client}
          staffId={staffId}
          patientId={patientId}
          record={record}
          reload={reload}
          bare
        />
      ) : (
        // On paper (Full medical history), every medicine with its changes is
        // printed even when the list is shut on the screen.
        <div className={styles.printOnly}>
          <MedicationsSection
            client={client}
            staffId={staffId}
            patientId={patientId}
            record={record}
            reload={reload}
            bare
          />
        </div>
      )}

      {/* ===== 3. Every dose given, newest first ===== */}
      <h4 className={styles.chartTitle}>Doses given</h4>
      {doses.length === 0 ? (
        <EmptyLine text="No dose given yet." />
      ) : (
        <div className={styles.doseTable} role="table" aria-label="Doses given">
          <div className={styles.doseHead} role="row">
            <span role="columnheader">Time</span>
            <span role="columnheader">Medicine</span>
            <span role="columnheader">Dose</span>
            <span role="columnheader">Given by</span>
          </div>
          {shown.map((dose) => (
            <div key={dose.id} className={styles.doseRow} role="row">
              <span role="cell">{shortTime(new Date(dose.given_at))}</span>
              <span role="cell" className={styles.doseMedicine}>
                {dose.medicine}
              </span>
              <span role="cell" className={dose.not_given_reason ? styles.chartLate : undefined}>
                {dose.not_given_reason
                  ? `Not given: ${dose.not_given_reason}`
                  : [dose.dose, dose.route].filter(Boolean).join(' · ') || '-'}
              </span>
              <span role="cell">{dose.signer?.full_name ?? dose.giver?.full_name ?? 'staff'}</span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.actions}>
        {doses.length > 8 ? (
          <button className={styles.small} onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show fewer' : `Show all ${doses.length} doses`}
          </button>
        ) : null}
        <button
          className={styles.small}
          aria-expanded={fixingDoses}
          onClick={() => setFixingDoses(!fixingDoses)}
        >
          {fixingDoses ? 'Close' : 'Correct or add a dose'}
        </button>
      </div>
      {fixingDoses ? (
        <DosesSection
          client={client}
          staffId={staffId}
          patientId={patientId}
          record={record}
          reload={reload}
          bare
        />
      ) : (
        // On paper, every dose with its corrections.
        <div className={styles.printOnly}>
          <DosesSection
            client={client}
            staffId={staffId}
            patientId={patientId}
            record={record}
            reload={reload}
            bare
          />
        </div>
      )}
    </Section>
  )
}

// The usual reasons a due dose is not given; Other is typed.
const NOT_GIVEN_REASONS = [
  'Refused',
  'Vomited',
  'Asleep or away',
  'Not in stock',
  'Doctor said to hold',
  'Nil by mouth',
]

// ===== 2. One medicine: last dose, next due, Given =====
function ChartRow({
  client,
  staffId,
  patientId,
  medication,
  record,
  reload,
}: Props & { medication: Medication }) {
  // closed: only the Given button. asking: "Give 1 g now?". changing: the
  // dose and time boxes are open.
  const [step, setStep] = useState<'closed' | 'asking' | 'changing' | 'notGiven'>('closed')
  const [otherReason, setOtherReason] = useState('')
  const [dose, setDose] = useState(medication.dose ?? '')
  const [givenAt, setGivenAt] = useState(localNow())
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const last = lastDoseOf(medication, record.doses)
  // The newest entry, given or not given: the next dose is worked out from it.
  const lastTry = lastDoseOf(medication, record.doses, false)
  const skipped = lastTry && lastTry.not_given_reason ? lastTry : null
  const due = nextDue(medication, lastTry)
  const late = isLate(due)

  // Not given: written down with its reason, now, with no dose.
  async function notGiven(reason: string) {
    if (reason.trim().length < 2) {
      setProblem('Type the reason.')
      return
    }
    setBusy(true)
    const result = await addLine(client, 'medications_given', {
      patient_id: patientId,
      medication_id: medication.id,
      medicine: medication.medicine,
      dose: null,
      not_given_reason: reason.trim(),
      given_at: new Date().toISOString(),
      given_by: staffId,
    })
    setBusy(false)
    if (result) {
      setProblem(result)
      return
    }
    setProblem(null)
    setOtherReason('')
    setStep('closed')
    reload()
  }

  async function give() {
    setBusy(true)
    const result = await addLine(client, 'medications_given', {
      patient_id: patientId,
      medication_id: medication.id,
      medicine: medication.medicine,
      dose: dose.trim() || null,
      route: medication.route ?? null,
      // "Yes, given" without Change: the time is now.
      given_at: step === 'changing' ? new Date(givenAt).toISOString() : new Date().toISOString(),
      given_by: staffId,
    })
    setBusy(false)
    if (result) {
      setProblem(result)
      return
    }
    setProblem(null)
    setStep('closed')
    setDose(medication.dose ?? '')
    reload()
  }

  return (
    <div className={styles.chartRow} role="row">
      <span role="cell" className={styles.chartMedicine}>
        <b>{medication.medicine}</b>
        <small>
          {[medication.dose, medication.route, medication.how_often].filter(Boolean).join(' · ') ||
            ' '}
        </small>
      </span>
      <span role="cell" className={styles.chartCell}>
        <small className={styles.chartLabel}>Last given</small>
        {last ? (
          <>
            {shortTime(new Date(last.given_at))}
            <small>{last.signer?.full_name ?? last.giver?.full_name ?? 'staff'}</small>
          </>
        ) : (
          'Not yet'
        )}
        {skipped ? (
          <small className={styles.chartLate}>
            Not given {shortTime(new Date(skipped.given_at))}: {skipped.not_given_reason}
          </small>
        ) : null}
      </span>
      <span role="cell" className={`${styles.chartCell} ${late ? styles.chartLate : ''}`}>
        <small className={styles.chartLabel}>Next due</small>
        {due === 'now' ? 'Now' : due ? shortTime(due) : 'When needed'}
        {late && due !== 'now' ? <small>Late</small> : null}
      </span>
      <span role="cell" className={styles.chartAction}>
        {step === 'closed' ? (
          <button
            className={`${styles.small} ${styles.primary}`}
            onClick={() => {
              setGivenAt(localNow())
              setStep('asking')
            }}
          >
            Given
          </button>
        ) : null}
      </span>

      {step !== 'closed' ? (
        <div className={styles.chartConfirm}>
          {step === 'notGiven' ? (
            <>
              <b>Why was it not given?</b>
              <div className={styles.phrases}>
                {NOT_GIVEN_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    className={styles.phrase}
                    disabled={busy}
                    onClick={() => notGiven(reason)}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <div className={styles.field}>
                <label htmlFor={`chart-why-${medication.id}`}>Another reason</label>
                <input
                  id={`chart-why-${medication.id}`}
                  className={styles.input}
                  maxLength={120}
                  value={otherReason}
                  onChange={(event) => setOtherReason(event.target.value)}
                />
              </div>
            </>
          ) : step === 'asking' ? (
            <b>
              Give {medication.dose ? `${medication.dose} of ` : ''}
              {medication.medicine} now?
            </b>
          ) : (
            <div className={styles.fields}>
              <div className={styles.field}>
                <label htmlFor={`chart-dose-${medication.id}`}>Dose given</label>
                <input
                  id={`chart-dose-${medication.id}`}
                  className={styles.input}
                  maxLength={120}
                  value={dose}
                  onChange={(event) => setDose(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={`chart-time-${medication.id}`}>Time given</label>
                <input
                  id={`chart-time-${medication.id}`}
                  type="datetime-local"
                  className={styles.input}
                  max={localNow()}
                  value={givenAt}
                  onChange={(event) => setGivenAt(event.target.value)}
                />
              </div>
            </div>
          )}
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            {step === 'notGiven' ? (
              <button
                className={`${styles.small} ${styles.primary}`}
                disabled={busy || otherReason.trim().length < 2}
                onClick={() => notGiven(otherReason)}
              >
                {busy ? 'Saving…' : 'Save the reason'}
              </button>
            ) : (
              <button
                className={`${styles.small} ${styles.primary}`}
                disabled={busy}
                onClick={give}
              >
                {busy ? 'Saving…' : 'Yes, given'}
              </button>
            )}
            {step === 'asking' ? (
              <>
                <button className={styles.small} onClick={() => setStep('changing')}>
                  Change dose or time
                </button>
                <button className={styles.small} onClick={() => setStep('notGiven')}>
                  Not given
                </button>
              </>
            ) : null}
            <button
              className={styles.small}
              onClick={() => {
                setStep('closed')
                setProblem(null)
                setOtherReason('')
                setDose(medication.dose ?? '')
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
