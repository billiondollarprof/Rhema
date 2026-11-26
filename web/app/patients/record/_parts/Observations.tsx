/*
 * record/_parts/Observations.tsx: vital signs and nursing notes. The
 * doctor's consultation note moved to Consultation.tsx (2026-11-16).
 *
 * Why: the demo's "Observations" and "Consultation" tabs. The nurse takes
 * the readings and writes the notes at the nursing station, and the doctor
 * writes the consultation in the consultant room.
 *
 * Sections in this file:
 *   1. Vital signs: the newest readings first, and Take new readings.
 *   2. Nursing notes: one short note per line, and Add a note.
 *
 * Never: change a saved reading or note. A wrong one is voided with a
 * reason and written again, so the record shows what was corrected.
 */
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import { useDraft } from '@/lib/drafts/drafts'
import DraftBack from '@/components/drafts/DraftBack'
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
  stillCorrectable,
} from '@/lib/record/record'
import { recall, remember } from '@/lib/cache/memory'
import SearchSelect from '@/components/options/SearchSelect'
import {
  GLUCOSE_UNITS,
  GLUCOSE_WHEN,
  bmiOf,
  bmiWords,
  glucoseWords,
  rememberNumber,
  usedNumbers,
  vitalsProblem,
  type GlucoseUnit,
  type GlucoseWhen,
} from '@/lib/record/vitals'

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

// ===== 1a. The numbers each box offers, and where its list opens =====
// Anthony, 2026-11-16 (request 212): "pickers + Other on each of the box, so
// they can pick from options without typing." The list opens at the usual
// value; Other types anything outside the list.
export type Range = { from: number; to: number; step: number; start: string; decimals: number }
export const RANGES: Record<string, Range> = {
  systolic: { from: 60, to: 250, step: 2, start: '120', decimals: 0 },
  diastolic: { from: 30, to: 150, step: 2, start: '80', decimals: 0 },
  temperature_c: { from: 34, to: 42, step: 0.1, start: '36.8', decimals: 1 },
  pulse: { from: 30, to: 200, step: 1, start: '76', decimals: 0 },
  breathing_rate: { from: 8, to: 60, step: 1, start: '16', decimals: 0 },
  spo2: { from: 70, to: 100, step: 1, start: '98', decimals: 0 },
  weight_kg: { from: 1, to: 200, step: 0.5, start: '65', decimals: 1 },
  height_cm: { from: 40, to: 220, step: 1, start: '165', decimals: 0 },
  // Request 235 (2026-11-21): pain 0 to 10, and blood glucose in either unit.
  pain_score: { from: 0, to: 10, step: 1, start: '0', decimals: 0 },
  glucose_mmol: { from: 2, to: 33, step: 0.1, start: '5.5', decimals: 1 },
  glucose_mg: { from: 36, to: 600, step: 1, start: '100', decimals: 0 },
}

// ===== 1b. Blood glucose: fasting or random, the unit, then the result =====
// The director, 2026-11-21: "when you click it, it should show whether... the
// patient... is fasting... or random. And the result." The UK unit (mmol/L)
// is chosen first; mg/dL is one tap away.
export type Glucose = { value: string; unit: GlucoseUnit; when: GlucoseWhen | null }
export const EMPTY_GLUCOSE: Glucose = { value: '', unit: 'mmol/L', when: null }

export function GlucoseBox({
  id,
  glucose,
  onChange,
}: {
  id: string
  glucose: Glucose
  onChange: (next: Glucose) => void
}) {
  return (
    <div className={`${styles.field} ${styles.fieldWide} ${styles.glucoseBox}`}>
      <label htmlFor={id}>Blood glucose</label>
      <div className={styles.segments} role="group" aria-label="Fasting or random">
        {GLUCOSE_WHEN.map(([value, words]) => (
          <button
            key={value}
            type="button"
            aria-pressed={glucose.when === value}
            onClick={() => onChange({ ...glucose, when: value })}
          >
            {words}
          </button>
        ))}
      </div>
      <div className={styles.segments} role="group" aria-label="Glucose unit">
        {GLUCOSE_UNITS.map((unit) => (
          <button
            key={unit}
            type="button"
            aria-pressed={glucose.unit === unit}
            onClick={() => onChange({ ...glucose, unit, value: '' })}
          >
            {unit}
          </button>
        ))}
      </div>
      <VitalPick
        key={glucose.unit}
        id={id}
        range={glucose.unit === 'mmol/L' ? RANGES.glucose_mmol : RANGES.glucose_mg}
        value={glucose.value}
        onChange={(value) => onChange({ ...glucose, value })}
      />
    </div>
  )
}

