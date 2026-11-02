/*
 * app/lab/_parts/PatientPicker.tsx: find the patient a lab request or a
 * walk in result is for, by name, patient number or phone.
 *
 * Why: Request lab can start from Home (no patient yet) or from the
 * patient's record (patient already known, so this is skipped). Before
 * anything is typed it lists the newest patients, so the list is never
 * empty (Anthony, 2026-11-02: "doesn't populate the patients").
 *
 * Never: show more than name, number and age here.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './lab.module.css'
import PersonBadge from '@/components/auth/PersonBadge'
import { ageFrom } from '@/lib/patients/age'
import { searchPatients, type PatientResult } from '@/lib/patients/patients'

export default function PatientPicker({
  client,
  onPick,
}: {
  client: SupabaseClient
  onPick: (patient: PatientResult) => void
}) {
  const [typed, setTyped] = useState('')
  const [found, setFound] = useState<PatientResult[]>([])

  // Search as the person types, after a short pause. Nothing typed yet:
  // the newest patients.
  useEffect(() => {
    if (typed.trim().length === 1) return
    let current = true
    const timer = window.setTimeout(() => {
      searchPatients(client, typed).then((rows) => {
        if (current) setFound(rows.slice(0, 8))
      })
    }, 250)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [client, typed])

  const shown = typed.trim().length === 1 ? [] : found

  return (
    <div className={styles.card}>
      <label className={styles.label} htmlFor="pick-patient">
        Patient
      </label>
      <input
        id="pick-patient"
        className={styles.input}
        placeholder="Name, patient number or phone"
        value={typed}
        autoFocus
        onChange={(event) => setTyped(event.target.value)}
      />
      <div className={styles.list}>
        {shown.map((patient) => (
          <button key={patient.id} className={styles.person} onClick={() => onPick(patient)}>
            <PersonBadge name={patient.full_name} />
            <span className={styles.personText}>
              <b>{patient.full_name}</b>
              <small>
                {patient.patient_number} · {ageFrom(patient.date_of_birth)}
              </small>
            </span>
          </button>
        ))}
      </div>
      {typed.trim().length >= 2 && shown.length === 0 ? (
        <p className={styles.muted}>No patient found yet. Keep typing.</p>
      ) : null}
    </div>
  )
}
