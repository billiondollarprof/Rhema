/*
 * record/_parts/Observations.tsx: vital signs, nursing notes and doctor's
 * consultation notes.
 *
 * Why: the demo's "Observations" and "Consultation" tabs. The nurse takes
 * the readings and writes the notes at the nursing station, and the doctor
 * writes the consultation in the consultant room.
 *
 * Sections in this file:
 *   1. Vital signs: the newest readings first, and Take new readings.
 *   2. Nursing notes: one short note per line, and Add a note.
 *   3. Consultation notes: complaint, findings, assessment and plan.
 *
 * Never: change a saved reading or note. A wrong one is voided with a
 * reason and written again, so the record shows what was corrected.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import {
  addLine,
  loadVitalMeasures,
  saveVitalMeasure,
  when,
  type MedicalRecord,
  type VitalMeasure,
  type Vitals,
} from '@/lib/record/record'
import { recall, remember } from '@/lib/cache/memory'

type Props = {
  client: SupabaseClient
  staffId: string
  patientId: number
  record: MedicalRecord
  reload: () => void
}

const voidedOf = (line: {
  voided_at: string | null
  void_reason: string | null
  voider: { full_name: string } | null
}) => (line.voided_at ? { reason: line.void_reason, by: line.voider?.full_name ?? null } : null)

// ===== 1. Vital signs =====
// Each box: the column it fills, its label, and its unit.
const READINGS: { key: keyof Vitals; label: string; unit: string }[] = [
  { key: 'temperature_c', label: 'Temperature', unit: ' °C' },
  { key: 'pulse', label: 'Pulse', unit: ' bpm' },
  { key: 'breathing_rate', label: 'Breathing', unit: '/min' },
  { key: 'spo2', label: 'Oxygen (SpO2)', unit: '%' },
  { key: 'weight_kg', label: 'Weight', unit: ' kg' },
  { key: 'height_cm', label: 'Height', unit: ' cm' },
]

function VitalsReadings({ vitals }: { vitals: Vitals }) {
  const shown: [string, string][] = []
  if (vitals.systolic !== null || vitals.diastolic !== null) {
    shown.push(['Blood pressure', `${vitals.systolic ?? '?'}/${vitals.diastolic ?? '?'} mmHg`])
  }
  for (const reading of READINGS) {
    const value = vitals[reading.key]
    if (value !== null && value !== undefined)
      shown.push([reading.label, `${value}${reading.unit}`])
  }
  return (
    <dl className={styles.readings}>
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function VitalsSection({ client, staffId, patientId, record, reload }: Props) {
  const empty = {
    systolic: '',
    diastolic: '',
    temperature_c: '',
    pulse: '',
    breathing_rate: '',
    spo2: '',
    weight_kg: '',
    height_cm: '',
  }
  const [adding, setAdding] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(empty)
  const [problem, setProblem] = useState<string | null>(null)
  // "Other" vital signs: the measures this person has typed before, and the
  // standard ones, each with a box (Anthony, 2026-11-11).
  const [measures, setMeasures] = useState<VitalMeasure[]>(
    () => recall<VitalMeasure[]>(staffId, 'vital-measures') ?? [],
  )
  const [extraValues, setExtraValues] = useState<Record<number, string>>({})
  const [addingOther, setAddingOther] = useState(false)
  const [otherName, setOtherName] = useState('')
  const [otherUnit, setOtherUnit] = useState('')

  useEffect(() => {
    let current = true
    loadVitalMeasures(client).then((fresh) => {
      if (!current || !fresh) return
      remember(staffId, 'vital-measures', fresh)
      setMeasures(fresh)
    })
    return () => {
      current = false
    }
  }, [client, staffId])

  async function addOther() {
    if (otherName.trim().length < 2) {
      setProblem('Type the name of the vital sign.')
      return
    }
    const id = await saveVitalMeasure(client, otherName.trim(), otherUnit.trim() || null)
    if (id === null) {
      setProblem('It could not be added. Check the internet and try again.')
      return
    }
    const fresh = await loadVitalMeasures(client)
    if (fresh) {
      remember(staffId, 'vital-measures', fresh)
      setMeasures(fresh)
    }
    setAddingOther(false)
    setOtherName('')
    setOtherUnit('')
    setProblem(null)
  }

  async function add() {
    // Turn each box into a number, or leave it out when it is empty.
    const numbers: Record<string, number | null> = {}
    for (const [key, text] of Object.entries(values)) {
      numbers[key] = text.trim() === '' ? null : Number(text)
      if (Number.isNaN(numbers[key])) {
        setProblem('Use numbers only.')
        return
      }
    }
    const extras: { measure: VitalMeasure; value: number }[] = []
    for (const measure of measures) {
      const text = (extraValues[measure.id] ?? '').trim()
      if (text === '') continue
      const value = Number(text)
      if (Number.isNaN(value) || Math.abs(value) > 100000) {
        setProblem('Use numbers only.')
        return
      }
      extras.push({ measure, value })
    }
    const hasFixed = Object.values(numbers).some((n) => n !== null)
    if (!hasFixed && extras.length === 0) {
      setProblem('Fill in at least one reading.')
      return
    }
    if (hasFixed) {
      const result = await addLine(client, 'vital_signs', {
        patient_id: patientId,
        ...numbers,
        recorded_by: staffId,
      })
      if (result) {
        setProblem(result)
        return
      }
    }
    for (const { measure, value } of extras) {
      const result = await addLine(client, 'vital_extras', {
        patient_id: patientId,
        measure_id: measure.id,
        name: measure.name,
        unit: measure.unit,
        value,
        recorded_by: staffId,
      })
      if (result) {
        setProblem(result)
        return
      }
    }
    setAdding(false)
    setValues(empty)
    setExtraValues({})
    setProblem(null)
    reload()
  }

  const box = (key: string, label: string, placeholder: string) => (
    <div className={styles.field} key={key}>
      <label htmlFor={`vit-${key}`}>{label}</label>
      <input
        id={`vit-${key}`}
        className={styles.input}
        inputMode="decimal"
        placeholder={placeholder}
        value={values[key]}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <Section
      title="Vital signs"
      count={
        record.vitals.filter((v) => !v.voided_at).length +
        record.vitalExtras.filter((v) => !v.voided_at).length
      }
      open
    >
      {record.vitals.length === 0 && record.vitalExtras.length === 0 ? (
        <EmptyLine text="No readings taken yet." />
      ) : null}
      {record.vitals.map((vitals) => (
        <Line
          key={vitals.id}
          what={<b>{when(vitals.recorded_at)}</b>}
          meta={`Taken by ${vitals.recorder?.full_name ?? 'staff'}`}
          voided={voidedOf(vitals)}
          voidable={{ client, table: 'vital_signs', id: vitals.id, staffId, onDone: reload }}
        >
          <VitalsReadings vitals={vitals} />
        </Line>
      ))}
      {record.vitalExtras.map((extra) => (
        <Line
          key={`extra-${extra.id}`}
          what={
            <b>
              {extra.name}: {extra.value}
              {extra.unit ? ` ${extra.unit}` : ''}
            </b>
          }
          meta={`Taken by ${extra.recorder?.full_name ?? 'staff'}, ${when(extra.recorded_at)}`}
          voided={voidedOf(extra)}
          voidable={{ client, table: 'vital_extras', id: extra.id, staffId, onDone: reload }}
        />
      ))}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.fields}>
            {box('systolic', 'BP top (systolic)', 'e.g. 120')}
            {box('diastolic', 'BP bottom (diastolic)', 'e.g. 80')}
            {box('temperature_c', 'Temperature °C', 'e.g. 36.8')}
            {box('pulse', 'Pulse (bpm)', 'e.g. 76')}
            {box('breathing_rate', 'Breathing (/min)', 'e.g. 16')}
            {box('spo2', 'Oxygen SpO2 (%)', 'e.g. 98')}
            {box('weight_kg', 'Weight (kg)', 'e.g. 68')}
            {box('height_cm', 'Height (cm)', 'e.g. 170')}
            {measures.map((measure) => (
              <div className={styles.field} key={`measure-${measure.id}`}>
                <label htmlFor={`vit-x-${measure.id}`}>
                  {measure.name}
                  {measure.unit ? ` (${measure.unit})` : ''}
                </label>
                <input
                  id={`vit-x-${measure.id}`}
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="Number"
                  value={extraValues[measure.id] ?? ''}
                  onChange={(e) => setExtraValues({ ...extraValues, [measure.id]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {/* A vital sign that has no box: type its name once; it stays here
              for next time. */}
          {addingOther ? (
            <div className={styles.fields}>
              <div className={styles.field}>
                <label htmlFor="vit-other-name">Name of the vital sign</label>
                <input
                  id="vit-other-name"
                  className={styles.input}
                  placeholder="e.g. Blood sugar"
                  maxLength={60}
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="vit-other-unit">Unit (optional)</label>
                <input
                  id="vit-other-unit"
                  className={styles.input}
                  placeholder="e.g. mmol/L"
                  maxLength={20}
                  value={otherUnit}
                  onChange={(e) => setOtherUnit(e.target.value)}
                />
              </div>
              <div className={styles.actions}>
                <button className={`${styles.small} ${styles.primary}`} onClick={addOther}>
                  Add vital sign
                </button>
                <button className={styles.small} onClick={() => setAddingOther(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              <button className={styles.small} onClick={() => setAddingOther(true)}>
                + Other vital sign
              </button>
            </div>
          )}
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Save readings
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Take new readings
          </button>
        </div>
      )}
    </Section>
  )
}

