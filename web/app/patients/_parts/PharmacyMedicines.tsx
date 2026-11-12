/*
 * app/patients/_parts/PharmacyMedicines.tsx: the medicines a patient has
 * taken, on the patient's screen, for the Pharmacy.
 *
 * Why: Anthony, 2026-11-12: "so the pharmacist will easily see, this person
 * has been taking this medicine... the ones they are currently taking, the
 * one they suspended, the one they have stopped. They don't go checking their
 * books, they just check the computer."
 *
 * Read only. Three groups: taking now, suspended, stopped. A medicine that
 * was dispensed or written on the record is here automatically.
 *
 * Never: show a diagnosis, a note, a reading or an allergy.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './patients.module.css'
import {
  knownPatientMedicines,
  loadPatientMedicines,
  type PharmacyMedicine,
} from '@/lib/pharmacy/patientMedicines'

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const GROUPS: { status: PharmacyMedicine['status']; title: string }[] = [
  { status: 'active', title: 'Taking now' },
  { status: 'suspended', title: 'Suspended' },
  { status: 'stopped', title: 'Stopped' },
]

export default function PharmacyMedicines({
  client,
  staffId,
  patientId,
}: {
  client: SupabaseClient
  staffId: string
  patientId: number
}) {
  const [medicines, setMedicines] = useState<PharmacyMedicine[] | null>(() =>
    knownPatientMedicines(staffId, patientId),
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    loadPatientMedicines(client, staffId, patientId).then((fresh) => {
      if (!current) return
      if (fresh) {
        setMedicines(fresh)
        setFailed(false)
      } else setFailed(true)
    })
    return () => {
      current = false
    }
  }, [client, staffId, patientId])

  return (
    <div className={styles.factGroup}>
      <h3>Medicines this patient has taken</h3>
      {medicines === null ? (
        <p className={styles.muted}>
          {failed ? 'Could not load. Check the internet and try again.' : 'Loading…'}
        </p>
      ) : medicines.length === 0 ? (
        <p className={styles.muted}>No medicines recorded for this patient yet.</p>
      ) : (
        GROUPS.map((group) => {
          const lines = medicines.filter((line) => line.status === group.status)
          if (lines.length === 0) return null
          return (
            <div key={group.status}>
              <p>
                <b>{group.title}</b> ({lines.length})
              </p>
              <ul className={styles.medList}>
                {lines.map((line) => (
                  <li key={line.id}>
                    <b>{line.medicine}</b>
                    <span>
                      {[line.dose, line.how_often].filter(Boolean).join(' · ') || 'No dose written'}
                    </span>
                    <small className={styles.muted}>
                      Started {day(line.started)}
                      {line.status !== 'active' && line.last_changed_at
                        ? ` · ${group.status === 'stopped' ? 'Stopped' : 'Suspended'} ${day(line.last_changed_at)}${line.last_reason ? `: ${line.last_reason}` : ''}`
                        : ''}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          )
        })
      )}
    </div>
  )
}
