/*
 * app/page.tsx: the home screen, at the root address.
 *
 * Why: this is where a signed in, unlocked person lands. For now it shows
 * who is signed in, with Lock screen and Sign out, and the server status
 * line. Each role's real home (the queue, the dashboard) is built in step 5
 * of PLAN.md section 13 and replaces section 3 below.
 *
 * Never: show patient data to somebody who is not signed in and unlocked.
 * The page sends them to the sign in or lock page first, and the database
 * refuses them anyway.
 */
'use client'

import { useEffect, useState } from 'react'
import PersonBadge from '@/components/auth/PersonBadge'
import styles from './home.module.css'
import { roleLabel } from '@/lib/auth/roles'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

// ===== 1. Ask the Worker whether it is running =====
function useWorkerStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => setStatus(response.ok ? 'ok' : 'down'))
      .catch(() => setStatus('down'))
  }, [])

  return status
}

// ===== 2. The screen =====
export default function HomePage() {
  const auth = useAuth()
  useRightPage(auth.status, '/')
  const server = useWorkerStatus()

  if (auth.status !== 'ready' || !auth.staff) return <div className={styles.blank} />

  const staff = auth.staff
  const roleWords =
    roleLabel(staff.role) + (staff.can_admin && staff.role !== 'admin' ? ' · Admin' : '')

  return (
    <main className={styles.app}>
      <header className={styles.top}>
        <PersonBadge name={staff.full_name} />
        <div className={styles.who}>
          <b>{staff.full_name}</b>
          <small>{roleWords}</small>
        </div>
        <button className={styles.topButton} onClick={auth.lock}>
          Lock screen
        </button>
        <button className={styles.topButton} onClick={auth.signOut}>
          Sign out
        </button>
      </header>

      {/* ===== 3. Placeholder until each role's home is built ===== */}
      <section className={styles.body}>
        <div className={styles.card}>
          <h3>You are signed in</h3>
          <p>
            Your screens for {roleLabel(staff.role)} come next. The screen locks by itself after 10
            minutes without use.
          </p>
          <small>
            Server: {{ checking: 'Checking…', ok: 'Ready', down: 'Not reachable' }[server]}
          </small>
        </div>
      </section>
    </main>
  )
}