// ===== 2. Nursing notes =====
export function NursingNotesSection({ client, staffId, patientId, record, reload }: Props) {
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  async function add() {
    if (!note.trim()) {
      setProblem('Write the note first.')
      return
    }
    const result = await addLine(client, 'nursing_notes', {
      patient_id: patientId,
      note: note.trim(),
      written_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setAdding(false)
      setNote('')
      setProblem(null)
      reload()
    }
  }

  return (
    <Section title="Nursing notes" count={record.nursingNotes.filter((n) => !n.voided_at).length}>
      {record.nursingNotes.length === 0 ? <EmptyLine text="No nursing notes yet." /> : null}
      {record.nursingNotes.map((line) => (
        <Line
          key={line.id}
          what={<span className={styles.note}>{line.note}</span>}
          meta={`${line.author?.full_name ?? 'Staff'}, ${when(line.created_at)}`}
          voided={voidedOf(line)}
          voidable={{ client, table: 'nursing_notes', id: line.id, staffId, onDone: reload }}
        />
      ))}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="nursing-note">Note</label>
            <textarea
              id="nursing-note"
              className={styles.input}
              maxLength={4000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Save note
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Add a note
          </button>
        </div>
      )}
    </Section>
  )
}

// ===== 3. Consultation notes =====
const CONSULT_PARTS = [
  { key: 'complaint', label: 'Complaint', hint: 'What the patient came with' },
  { key: 'findings', label: 'Findings', hint: 'What the examination found' },
  { key: 'assessment', label: 'Assessment', hint: 'What you think it is' },
  { key: 'plan', label: 'Plan', hint: 'Tests, treatment, next visit' },
] as const