// What is wrong with a glucose, or the three values to save (none when empty).
export function readGlucose(glucose: Glucose):
  | { problem: string }
  | {
      values: { blood_glucose: number; glucose_unit: GlucoseUnit; glucose_when: GlucoseWhen } | null
    } {
  const typed = glucose.value.trim()
  if (!typed) return { values: null }
  const value = Number(typed.replace(',', '.'))
  if (Number.isNaN(value)) return { problem: 'Use numbers only.' }
  if (!glucose.when) return { problem: 'Choose fasting or random for the blood glucose.' }
  return {
    values: { blood_glucose: value, glucose_unit: glucose.unit, glucose_when: glucose.when },
  }
}

// "36.8", "65" (not "65.0"), and so on, from the lowest to the highest.
function numbersOf(range: Range): string[] {
  const found: string[] = []
  const count = Math.round((range.to - range.from) / range.step)
  for (let at = 0; at <= count; at++) {
    const value = range.from + at * range.step
    found.push(String(Number(value.toFixed(range.decimals))))
  }
  return found
}

function VitalsReadings({ vitals }: { vitals: Vitals }) {
  const shown: [string, string][] = []
  // Blood glucose first (request 235: "one of the first things").
  const glucose = glucoseWords(
    vitals.blood_glucose ?? null,
    vitals.glucose_unit ?? null,
    vitals.glucose_when ?? null,
  )
  if (glucose) shown.push(['Blood glucose', glucose.replace(/ glucose/, '')])
  if (vitals.systolic !== null || vitals.diastolic !== null) {
    shown.push(['Blood pressure', `${vitals.systolic ?? '?'}/${vitals.diastolic ?? '?'} mmHg`])
  }
  for (const reading of READINGS) {
    const value = vitals[reading.key]
    if (value !== null && value !== undefined)
      shown.push([reading.label, `${value}${reading.unit}`])
  }
  if (vitals.pain_score !== null && vitals.pain_score !== undefined)
    shown.push(['Pain', `${vitals.pain_score} of 10`])
  const bmi = bmiWords(bmiOf(vitals.weight_kg, vitals.height_cm))
  if (bmi) shown.push(['BMI', bmi.replace('BMI ', '')])
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
    pain_score: '',
  }
  const [adding, setAdding] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(empty)
  const [glucose, setGlucose] = useState<Glucose>(EMPTY_GLUCOSE)
  const [problem, setProblem] = useState<string | null>(null)
  // The box holding a value the database would refuse, shown red (252).
  const [wrongKey, setWrongKey] = useState<string | null>(null)
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
    // Straight to the new box, ready for the number (request 236).
    window.setTimeout(() => {
      const box = document.getElementById(`vit-x-${id}`)
      box?.scrollIntoView({ block: 'center' })
      box?.focus()
    }, 50)
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
    // Blood glucose: fasting or random and its unit go with it (request 235).
    const read = readGlucose(glucose)
    if ('problem' in read) {
      setProblem(read.problem)
      return
    }
    if (read.values) Object.assign(numbers, read.values)
    const hasFixed = Object.values(numbers).some((n) => n !== null)
    if (!hasFixed && extras.length === 0) {
      setProblem('Fill in at least one reading.')
      return
    }
    // A number the database would refuse is named first (request 248).
    const wrong = vitalsProblem(numbers)
    setWrongKey(wrong?.key ?? null)
    if (wrong) {
      setProblem(wrong.words)
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
      // Kept to offer next time, as a bare number (request 236).
      rememberNumber(staffId, measure.id, value)
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
    setGlucose(EMPTY_GLUCOSE)
    setExtraValues({})
    setProblem(null)
    reload()
  }

  const box = (key: string, label: string) => (
    <div className={styles.field} key={key}>
      <label htmlFor={`vit-${key}`}>{label}</label>
      <VitalPick
        id={`vit-${key}`}
        range={RANGES[key]}
        value={values[key]}
        invalid={wrongKey === key}
        onChange={(value) => {
          // Changing the red box takes the red off; it is checked again on Save.
          if (wrongKey === key) setWrongKey(null)
          setValues({ ...values, [key]: value })
        }}
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
          meta={`Taken by ${vitals.signer?.full_name ?? vitals.recorder?.full_name ?? 'staff'}`}
          voided={voidedOf(vitals)}
          voidable={{
            client,
            table: 'vital_signs',
            id: vitals.id,
            staffId,
            onDone: reload,
          }}
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
            <GlucoseBox id="vit-glucose" glucose={glucose} onChange={setGlucose} />
            {box('systolic', 'BP top (systolic)')}
            {box('diastolic', 'BP bottom (diastolic)')}
            {box('temperature_c', 'Temperature °C')}
            {box('pulse', 'Pulse (bpm)')}
            {box('breathing_rate', 'Breathing (/min)')}
            {box('spo2', 'Oxygen SpO2 (%)')}
            {box('weight_kg', 'Weight (kg)')}
            {box('height_cm', 'Height (cm)')}
            {/* BMI, worked out as the weight and height are picked (235). */}
            {bmiWords(bmiOf(Number(values.weight_kg) || null, Number(values.height_cm) || null)) ? (
              <p className={`${styles.fieldWide} ${styles.bmiLine}`}>
                {bmiWords(
                  bmiOf(Number(values.weight_kg) || null, Number(values.height_cm) || null),
                )}
              </p>
            ) : null}
            {box('pain_score', 'Pain (0 to 10)')}
            {measures.map((measure) => (
              <div className={styles.field} key={`measure-${measure.id}`}>
                <label htmlFor={`vit-x-${measure.id}`}>
                  {measure.name}
                  {measure.unit ? ` (${measure.unit})` : ''}
                </label>
                {/* The numbers typed before for this sign to pick from, with
                    Other to type a new one; the first time, a number box. */}
                <ExtraPick
                  id={`vit-x-${measure.id}`}
                  numbers={usedNumbers(staffId, measure.id)}
                  value={extraValues[measure.id] ?? ''}
                  onChange={(value) => setExtraValues({ ...extraValues, [measure.id]: value })}
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
          {/* Every reading as a sheet, full page (request 224). */}
          <Link className={styles.small} href={`/patients/record/sheet/?p=${patientId}&s=vitals`}>
            Open the vital signs sheet
          </Link>
        </div>
      )}
    </Section>
  )
}

