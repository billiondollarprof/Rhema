/*
 * app/_home/AnnouncementsCard.tsx: announcements on Home, until each person
 * has read them (request 123: announcements).
 *
 * Why: Anthony, 2026-11-02: announcements show on Home until the sender's
 * date (7 days unless they choose), kept 1 year. "Got it" marks one read
 * for this person, and it leaves their Home.
 *
 * Never: hide an announcement before the person has tapped Got it.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './home.module.css'
import {
  activeAnnouncements,
  markAnnouncementRead,
  myAnnouncementReads,
  type Announcement,
} from '@/lib/messages/messages'

export default function AnnouncementsCard({
  client,
  staffId,
}: {
  client: SupabaseClient
  staffId: string
}) {
  const [shown, setShown] = useState<Announcement[]>([])

  const load = useCallback(async () => {
    const [all, read] = await Promise.all([
      activeAnnouncements(client),
      myAnnouncementReads(client, staffId),
    ])
    setShown(all.filter((one) => !read.includes(one.id)))
  }, [client, staffId])

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0)
    const timer = window.setInterval(() => void load(), 60_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [load])

  if (shown.length === 0) return null

  return (
    <div className={`${styles.card} ${styles.announce}`}>
      <h3>Announcements</h3>
      {shown.map((one) => (
        <div key={one.id} className={styles.announceItem}>
          <p>{one.body}</p>
          <small>
            {one.sender?.full_name ?? 'Staff'} ·{' '}
            {new Date(one.created_at).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </small>
          <button
            className={styles.button}
            onClick={async () => {
              setShown((all) => all.filter((item) => item.id !== one.id))
              await markAnnouncementRead(client, one.id)
            }}
          >
            Got it
          </button>
        </div>
      ))}
    </div>
  )
}
