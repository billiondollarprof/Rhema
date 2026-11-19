/*
 * app/patients/_parts/TakeVitals.tsx: Take vitals, for the Front Desk, on a
 * patient's details (request 228c).
 *
 * Why: Anthony, 2026-11-19: "front desk used to enter vital signs too... I
 * want you to add a button where it says take vitals. That take vitals is
 * the same vital that will populate the vitals that is inside of the
 * medical record... so doctor can see the vitals that the front desk has
 * taken."
 *
 * How it goes:
 *   1. The same boxes as the nurses' vital signs, with the same pick lists.
 *   2. Save: the reading goes into the patient's vital signs, with the time
 *      and the Front Desk's name added by the database. With no network it
 *      waits on this device and goes when the network is back, as every
 *      reading does.
 *   3. Then "Vital signs saved", with the numbers just taken.
 *
 * Never: show the medical record or anybody else's readings here. The
 * database lets the Front Desk add readings and read back only its own.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './patients.module.css'
import recordStyles from '../record/_parts/record.module.css'
import { RANGES, VitalPick } from '../record/_parts/Observations'
import { addLine } from '@/lib/record/record'

// ===== 1. The boxes, in the nurses' order =====
// label: above the box. name and unit: in the saved line ("Pulse 84 bpm").
const BOXES: { key: string; label: string; name: string; unit: string }[] = [
  { key: 'systolic', label: 'BP top (systolic)', name: 'BP', unit: '' },
  { key: 'diastolic', label: 'BP bottom (diastolic)', name: 'BP', unit: '' },
  { key: 'temperature_c', label: 'Temperature °C', name: 'Temperature', unit: ' °C' },
  { key: 'pulse', label: 'Pulse (bpm)', name: 'Pulse', unit: ' bpm' },
  { key: 'breathing_rate', label: 'Breathing (/min)', name: 'Breathing', unit: '/min' },
  { key: 'spo2', label: 'Oxygen SpO2 (%)', name: 'Oxygen', unit: '%' },
  { key: 'weight_kg', label: 'Weight (kg)', name: 'Weight', unit: ' kg' },
  { key: 'height_cm', label: 'Height (cm)', name: 'Height', unit: ' cm' },
]

const EMPTY: Record<string, string> = Object.fromEntries(BOXES.map((box) => [box.key, '']))

// ===== 2. The saved reading, in words: "BP 120/80 mmHg", "Pulse 80 bpm" =====
function savedWords(values: Record<string, string>): string[] {
  const words: string[] = []
  if (values.systolic || values.diastolic) {
    words.push(`BP ${values.systolic || '?'}/${values.diastolic || '?'} mmHg`)
  }
  for (const box of BOXES) {
    if (box.key === 'systolic' || box.key === 'diastolic') continue
    if (values[box.key]) words.push(`${box.name} ${values[box.key]}${box.unit}`)
  }
  return words
}

type Props = {
  client: SupabaseClient
  staffId: string
  patientId: number
  patientName: string
  onClose: () => void
}

export default function TakeVitals({ client, staffId, patientId, patientName, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[] | null>(null)

  // ===== 3. Save =====
  async function save() {
    // Each box becomes a number, or is left out when it is empty.
    const numbers: Record<string, number | null> = {}
    for (const box of BOXES) {
      const text = values[box.key].trim()
      numbers[box.key] = text === '' ? null : Number(text)
      if (Number.isNaN(numbers[box.key])) {
        setProblem('Use numbers only.')
        return
      }
    }
    if (Object.values(numbers).every((number) => number === null)) {
      setProblem('Fill in at least one reading.')
      return
    }
    setBusy(true)
    setProblem(null)
    const result = await addLine(client, 'vital_signs', {
      patient_id: patientId,
      ...numbers,
      recorded_by: staffId,
    })
    setBusy(false)
    if (result) {
      setProblem(result)
      return
    }
    setSaved(savedWords(values))
    setValues(EMPTY)
  }

  // ===== 4. Saved: the numbers just taken =====
  if (saved) {
    return (
      <section className={styles.card} aria-label="Vital signs saved">
        <div className={styles.ok}>
          <b>Vital signs saved for {patientName}</b>
        </div>
        <p>{saved.join(' · ')}</p>
        <p className={styles.muted}>The doctor and the nurses see them in the medical record.</p>
        <div className={styles.buttons}>
          <button className={`${styles.button} ${styles.primary}`} onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    )
  }

  // ===== 5. The form =====
  return (
    <section className={styles.card} aria-label="Take vitals">
      <div>
        <b>Take vitals for {patientName}</b>
        <p className={styles.muted}>Fill in what you measured. Leave the rest empty.</p>
      </div>
      <div className={recordStyles.fields}>
        {BOXES.map((box) => (
          <div className={recordStyles.field} key={box.key}>
            <label htmlFor={`desk-vit-${box.key}`}>{box.label}</label>
            <VitalPick
              id={`desk-vit-${box.key}`}
              range={RANGES[box.key]}
              value={values[box.key]}
              onChange={(value) => {
                setValues({ ...values, [box.key]: value })
                setProblem(null)
              }}
            />
          </div>
        ))}
      </div>
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.buttons}>
        <button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save vital signs'}
        </button>
        <button className={styles.button} disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
    </section>
  )
}
