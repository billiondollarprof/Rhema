/*
 * app/patients/_parts/PharmacyMedicines.tsx: the medicines a patient has
 * taken, on the patient's screen, for the Pharmacy.
 *
 * Why: Anthony, 2026-11-12: "so the pharmacist will easily see, this person
 * has been taking this medicine... the ones they are currently taking, the
 * one they suspended, the one they have stopped. They don't go checking their
 * books, they just check the computer."
 *
 * Three groups: taking now, suspended, stopped. A medicine that was
 * dispensed or written on the record is here automatically.
 *
 * Dispense (request 240, 2026-11-23): on a medicine taken now, the Pharmacy
 * hands a supply to the ward, choosing how many doses (the rest of the
 * course, to start). Each line shows doses given by the nurses, dispensed
 * and left. Every Dispense is in the history and the activity log.
 *
 * Never: show a diagnosis, a note, a reading or an allergy.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './patients.module.css'
import {
  dispenseFromChart,
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
  // A fresh read after a Dispense.
  const [round, setRound] = useState(0)

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
  }, [client, staffId, patientId, round])

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
                    {line.doses || line.dispensed ? (
                      <small>
                        {[
                          line.doses ? `${line.doses} doses in all` : null,
                          `Given ${line.given ?? 0}`,
                          `Dispensed ${line.dispensed ?? 0}`,
                          line.doses
                            ? `Left ${Math.max(line.doses - (line.dispensed ?? 0), 0)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    ) : null}
                    {line.status === 'active' ? (
                      <DispenseButton
                        client={client}
                        line={line}
                        onDone={() => setRound((n) => n + 1)}
                      />
                    ) : null}
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

// ===== Dispense: how many doses, then Dispense =====
function DispenseButton({
  client,
  line,
  onDone,
}: {
  client: SupabaseClient
  line: PharmacyMedicine
  onDone: () => void
}) {
  // The rest of the course to start, or 1 when the course has no number.
  const left = line.doses ? Math.max(line.doses - (line.dispensed ?? 0), 1) : 1
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(String(left))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function dispense() {
    const doses = Number(count)
    if (!(doses >= 1 && doses <= 1000)) {
      setProblem('Type how many doses, from 1.')
      return
    }
    setBusy(true)
    const failed = await dispenseFromChart(client, line.id, doses)
    setBusy(false)
    setProblem(failed)
    if (!failed) {
      setOpen(false)
      setSaved(`Dispensed ${doses} ${doses === 1 ? 'dose' : 'doses'}.`)
      onDone()
    }
  }

  if (!open)
    return (
      <span className={styles.dispenseRow}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={() => {
            setCount(String(left))
            setSaved(null)
            setOpen(true)
          }}
        >
          Dispense
        </button>
        {saved ? <small className={styles.muted}>{saved}</small> : null}
      </span>
    )
  return (
    <span className={styles.dispenseRow}>
      <label htmlFor={`dispense-${line.id}`}>How many doses</label>
      <input
        id={`dispense-${line.id}`}
        className={`${styles.input} ${styles.dispenseInput}`}
        inputMode="numeric"
        value={count}
        onChange={(event) => setCount(event.target.value.replace(/\D/g, '').slice(0, 4))}
      />
      <button
        type="button"
        className={`${styles.button} ${styles.primary}`}
        disabled={busy}
        onClick={dispense}
      >
        {busy ? 'Saving…' : 'Dispense'}
      </button>
      <button
        type="button"
        className={styles.button}
        disabled={busy}
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
      {problem ? <small className={styles.muted}>{problem}</small> : null}
    </span>
  )
}
