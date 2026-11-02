/*
 * app/announce/page.tsx: Announce, to every member of staff (request 123).
 *
 * Why: Anthony, 2026-11-02: announcements reach everybody, show on Home
 * until a date (7 days unless chosen), and are kept 1 year. Only staff with
 * the Announce permission (nurses and admins by default) can send one; the
 * database refuses everybody else.
 *
 * Never: send without the person tapping Send.
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import styles from './announce.module.css'
import AppShell from '@/components/shell/AppShell'
import { sendAnnouncement } from '@/lib/messages/messages'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

const inDays = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

export default function AnnouncePage() {
  const auth = useAuth()
  useRightPage(auth.status, '/announce/')
  const { client, staff } = auth
  const [body, setBody] = useState('')
  const [until, setUntil] = useState(inDays(7))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (auth.status !== 'ready' || !client || !staff) return null

  async function send() {
    if (!client) return
    setBusy(true)
    setProblem(null)
    const failed = await sendAnnouncement(client, body, until)
    setBusy(false)
    if (failed) setProblem(failed)
    else setSent(true)
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Announce</h2>
        {!staff.can_announce ? (
          <p className={styles.muted}>
            Only staff with the Announce permission can send announcements. Ask your administrator.
          </p>
        ) : sent ? (
          <div className={styles.card}>
            <p className={styles.good}>
              Sent to everyone. It shows on their Home until they read it.
            </p>
            <div className={styles.buttons}>
              <Link className={`${styles.button} ${styles.primary}`} href="/">
                Home
              </Link>
              <button
                className={styles.button}
                onClick={() => {
                  setBody('')
                  setSent(false)
                }}
              >
                Send another
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <label className={styles.label} htmlFor="announce-body">
              Announcement for every member of staff
            </label>
            <textarea
              id="announce-body"
              className={styles.input}
              rows={4}
              maxLength={2000}
              placeholder="For example: Staff meeting at 4 pm in the conference room."
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <label className={styles.label} htmlFor="announce-until">
              Show on Home until
            </label>
            <input
              id="announce-until"
              type="date"
              className={styles.input}
              min={inDays(0)}
              max={inDays(90)}
              value={until}
              onChange={(event) => setUntil(event.target.value)}
            />
            {problem ? <p className={styles.error}>{problem}</p> : null}
            <div className={styles.buttons}>
              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={send}
                disabled={busy || !body.trim() || !until}
              >
                {busy ? 'Sending…' : 'Send to everyone'}
              </button>
              <Link className={styles.button} href="/">
                Cancel
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
