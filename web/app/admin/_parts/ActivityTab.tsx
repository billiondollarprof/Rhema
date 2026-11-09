/*
 * app/admin/_parts/ActivityTab.tsx: who is online, and what each person
 * did today.
 *
 * Why: the demo's "Activity and logs" (logsH): one card per staff member
 * with signed in, signed out, time online, and today's activities. Anthony,
 * 2026-10-30: "Activity log, I think you got it right."
 *
 * Never: show a patient's name or details here. A line names the record
 * (e.g. "patient 12"), never the person in it.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './admin.module.css'
import PersonBadge from '@/components/auth/PersonBadge'
import {
  lineWords,
  loadToday,
  type LogRow,
  type SessionRow,
  type StaffRow,
} from '@/lib/admin/admin'
import { roleLabel } from '@/lib/auth/roles'

// The app says "seen" every 3 minutes, so 5 minutes of quiet means offline.
const ONLINE_WITHIN_MS = 5 * 60 * 1000
const LINES_SHOWN = 3

const clock = (when: string) =>
  new Date(when).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// ===== 1. One person's day, worked out from their stretches =====
function dayFor(sessions: SessionRow[]) {
  const first = sessions[0] ?? null
  const last = sessions[sessions.length - 1] ?? null
  const online =
    !!last &&
    !last.ended_at &&
    Date.now() - new Date(last.last_seen_at).getTime() < ONLINE_WITHIN_MS
  let minutes = 0
  for (const stretch of sessions) {
    const end = new Date(stretch.ended_at ?? stretch.last_seen_at).getTime()
    minutes += Math.max(0, end - new Date(stretch.started_at).getTime()) / 60000
  }
  const signedOut = online ? 'Still in' : last ? clock(last.ended_at ?? last.last_seen_at) : '-'
  return {
    online,
    signedIn: first ? clock(first.started_at) : '-',
    signedOut,
    timeOnline: `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`,
  }
}

// ===== 2. The tab =====
export default function ActivityTab({
  client,
  staff,
}: {
  client: SupabaseClient
  staff: StaffRow[]
}) {
  const [today, setToday] = useState<{ sessions: SessionRow[]; lines: LogRow[] } | null>(null)

  // When it last came back, and whether a Refresh tap is running.
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    const found = await loadToday(client)
    setBusy(false)
    setToday(found)
    setUpdatedAt(new Date())
  }, [client])

  // It updates by itself every 10 seconds while the tab is open (Anthony,
  // 2026-11-08: "as the log page is open like that, it's being updated
  // without admin having to refresh it"). Refresh does the same at once.
  useEffect(() => {
    let current = true
    async function quietly() {
      const found = await loadToday(client)
      if (!current) return
      setToday(found)
      setUpdatedAt(new Date())
    }
    void quietly()
    const timer = window.setInterval(() => void quietly(), 10_000)
    return () => {
      current = false
      window.clearInterval(timer)
    }
  }, [client])

  if (!today) return <p className={styles.muted}>Loading today’s activity…</p>

  // Everybody still on the staff list, the busiest first.
  const people = staff
    .filter((person) => !person.revoked_at)
    .map((person) => {
      const sessions = today.sessions.filter((stretch) => stretch.staff_id === person.id)
      const lines = today.lines.filter((line) => line.actor_id === person.id)
      return { person, day: dayFor(sessions), lines }
    })
    .sort((a, b) => Number(b.day.online) - Number(a.day.online) || b.lines.length - a.lines.length)

  return (
    <>
      <div className={styles.buttons}>
        <button className={styles.button} onClick={load} disabled={busy}>
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
        {updatedAt ? (
          <span className={styles.muted}>
            Updates by itself · last at{' '}
            {updatedAt.toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        ) : null}
      </div>
      <div className={styles.people}>
        {people.map(({ person, day, lines }) => (
          <PersonDay key={person.id} person={person} day={day} lines={lines} />
        ))}
      </div>
    </>
  )
}

// ===== 3. One card =====
function PersonDay({
  person,
  day,
  lines,
}: {
  person: StaffRow
  day: ReturnType<typeof dayFor>
  lines: LogRow[]
}) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? lines : lines.slice(0, LINES_SHOWN)

  return (
    <div className={styles.card}>
      <div className={styles.row} style={{ border: 0, padding: 0 }}>
        <PersonBadge name={person.full_name} />
        <span className={styles.rowText}>
          <b>{person.full_name}</b>
          <small>{roleLabel(person.role)}</small>
        </span>
        <span className={`${styles.tag} ${day.online ? styles.tagGreen : styles.tagGrey}`}>
          {day.online ? 'Online' : 'Offline'}
        </span>
      </div>
      <div className={styles.times}>
        <div>
          <small>Signed in</small>
          <b>{day.signedIn}</b>
        </div>
        <div>
          <small>Signed out</small>
          <b>{day.signedOut}</b>
        </div>
        <div>
          <small>Time online</small>
          <b>{day.timeOnline}</b>
        </div>
      </div>
      <p className={styles.muted}>
        {lines.length} {lines.length === 1 ? 'activity' : 'activities'} today
      </p>
      {shown.length ? (
        <div className={styles.lines}>
          {shown.map((line) => (
            <div key={line.id}>
              <b>{clock(line.happened_at)}</b>
              {lineWords(line)}
            </div>
          ))}
        </div>
      ) : null}
      {lines.length > LINES_SHOWN ? (
        <button className={`${styles.button} ${styles.small}`} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show less' : `Show all ${lines.length}`}
        </button>
      ) : null}
    </div>
  )
}