// ===== 2. Nursing notes =====
export function NursingNotesSection({ client, staffId, patientId, record, reload }: Props) {
  const [adding, setAdding] = useState(false)
  // A title, then the note (Anthony, 2026-11-16: "let's add title and then
  // the body becomes the note").
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  // The unsaved note, kept 30 minutes on this device (request 227j).
  const draft = useDraft({
    staffId,
    name: `nursing-${patientId}`,
    value: { title, note },
    isEmpty: (typed) => !typed.title.trim() && !typed.note.trim(),
    restore: (typed) => {
      setTitle(typed.title)
      setNote(typed.note)
      setAdding(true)
    },
  })

  async function add() {
    if (!note.trim()) {
      setProblem('Write the note first.')
      return
    }
    const result = await addLine(client, 'nursing_notes', {
      patient_id: patientId,
      title: title.trim() || null,
      note: note.trim(),
      written_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setAdding(false)
      setTitle('')
      setNote('')
      setProblem(null)
      draft.clear()
      reload()
    }
  }

  return (
    <Section title="Nursing notes" count={record.nursingNotes.filter((n) => !n.voided_at).length}>
      {record.nursingNotes.length === 0 ? <EmptyLine text="No nursing notes yet." /> : null}
      {record.nursingNotes.map((line) => (
        <Line
          key={line.id}
          what={
            <span className={styles.note}>
              {line.title ? <b className={styles.noteTitle}>{line.title}</b> : null}
              {line.note}
            </span>
          }
          meta={`${line.author?.full_name ?? 'Staff'}, ${when(line.created_at)}`}
          voided={voidedOf(line)}
          voidable={{
            client,
            table: 'nursing_notes',
            id: line.id,
            staffId,
            onDone: reload,
            // Correct: the same words, ready to fix, for 15 minutes after
            // writing (request 227j); after that only Void.
            onCorrect: stillCorrectable(line.created_at)
              ? () => {
                  setTitle(line.title ?? '')
                  setNote(line.note)
                  setAdding(true)
                }
              : undefined,
          }}
        />
      ))}
      {adding ? (
        <div className={styles.form}>
          {draft.restoredAt ? (
            <DraftBack
              savedAt={draft.restoredAt}
              what="nursing note"
              onContinue={draft.keep}
              onDiscard={() => {
                setTitle('')
                setNote('')
                draft.clear()
              }}
            />
          ) : null}
          <div className={styles.field}>
            <label htmlFor="nursing-title">Title (optional)</label>
            <input
              id="nursing-title"
              className={styles.input}
              maxLength={120}
              placeholder="e.g. Night check"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
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
            <button
              className={styles.small}
              onClick={() => {
                setAdding(false)
                setTitle('')
                setNote('')
                draft.clear()
              }}
            >
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

// ===== One vital sign box: pick a number, or type one with Other =====
// ===== An "Other" vital sign's box (request 236) =====
// A list of the numbers typed before, with Other to type a new one; with
// none yet, a plain number box.
function ExtraPick({
  id,
  numbers,
  value,
  onChange,
}: {
  id: string
  numbers: string[]
  value: string
  onChange: (value: string) => void
}) {
  const [typing, setTyping] = useState(numbers.length === 0)
  if (typing) {
    return (
      <div className={styles.vitalTyping}>
        <input
          id={id}
          className={styles.input}
          inputMode="decimal"
          placeholder="Type the number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {numbers.length ? (
          <button type="button" className={styles.linkButton} onClick={() => setTyping(false)}>
            Back to the list
          </button>
        ) : null}
      </div>
    )
  }
  return (
    <SearchSelect
      id={id}
      value={value}
      placeholder="Choose"
      options={numbers.map((number) => ({ value: number, label: number }))}
      focusSearch={false}
      onChange={onChange}
      onOther={(typed) => {
        if (typed) onChange(typed)
        else setTyping(true)
      }}
    />
  )
}

export function VitalPick({
  id,
  range,
  value,
  onChange,
  invalid = false,
}: {
  id: string
  range: Range
  value: string
  onChange: (value: string) => void
  // A value the database would refuse: the box shows red (request 252).
  invalid?: boolean
}) {
  // Other with nothing typed: a box to type the number in.
  const [typing, setTyping] = useState(false)
  const options = useMemo(
    () => numbersOf(range).map((number) => ({ value: number, label: number })),
    [range],
  )

  if (typing) {
    return (
      <div className={styles.vitalTyping}>
        <input
          id={id}
          className={styles.input}
          inputMode="decimal"
          autoFocus
          aria-invalid={invalid ? 'true' : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className={styles.linkButton} onClick={() => setTyping(false)}>
          Back to the list
        </button>
      </div>
    )
  }
  return (
    <SearchSelect
      id={id}
      value={value}
      placeholder={`e.g. ${range.start}`}
      options={options}
      startAt={range.start}
      focusSearch={false}
      invalid={invalid}
      onChange={onChange}
      onOther={(typed) => {
        if (typed) onChange(typed)
        else setTyping(true)
      }}
    />
  )
}
