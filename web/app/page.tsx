/*
 * app/page.tsx: Home, the first screen after signing in.
 *
 * Why: the RHEMA demo's home screen, made real. In order, top to bottom:
 *   1. greeting, with role and room;
 *   2. the closing time banner (front desk, after 5pm);
 *   3. the four quick action buttons for this role;
 *   4. today's count tiles;
 *   5. the "Patients seen" chart;
 *   6. the queue card for this role;
 *   7. the Laboratory card: payments, tests to do, or results ready
 *      (request 115);
 *   8. the Pharmacy card: drugs to pay for, or prescriptions to dispense
 *      (request 123).
 * The parts live in app/_home/, one file each. The data code is shared, in
 * lib/queue/queue.ts.
 *
 * The page refreshes its numbers every 30 seconds until live updates are
 * built with the messages module.
 *
 * Never: show patient data to somebody who is not signed in and unlocked.
 * The page sends them to the sign in or lock page first, and the database
 * refuses them anyway.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/shell/AppShell'
import AnnouncementsCard from './_home/AnnouncementsCard'
import CountTiles from './_home/CountTiles'
import LabCard from './_home/LabCard'
import PharmacyCard from './_home/PharmacyCard'
import QueueCard from './_home/QueueCard'
import QuickActions from './_home/QuickActions'
import SeenChart from './_home/SeenChart'
import styles from './_home/home.module.css'
import { roleLabel } from '@/lib/auth/roles'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'
import {
  loadOpenQueue,
  loadTodayCounts,
  type QueueEntry,
  type TodayCounts,
} from '@/lib/queue/queue'

function greetingWord() {
  const hour = new Date().getHours()
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
}

export default function HomePage() {
  const auth = useAuth()
  useRightPage(auth.status, '/')
  const { client, staff } = auth

  const [counts, setCounts] = useState<TodayCounts | null>(null)
  const [entries, setEntries] = useState<QueueEntry[] | null>(null)

  // ===== Data: today's counts and the open queue =====
  const refresh = useCallback(async () => {
    if (!client) return
    const [newCounts, newEntries] = await Promise.all([
      loadTodayCounts(client),
      loadOpenQueue(client),
    ])
    setCounts(newCounts)
    setEntries(newEntries)
  }, [client])

  useEffect(() => {
    if (auth.status !== 'ready') return
    let current = true
    const run = () => {
      if (current) refresh()
    }
    const first = window.setTimeout(run, 0)
    const timer = window.setInterval(run, 30000)
    return () => {
      current = false
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [auth.status, refresh])

  if (auth.status !== 'ready' || !staff || !client) return <div className={styles.page} />

  const closingTime = staff.role === 'front_desk' && new Date().getHours() >= 17

  return (
    <AppShell>
      <div className={styles.page}>
        {/* ===== 1. Greeting ===== */}
        <div className={styles.greeting}>
          <h2>
            Good {greetingWord()}, {staff.full_name}
          </h2>
          <span>
            {roleLabel(staff.role)}
            {/* The room, unless it only repeats the role ("Pharmacy · Pharmacy"). */}
            {staff.room && staff.room.name !== roleLabel(staff.role) ? ` · ${staff.room.name}` : ''}
          </span>
        </div>

        {/* ===== 2. Closing time (front desk, after 5pm) ===== */}
        {closingTime ? (
          <div className={styles.banner}>
            <div>
              <b>It is closing time</b>
              <small>Please sign out so the next shift can sign in with their own account.</small>
            </div>
            <button className={styles.button} onClick={auth.signOut}>
              Sign out
            </button>
          </div>
        ) : null}

        {/* ===== 3 to 6 ===== */}
        {/* Announcements first, until each person taps Got it. */}
        <AnnouncementsCard client={client} staffId={staff.id} />
        <QuickActions role={staff.role} />
        <CountTiles counts={counts} />
        <SeenChart client={client} />
        <QueueCard client={client} staff={staff} entries={entries} onChanged={refresh} />
        <LabCard client={client} staff={staff} />
        <PharmacyCard client={client} staff={staff} />
      </div>
    </AppShell>
  )
}
