/*
 * record/_parts/Medications.tsx: current medications and doses given.
 *
 * Why: the hospital's note ("EMR where the records of their medications
 * they're currently taking is; this is for the nursing station") and
 * Anthony, 2026-10-29: a medicine is active (green), suspended (orange) or
 * stopped (red); every change says who, when and why; each dose given has
 * the exact time and the nurse who gave it.
 *
 * Sections in this file:
 *   1. Medications: the list, Add a medicine, and per medicine: Give dose,
 *      Suspend, Resume, Stop, Void.
 *   2. Doses given: newest first, and Add a dose not on the list.
 *
 * Never: change a medicine's status without a reason, or record a dose in
 * another person's name (the database refuses both).
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import MedicinePicker from '@/components/medicines/MedicinePicker'
import { medicineWords } from '@/lib/medicines/medicines'
import ReasonForm from './ReasonForm'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import {
  MEDICATION_STATUS,
  addLine,
  changeMedicationStatus,
  editMedication,
  when,
  type MedicalRecord,
  type Medication,
  type MedicationStatus,
} from '@/lib/record/record'

type Props = {
  client: SupabaseClient
  staffId: string
  patientId: number
  record: MedicalRecord
  reload: () => void
}

// "now" in the form a datetime box expects (local time, to the minute).
function localNow() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

// ===== 1. Medications =====
export function MedicationsSection({ client, staffId, patientId, record, reload }: Props) {
  const [adding, setAdding] = useState(false)
  // The medicine and its strength come from the picker.
  const [medicine, setMedicine] = useState('')
  const [strength, setStrength] = useState('')
  const [dose, setDose] = useState('')
  const [howOften, setHowOften] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  // Active first, then suspended, then stopped, voided last.
  const order: Record<MedicationStatus, number> = { active: 0, suspended: 1, stopped: 2 }
  const sorted = [...record.medications].sort(
    (a, b) =>
      Number(Boolean(a.voided_at)) - Number(Boolean(b.voided_at)) ||
      order[a.status] - order[b.status],
  )
  const live = record.medications.filter((m) => !m.voided_at && m.status !== 'stopped').length

  async function add() {
    if (medicine.trim().length < 2) {
      setProblem('Choose the medicine.')
      return
    }
    const result = await addLine(client, 'patient_medications', {
      patient_id: patientId,
      medicine: medicineWords(medicine.trim(), strength.trim()),
      dose: dose.trim() || null,
      how_often: howOften.trim() || null,
      added_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setAdding(false)
      setMedicine('')
      setStrength('')
      setDose('')
      setHowOften('')
      setProblem(null)
      reload()
    }
  }

  return (
    <Section title="Current medications" count={live} open>
      {sorted.length === 0 ? <EmptyLine text="No medicines recorded." /> : null}
      {sorted.map((medication) => (
        <MedicationLine
          key={medication.id}
          medication={medication}
          lastChange={record.statusChanges.find((change) => change.medication_id === medication.id)}
          client={client}
          staffId={staffId}
          patientId={patientId}
          reload={reload}
        />
      ))}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.fields}>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="med-name">Medicine</label>
              <MedicinePicker
                client={client}
                staffId={staffId}
                id="med-name"
                name={medicine}
                strength={strength}
                onChange={(name, picked) => {
                  setMedicine(name)
                  setStrength(picked)
                }}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="med-dose">Dose</label>
              <input
                id="med-dose"
                className={styles.input}
                placeholder="e.g. 500 mg"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="med-often">How often</label>
              <input
                id="med-often"
                className={styles.input}
                placeholder="e.g. Twice daily"
                value={howOften}
                onChange={(e) => setHowOften(e.target.value)}
              />
            </div>
          </div>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Add medicine
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Add a medicine
          </button>
        </div>
      )}
    </Section>
  )
}

function MedicationLine({
  medication,
  lastChange,
  client,
  staffId,
  patientId,
  reload,
}: {
  medication: Medication
  lastChange: MedicalRecord['statusChanges'][number] | undefined
  client: SupabaseClient
  staffId: string
  patientId: number
  reload: () => void
}) {
  const [changing, setChanging] = useState<MedicationStatus | null>(null)
  const [giving, setGiving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(medication.medicine)
  const [newDose, setNewDose] = useState(medication.dose ?? '')
  const [newOften, setNewOften] = useState(medication.how_often ?? '')
  const [dose, setDose] = useState(medication.dose ?? '')
  const [givenAt, setGivenAt] = useState(localNow())
  const [problem, setProblem] = useState<string | null>(null)
  const status = MEDICATION_STATUS[medication.status]

  async function give() {
    const result = await addLine(client, 'medications_given', {
      patient_id: patientId,
      medication_id: medication.id,
      medicine: medication.medicine,
      dose: dose.trim() || null,
      given_at: new Date(givenAt).toISOString(),
      given_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setGiving(false)
      setProblem(null)
      reload()
    }
  }

  async function saveEdit() {
    if (newName.trim().length < 2) {
      setProblem('Type the medicine.')
      return
    }
    const result = await editMedication(client, medication.id, {
      medicine: newName.trim(),
      dose: newDose.trim() || null,
      how_often: newOften.trim() || null,
    })
    if (result) setProblem(result)
    else {
      setEditing(false)
      setProblem(null)
      reload()
    }
  }

  const changeWords =
    lastChange && lastChange.old_status
      ? ` · ${MEDICATION_STATUS[lastChange.new_status].label} by ${lastChange.changer?.full_name ?? 'staff'}, ${when(lastChange.changed_at)}${lastChange.reason ? `: ${lastChange.reason}` : ''}`
      : ''

  return (
    <Line
      what={
        <>
          <b>{medication.medicine}</b>
          <br />
          <span className={styles.muted}>
            {[medication.dose, medication.how_often].filter(Boolean).join(' · ') ||
              'No dose written'}
          </span>
        </>
      }
      status={<span className={`${styles.pill} ${styles[status.colour]}`}>{status.label}</span>}
      meta={`Added by ${medication.author?.full_name ?? 'staff'}, ${when(medication.created_at)}${changeWords}`}
      voided={
        medication.voided_at
          ? { reason: medication.void_reason, by: medication.voider?.full_name ?? null }
          : null
      }
      voidable={{
        client,
        table: 'patient_medications',
        id: medication.id,
        staffId,
        onDone: reload,
      }}
      actions={
        <>
          {medication.status === 'active' ? (
            <button className={`${styles.small} ${styles.primary}`} onClick={() => setGiving(true)}>
              Give dose
            </button>
          ) : null}
          {medication.status === 'active' ? (
            <button className={styles.small} onClick={() => setChanging('suspended')}>
              Suspend
            </button>
          ) : null}
          {medication.status === 'suspended' ? (
            <button className={styles.small} onClick={() => setChanging('active')}>
              Resume
            </button>
          ) : null}
          {medication.status !== 'stopped' ? (
            <button
              className={styles.small}
              onClick={() => {
                setProblem(null)
                setEditing(true)
              }}
            >
              Edit
            </button>
          ) : null}
          {medication.status !== 'stopped' ? (
            <button className={styles.small} onClick={() => setChanging('stopped')}>
              Stop
            </button>
          ) : null}
        </>
      }
      form={
        changing || giving || editing ? (
          <>
            {editing ? (
              <div className={styles.form}>
                <div className={styles.fields}>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor={`edit-name-${medication.id}`}>Medicine</label>
                    <input
                      id={`edit-name-${medication.id}`}
                      className={styles.input}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`edit-dose-${medication.id}`}>Dose</label>
                    <input
                      id={`edit-dose-${medication.id}`}
                      className={styles.input}
                      value={newDose}
                      onChange={(e) => setNewDose(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`edit-often-${medication.id}`}>How often</label>
                    <input
                      id={`edit-often-${medication.id}`}
                      className={styles.input}
                      value={newOften}
                      onChange={(e) => setNewOften(e.target.value)}
                    />
                  </div>
                </div>
                {problem ? <p className={styles.error}>{problem}</p> : null}
                <div className={styles.actions}>
                  <button className={`${styles.small} ${styles.primary}`} onClick={saveEdit}>
                    Save changes
                  </button>
                  <button className={styles.small} onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            {changing ? (
              <ReasonForm
                question={
                  changing === 'suspended'
                    ? `Why suspend ${medication.medicine}?`
                    : changing === 'stopped'
                      ? `Why stop ${medication.medicine}? Stopping is final.`
                      : `Why resume ${medication.medicine}?`
                }
                choices={
                  changing === 'active'
                    ? ['Doctor said to resume', 'Condition improved']
                    : ['Doctor said so', 'Side effects', 'Not needed now', 'Patient refused']
                }
                confirmLabel={
                  changing === 'suspended' ? 'Suspend' : changing === 'stopped' ? 'Stop' : 'Resume'
                }
                onCancel={() => setChanging(null)}
                onConfirm={async (reason) => {
                  const result = await changeMedicationStatus(
                    client,
                    medication.id,
                    changing,
                    reason,
                  )
                  if (!result) {
                    setChanging(null)
                    reload()
                  }
                  return result
                }}
              />
            ) : null}
            {giving ? (
              <div className={styles.form}>
                <div className={styles.fields}>
                  <div className={styles.field}>
                    <label htmlFor={`dose-${medication.id}`}>Dose given</label>
                    <input
                      id={`dose-${medication.id}`}
                      className={styles.input}
                      value={dose}
                      onChange={(e) => setDose(e.target.value)}
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor={`time-${medication.id}`}>Time given</label>
                    <input
                      id={`time-${medication.id}`}
                      className={styles.input}
                      type="datetime-local"
                      max={localNow()}
                      value={givenAt}
                      onChange={(e) => setGivenAt(e.target.value)}
                    />
                  </div>
                </div>
                {problem ? <p className={styles.error}>{problem}</p> : null}
                <div className={styles.actions}>
                  <button className={`${styles.small} ${styles.primary}`} onClick={give}>
                    Record dose
                  </button>
                  <button className={styles.small} onClick={() => setGiving(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null
      }
    />
  )
}

// ===== 2. Doses given =====
export function DosesSection({ client, staffId, patientId, record, reload }: Props) {
  const [adding, setAdding] = useState(false)
  const [medicine, setMedicine] = useState('')
  const [strength, setStrength] = useState('')
  const [dose, setDose] = useState('')
  const [givenAt, setGivenAt] = useState(localNow())
  const [problem, setProblem] = useState<string | null>(null)

  async function add() {
    if (medicine.trim().length < 2) {
      setProblem('Choose the medicine.')
      return
    }
    const result = await addLine(client, 'medications_given', {
      patient_id: patientId,
      medicine: medicineWords(medicine.trim(), strength.trim()),
      dose: dose.trim() || null,
      given_at: new Date(givenAt).toISOString(),
      given_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setAdding(false)
      setMedicine('')
      setStrength('')
      setDose('')
      setProblem(null)
      reload()
    }
  }

  return (
    <Section title="Doses given" count={record.doses.filter((d) => !d.voided_at).length} open>
      {record.doses.length === 0 ? <EmptyLine text="No doses recorded yet." /> : null}
      {record.doses.map((given) => (
        <Line
          key={given.id}
          what={<b>{[given.medicine, given.dose].filter(Boolean).join(' · ')}</b>}
          status={<span className={`${styles.pill} ${styles.grey}`}>{when(given.given_at)}</span>}
          meta={`Given by ${given.giver?.full_name ?? 'staff'}`}
          voided={
            given.voided_at
              ? { reason: given.void_reason, by: given.voider?.full_name ?? null }
              : null
          }
          voidable={{ client, table: 'medications_given', id: given.id, staffId, onDone: reload }}
        />
      ))}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.fields}>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="given-name">Medicine</label>
              <MedicinePicker
                client={client}
                staffId={staffId}
                id="given-name"
                name={medicine}
                strength={strength}
                onChange={(name, picked) => {
                  setMedicine(name)
                  setStrength(picked)
                }}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="given-dose">Dose</label>
              <input
                id="given-dose"
                className={styles.input}
                placeholder="e.g. 1 g"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
              />
            </div>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="given-time">Time given</label>
              <input
                id="given-time"
                className={styles.input}
                type="datetime-local"
                max={localNow()}
                value={givenAt}
                onChange={(e) => setGivenAt(e.target.value)}
              />
            </div>
          </div>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Record dose
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Record a dose not on the list
          </button>
        </div>
      )}
    </Section>
  )
}
