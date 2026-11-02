/*
 * app/notifications/page.tsx: Notifications, everything waiting for you
 * (request 132).
 *
 * Why: Anthony, 2026-11-02: Notifications sits behind the menu button with
 * a red bubble of the unread count "so it catches someone's eye". Each
 * line opens the place where it is dealt with; when it is dealt with, it
 * leaves the list by itself.
 *
 * Never: show a patient's name here.
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from './notifications.module.css'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import { loadNotices, type Notice } from '@/lib/notifications/notifications'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

export default function NotificationsPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/notifications/')
  const { client, staff } = auth
  const [notices, setNotices] = useState<Notice[] | null>(null)

  useEffect(() => {
    if (!client || !staff || auth.status !== 'ready') return
    let current = true
    const load = () =>
      void loadNotices(client, staff).then((found) => {
        if (current) setNotices(found)
      })
    const first = window.setTimeout(load, 0)
    const timer = window.setInterval(load, 30_000)
    return () => {
      current = false
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [client, staff, auth.status])

  if (auth.status !== 'ready' || !client || !staff) return null

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Notifications</h2>
        {notices === null ? <p className={styles.muted}>Loading…</p> : null}
        {notices && notices.length === 0 ? (
          <p className={styles.muted}>You are all caught up. Nothing is waiting for you.</p>
        ) : null}
        {(notices ?? []).map((notice) => (
          <Link key={notice.key} className={styles.notice} href={notice.href}>
            <Icon name="bell" size={18} />
            <span>{notice.words}</span>
            <b className={styles.open}>Open</b>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
