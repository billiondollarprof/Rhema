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
 * Request 247 (2026-11-24: "the pharmacy needs to see [the] medicine chart
 * as nurses but with a dispense button in place of the given button"): the
 * medicines taken now show as the nurses' chart (medicine, last given, next
 * due) with Dispense where the nurses have Given, and Returned for doses
 * brought back to the store (not charged: the bill counts doses given).
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
  returnToStore,
  type PharmacyMedicine,
} from '@/lib/pharmacy/patientMedicines'
import { isLate, nextDue } from '@/lib/record/chart'
import type { DoseGiven, Medication } from '@/lib/record/record'
import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'

// "14:05 today" or "23 Nov, 14:05".
const at = (iso: string) => {
  const date = new Date(iso)
  const sameDay =
    date.toLocaleDateString('en-GB', { timeZone: HOSPITAL_TIME_ZONE }) ===
    new Date().toLocaleDateString('en-GB', { timeZone: HOSPITAL_TIME_ZONE })
  return date.toLocaleString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    ...(sameDay ? {} : { day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  })
}

// The next dose, worked out the same way as the nurses' chart.
function dueOf(line: PharmacyMedicine): Date | 'now' | null {
  const medication = { how_often: line.how_often } as Medication
  const last = line.last_given_at ? ({ given_at: line.last_given_at } as DoseGiven) : null
  return nextDue(medication, last)
}

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
                    {/* Taking now: the nurses' chart columns (request 247). */}
                    {line.status === 'active' ? (
                      <span className={styles.chartLine}>
                        <span>
                          <small>Last given</small>
                          {line.last_given_at ? at(line.last_given_at) : 'Not yet'}
                        </span>
                        <span className={isLate(dueOf(line)) ? styles.chartLate : undefined}>
                          <small>Next due</small>
                          {(() => {
                            const due = dueOf(line)
                            return due === 'now'
                              ? 'Now'
                              : due
                                ? at(due.toISOString())
                                : 'When needed'
                          })()}
                        </span>
                      </span>
                    ) : null}
                    {line.doses || line.dispensed || line.given ? (
                      <small>
                        {[
                          line.doses ? `${line.doses} doses in all` : null,
                          `Given ${line.given ?? 0}`,
                          `Dispensed ${line.dispensed ?? 0}`,
                          line.returned ? `Returned ${line.returned}` : null,
                          line.doses
                            ? `Left ${Math.max(line.doses - (line.dispensed ?? 0) + (line.returned ?? 0), 0)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    ) : null}
                    {line.status === 'active' ? (
                      <span className={styles.dispenseRow}>
                        <DispenseButton
                          client={client}
                          line={line}
                          onDone={() => setRound((n) => n + 1)}
                        />
                        {(line.dispensed ?? 0) - (line.returned ?? 0) > 0 ? (
                          <DispenseButton
                            client={client}
                            line={line}
                            returning
                            onDone={() => setRound((n) => n + 1)}
                          />
                        ) : null}
                      </span>
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
  returning = false,
  onDone,
}: {
  client: SupabaseClient
  line: PharmacyMedicine
  // Returned: doses brought back to the store (request 247).
  returning?: boolean
  onDone: () => void
}) {
  const held = (line.dispensed ?? 0) - (line.returned ?? 0)
  // Dispense: the rest of the course to start, or 1 with no number.
  // Returned: 1 to start.
  const left = returning ? 1 : line.doses ? Math.max(line.doses - held, 1) : 1
  const verb = returning ? 'Returned' : 'Dispense'
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
    const failed = returning
      ? await returnToStore(client, line.id, doses)
      : await dispenseFromChart(client, line.id, doses)
    setBusy(false)
    setProblem(failed)
    if (!failed) {
      setOpen(false)
      setSaved(
        `${returning ? 'Returned' : 'Dispensed'} ${doses} ${doses === 1 ? 'dose' : 'doses'}.`,
      )
      onDone()
    }
  }

  if (!open)
    return (
      <span className={styles.dispenseRow}>
        <button
          type="button"
          className={returning ? styles.button : `${styles.button} ${styles.primary}`}
          onClick={() => {
            setCount(String(left))
            setSaved(null)
            setOpen(true)
          }}
        >
          {verb}
        </button>
        {saved ? <small className={styles.muted}>{saved}</small> : null}
      </span>
    )
  return (
    <span className={styles.dispenseRow}>
      <label htmlFor={`${returning ? 'return' : 'dispense'}-${line.id}`}>
        {returning ? 'How many doses came back' : 'How many doses'}
      </label>
      <input
        id={`${returning ? 'return' : 'dispense'}-${line.id}`}
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
        {busy ? 'Saving…' : verb}
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
