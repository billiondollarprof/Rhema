/*
 * app/notifications/page.tsx: Notifications, everything waiting for you
 * (requests 132 and 148).
 *
 * Why: Anthony, 2026-11-02: Notifications sits behind the menu button with
 * a red bubble of the unread count "so it catches someone's eye".
 * 2026-11-04: "you're not even supposed to be clicking open... just be
 * clicking a maybe a drop down to review all the notification for that
 * panel... it reviews the entire one at the same button without opening a
 * new section, pushing the others down, then you can fold it back."
 *
 * So each notice is a fold. Unfolded, it shows what is waiting, right here:
 *   messages        each message, with Reply (opens that conversation);
 *   announcements   each announcement, with Got it;
 *   lab and drugs   the same Lab or Pharmacy card as Home, so a payment, a
 *                   result or a dispense is done without leaving this page.
 * When something is dealt with, its notice leaves the list by itself.
 *
 * The last list shows at once (kept in memory), then a fresh one loads.
 *
 * Never: send anybody to Home to deal with a notice.
 */
'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import styles from './notifications.module.css'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import LabCard from '@/components/work/LabCard'
import PharmacyCard from '@/components/work/PharmacyCard'
import { markAnnouncementRead } from '@/lib/messages/messages'
import {
  cachedNotices,
  loadNotices,
  type Notice,
  type NoticeItem,
} from '@/lib/notifications/notifications'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

export default function NotificationsPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/notifications/')
  const { client, staff } = auth
  const [notices, setNotices] = useState<Notice[] | null>(() =>
    staff ? cachedNotices(staff.id) : null,
  )
  // The notices unfolded now, by key.
  const [open, setOpen] = useState<string[]>([])

  // ===== 1. Load now, then every 30 seconds =====
  const load = useCallback(async () => {
    if (!client || !staff) return
    setNotices(await loadNotices(client, staff))
  }, [client, staff])

  useEffect(() => {
    if (auth.status !== 'ready') return
    let current = true
    const run = () => {
      if (current) void load()
    }
    const first = window.setTimeout(run, 0)
    const timer = window.setInterval(run, 30_000)
    return () => {
      current = false
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [auth.status, load])

  if (auth.status !== 'ready' || !client || !staff) return null

  function toggle(key: string) {
    setOpen((now) => (now.includes(key) ? now.filter((one) => one !== key) : [...now, key]))
  }

  // ===== 2. The list of folds =====
  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Notifications</h2>
        {notices === null ? <p className={styles.muted}>Loading…</p> : null}
        {notices && notices.length === 0 ? (
          <p className={styles.muted}>You are all caught up. Nothing is waiting for you.</p>
        ) : null}
        {(notices ?? []).map((notice) => {
          const unfolded = open.includes(notice.key)
          return (
            <section key={notice.key} className={styles.notice}>
              <button
                type="button"
                className={styles.fold}
                aria-expanded={unfolded}
                aria-controls={`notice-${notice.key}`}
                onClick={() => toggle(notice.key)}
              >
                <Icon name="bell" size={18} />
                <span>{notice.words}</span>
                <span className={`${styles.chevron} ${unfolded ? styles.up : ''}`} aria-hidden>
                  <Icon name="chevron" size={18} />
                </span>
              </button>
              {unfolded ? (
                <div id={`notice-${notice.key}`} className={styles.inside}>
                  {notice.card === 'lab' ? <LabCard client={client} staff={staff} bare /> : null}
                  {notice.card === 'pharmacy' ? (
                    <PharmacyCard client={client} staff={staff} bare />
                  ) : null}
                  {notice.card
                    ? null
                    : notice.items.map((item) => (
                        <ItemLine
                          key={item.key}
                          item={item}
                          onGotIt={async (id) => {
                            await markAnnouncementRead(client, id)
                            await load()
                          }}
                        />
                      ))}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </AppShell>
  )
}

// ===== 3. One message or announcement inside a fold =====
function ItemLine({
  item,
  onGotIt,
}: {
  item: NoticeItem
  onGotIt: (announcement: number) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const action = item.action
  return (
    <div className={styles.item}>
      <div className={styles.itemTop}>
        <b>{item.title}</b>
        <small>{item.time}</small>
      </div>
      {item.detail ? <p className={styles.detail}>{item.detail}</p> : null}
      {'href' in action ? (
        <Link className={styles.action} href={action.href}>
          {action.label}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.action}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onGotIt(action.announcement)
            setBusy(false)
          }}
        >
          {busy ? 'Saving…' : action.label}
        </button>
      )}
    </div>
  )
}