// Whoever has a consulting room writes or voids a consultation note, a
// doctor, nurse or matron (Anthony, 2026-11-10); everybody with the record
// reads them. The database decides it again.
export function ConsultationsSection({
  client,
  staffId,
  patientId,
  record,
  reload,
  canWrite,
}: Props & { canWrite: boolean }) {
  const empty = { complaint: '', findings: '', assessment: '', plan: '' }
  const [adding, setAdding] = useState(false)
  const [parts, setParts] = useState<Record<string, string>>(empty)
  const [problem, setProblem] = useState<string | null>(null)

  async function add() {
    const values: Record<string, string | null> = {}
    for (const part of CONSULT_PARTS) values[part.key] = parts[part.key].trim() || null
    if (Object.values(values).every((v) => v === null)) {
      setProblem('Write at least one part.')
      return
    }
    const result = await addLine(client, 'consultation_notes', {
      patient_id: patientId,
      ...values,
      written_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setAdding(false)
      setParts(empty)
      setProblem(null)
      reload()
    }
  }

  return (
    <Section
      title="Consultation notes"
      count={record.consultations.filter((c) => !c.voided_at).length}
    >
      {record.consultations.length === 0 ? <EmptyLine text="No consultations yet." /> : null}
      {record.consultations.map((line) => (
        <Line
          key={line.id}
          what={<b>{when(line.created_at)}</b>}
          meta={`Written by ${line.author?.full_name ?? 'staff'}`}
          voided={voidedOf(line)}
          voidable={
            canWrite
              ? { client, table: 'consultation_notes', id: line.id, staffId, onDone: reload }
              : undefined
          }
        >
          <dl className={styles.consult}>
            {CONSULT_PARTS.filter((part) => line[part.key]).map((part) => (
              <div key={part.key}>
                <dt>{part.label}</dt>
                <dd className={styles.note}>{line[part.key]}</dd>
              </div>
            ))}
          </dl>
        </Line>
      ))}
      {adding ? (
        <div className={styles.form}>
          {CONSULT_PARTS.map((part) => (
            <div className={styles.field} key={part.key}>
              <label htmlFor={`consult-${part.key}`}>{part.label}</label>
              <textarea
                id={`consult-${part.key}`}
                className={styles.input}
                placeholder={part.hint}
                maxLength={4000}
                value={parts[part.key]}
                onChange={(e) => setParts({ ...parts, [part.key]: e.target.value })}
              />
            </div>
          ))}
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Save consultation
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : canWrite ? (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Write a consultation
          </button>
        </div>
      ) : null}
    </Section>
  )
}
