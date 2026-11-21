/*
 * record/_parts/Summary.tsx: the patient at a glance, the doctor's treatment
 * plan for the nurses, and the patient's visits day by day.
 *
 * Why: Anthony's yes (2026-11-16, request 218b) to the proposal (217c):
 *   - A summary at the top, like the side panel big systems keep in view
 *     (Epic's Storyboard): conditions, current medicines, the last
 *     diagnosis and the last vital signs, so the history is read in seconds.
 *   - The doctor's latest treatment plan at the top for the nurses, so "when
 *     I forward it to the nurses... they will follow the treatment plan".
 *   - Visits by day: each day's diagnosis, what was done, and that day's
 *     notes when the day is opened.
 *
 * Everything here is read from the record already loaded. Nothing is saved.
 *
 * Never: show anything the record page has not already loaded for this
 * person (the database decided that).
 */
'use client'

import { HOSPITAL_TIME_ZONE, hospitalDay } from '@/lib/time/zone'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import { NOTE_PARTS } from '@/lib/record/phrases'
import { when, type Consultation, type MedicalRecord } from '@/lib/record/record'

// The newest consultation note still standing (not voided).
function latestNote(record: MedicalRecord): Consultation | null {
  const live = record.consultations
    .filter((note) => !note.voided_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return live[0] ?? null
}

// ===== 1. The patient at a glance =====
export function SummaryCard({ record }: { record: MedicalRecord }) {
  const conditions = record.conditions.filter((c) => !c.voided_at && c.status === 'active')
  const medicines = record.medications.filter((m) => !m.voided_at && m.status === 'active')
  const diagnosis = record.consultations
    .filter((note) => !note.voided_at && note.assessment)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const vitals = record.vitals
    .filter((v) => !v.voided_at)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]

  const vitalWords = vitals
    ? [
        // Blood glucose first (request 235), in the unit it was taken in.
        vitals.blood_glucose !== null && vitals.blood_glucose !== undefined && vitals.glucose_unit
          ? `Glucose ${vitals.blood_glucose} ${vitals.glucose_unit}${
              vitals.glucose_when === 'fasting' ? ' fasting' : ' random'
            }`
          : null,
        vitals.systolic !== null || vitals.diastolic !== null
          ? `BP ${vitals.systolic ?? '?'}/${vitals.diastolic ?? '?'}`
          : null,
        vitals.temperature_c !== null ? `Temp ${vitals.temperature_c}°C` : null,
        vitals.pulse !== null ? `Pulse ${vitals.pulse}` : null,
        vitals.spo2 !== null ? `SpO₂ ${vitals.spo2}%` : null,
        vitals.weight_kg !== null ? `${vitals.weight_kg} kg` : null,
        vitals.pain_score !== null && vitals.pain_score !== undefined
          ? `Pain ${vitals.pain_score}/10`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <section className={styles.summary} aria-label="Summary">
      <div>
        <span>Last diagnosis</span>
        <b>{diagnosis?.assessment ?? 'None yet'}</b>
        {diagnosis ? (
          <small>
            {when(diagnosis.created_at)}, {diagnosis.author?.full_name ?? 'staff'}
          </small>
        ) : null}
      </div>
      <div>
        <span>On medicines</span>
        <b>{medicines.length ? medicines.map((m) => m.medicine).join(', ') : 'None'}</b>
      </div>
      <div>
        <span>Conditions</span>
        <b>{conditions.length ? conditions.map((c) => c.name).join(', ') : 'None recorded'}</b>
      </div>
      <div>
        <span>Last vital signs</span>
        <b>{vitalWords || 'None yet'}</b>
        {vitals ? <small>{when(vitals.recorded_at)}</small> : null}
      </div>
    </section>
  )
}

// ===== 2. The doctor's treatment plan, for the nurses =====
export function PlanBanner({ record }: { record: MedicalRecord }) {
  const note = latestNote(record)
  if (!note?.plan) return null
  return (
    <section className={styles.planBanner} aria-label="Treatment plan">
      <span>Treatment plan</span>
      <p className={styles.note}>{note.plan}</p>
      <small>
        {note.author?.full_name ?? 'Doctor'}, {when(note.created_at)}
        {note.assessment ? ` · Diagnosis: ${note.assessment}` : ''}
      </small>
    </section>
  )
}

// ===== 3. Visits, day by day =====
type Day = {
  key: string
  label: string
  notes: Consultation[]
  nursing: MedicalRecord['nursingNotes']
  vitals: number
  doses: number
}

// The day, by the hospital's clock (request 226a).
function dayKey(isoTime: string): string {
  return hospitalDay(isoTime)
}

function daysOf(record: MedicalRecord): Day[] {
  const days = new Map<string, Day>()
  const dayFor = (isoTime: string) => {
    const key = dayKey(isoTime)
    if (!days.has(key)) {
      days.set(key, {
        key,
        label: new Date(isoTime).toLocaleDateString('en-GB', {
          timeZone: HOSPITAL_TIME_ZONE,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        notes: [],
        nursing: [],
        vitals: 0,
        doses: 0,
      })
    }
    return days.get(key) as Day
  }
  for (const note of record.consultations.filter((n) => !n.voided_at))
    dayFor(note.created_at).notes.push(note)
  for (const note of record.nursingNotes.filter((n) => !n.voided_at))
    dayFor(note.created_at).nursing.push(note)
  for (const vitals of record.vitals.filter((v) => !v.voided_at))
    dayFor(vitals.recorded_at).vitals += 1
  for (const dose of record.doses.filter((d) => !d.voided_at)) dayFor(dose.given_at).doses += 1
  return [...days.values()].sort((a, b) => b.key.localeCompare(a.key))
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export function VisitsSection({ record }: { record: MedicalRecord }) {
  const days = daysOf(record)
  return (
    <Section title="Visits by day" count={days.length}>
      {days.length === 0 ? <EmptyLine text="Nothing recorded yet." /> : null}
      {days.map((day) => {
        const diagnoses = day.notes.map((n) => n.assessment).filter(Boolean)
        const done = [
          day.notes.length ? plural(day.notes.length, 'consultation', 'consultations') : null,
          day.vitals ? plural(day.vitals, 'vital signs', 'vital signs') : null,
          day.doses ? plural(day.doses, 'dose given', 'doses given') : null,
          day.nursing.length ? plural(day.nursing.length, 'nursing note', 'nursing notes') : null,
        ].filter(Boolean)
        return (
          <details key={day.key} className={styles.day}>
            <summary>
              <b>{day.label}</b>
              <small>
                {diagnoses.length ? `${diagnoses.join('; ')} · ` : ''}
                {done.join(', ')}
              </small>
            </summary>
            {day.notes.map((note) => (
              <div key={`c${note.id}`} className={styles.dayNote}>
                <b>
                  {note.title ? `${note.title} · ` : ''}
                  {when(note.created_at)}, {note.author?.full_name ?? 'staff'}
                </b>
                <dl className={styles.consult}>
                  {NOTE_PARTS.filter((part) => note[part.key]).map((part) => (
                    <div key={part.key}>
                      <dt>{part.label}</dt>
                      <dd className={styles.note}>{note[part.key]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            {day.nursing.map((note) => (
              <div key={`n${note.id}`} className={styles.dayNote}>
                <b>
                  Nursing note{note.title ? `: ${note.title}` : ''} · {when(note.created_at)}
                </b>
                <p className={styles.note}>{note.note}</p>
              </div>
            ))}
          </details>
        )
      })}
    </Section>
  )
}
