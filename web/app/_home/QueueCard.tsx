/*
 * app/_home/QueueCard.tsx: the queue card on Home (the demo's queue()).
 *
 * Who sees which part of the queue, as in the demo:
 *   Front Desk, Admin       every patient in the hospital now
 *   Doctor, Nurse, Matron   their own room only; Call in, then Finish visit
 *   Pharmacy                patients at the pharmacy; Mark dispensed
 *   Laboratory              patients at the lab; Finished at the lab
 * The database still decides what anybody can read at all (RLS); this only
 * picks which part of that to show.
 *
 * Changes show on screen at once and save behind (optimistic), and come
 * back if the save fails.
 *
 * Never: show the medical record here. Name, number, category, room, the
 * note and the status only.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './home.module.css'
import type { StaffMember } from '@/lib/auth/session'
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  moveTo,
  type QueueEntry,
  type QueueStatus,
} from '@/lib/queue/queue'

type QueueCardProps = {
  client: SupabaseClient
  staff: StaffMember
  entries: QueueEntry[] | null
  onChanged: () => void
}

// ===== 1. Which part of the queue this person sees =====
function pick(staff: StaffMember, entries: QueueEntry[]) {
  const clinical = ['doctor', 'nurse', 'matron'].includes(staff.role)
  if (clinical) {
    return {
      title: staff.room ? `Patient queue · ${staff.room.name}` : 'Patient queue',
      list: staff.room_id ? entries.filter((entry) => entry.room?.id === staff.room_id) : [],
      empty: staff.room_id
        ? 'No patients in your room right now.'
        : 'No room is set for you yet. Ask the admin to set your room.',
    }
  }
  if (staff.role === 'pharmacy') {
    return {
      title: 'Prescriptions to dispense',
      list: entries.filter((entry) => entry.room?.kind === 'pharmacy'),
      empty: 'Nobody is waiting at the pharmacy.',
    }
  }
  if (staff.role === 'laboratory') {
    return {
      title: 'Patients at the lab',
      list: entries.filter((entry) => entry.room?.kind === 'laboratory'),
      empty: 'Nobody is waiting at the lab.',
    }
  }
  return { title: 'Patients in the hospital now', list: entries, empty: 'No patients right now.' }
}

// ===== 2. The buttons each role gets on a queue entry =====
function buttonsFor(role: string, status: QueueStatus): [string, QueueStatus, boolean][] {
  if (['doctor', 'nurse', 'matron'].includes(role)) {
    return status === 'waiting'
      ? [['Call in patient', 'in_consultation', true]]
      : [['Finish visit', 'done', true]]
  }
  if (role === 'pharmacy') return [['Mark dispensed', 'done', true]]
  if (role === 'laboratory') return [['Finished at the lab', 'done', true]]
  return []
}

function since(isoTime: string) {
  return new Date(isoTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ===== 3. The card =====
export default function QueueCard({ client, staff, entries, onChanged }: QueueCardProps) {
  // Local changes shown at once, before the database confirms them.
  const [pending, setPending] = useState<Record<number, QueueStatus>>({})
  const [error, setError] = useState<string | null>(null)

  const all = (entries ?? [])
    .map((entry) => ({ ...entry, status: pending[entry.id] ?? entry.status }))
    .filter((entry) => entry.status !== 'done')
  const { title, list, empty } = pick(staff, all)

  async function move(entry: QueueEntry, status: QueueStatus) {
    setError(null)
    setPending((now) => ({ ...now, [entry.id]: status }))
    const problem = await moveTo(client, entry.id, status)
    if (problem) setError(problem)
    setPending((now) => {
      const next = { ...now }
      delete next[entry.id]
      return next
    })
    onChanged()
  }

  return (
    <div className={styles.card} id="queue">
      <h3>
        {title} <span className={styles.count}>{entries ? list.length : '·'}</span>
      </h3>
      {error ? (
        <p className={styles.muted} style={{ color: 'var(--red)' }}>
          {error}
        </p>
      ) : null}
      <div className={styles.queue}>
        {entries && list.length === 0 ? <p className={styles.muted}>{empty}</p> : null}
        {list.map((entry) => (
          <div key={entry.id} className={styles.entry}>
            <div className={styles.entryTop}>
              <div>
                <b>{entry.patient?.full_name ?? 'Patient'}</b>
                <small>
                  {entry.patient?.patient_number} ·{' '}
                  {CATEGORY_LABELS[entry.patient?.category ?? ''] ?? entry.patient?.category} ·
                  since {since(entry.created_at)}
                </small>
                {entry.note ? <small className={styles.note}>Note: {entry.note}</small> : null}
              </div>
              <span className={styles.status} data-status={entry.status}>
                {STATUS_LABELS[entry.status]}
              </span>
            </div>
            <small className={styles.muted}>{entry.room?.name}</small>
            {buttonsFor(staff.role, entry.status).length > 0 ? (
              <div className={styles.entryButtons}>
                {buttonsFor(staff.role, entry.status).map(([label, next]) => (
                  <button
                    key={label}
                    className={`${styles.button} ${styles.primary}`}
                    disabled={entry.id in pending}
                    onClick={() => move(entry, next)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
