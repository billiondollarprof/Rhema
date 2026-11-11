/*
 * app/admin/page.tsx: Admin. Staff, invitations, rooms and the activity
 * log, in four tabs.
 *
 * Why: build step 7 and request 112 (Anthony, 2026-10-30). "Super simple
 * system to use... easy flow." So one page, four tabs, and the tab is kept
 * in the address (?tab=invite), so a refresh or the Home button "Invite
 * staff" opens the right one.
 *
 * Only a person with admin access sees this page. The database checks it
 * again on every read and change, so the page hiding itself is only a
 * courtesy.
 *
 * Never: show anything here to somebody without admin access.
 */
'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ActivityTab from './_parts/ActivityTab'
import InviteTab from './_parts/InviteTab'
import RoomsTab from './_parts/RoomsTab'
import StaffTab from './_parts/StaffTab'
import styles from './_parts/admin.module.css'
import AppShell from '@/components/shell/AppShell'
import {
  listInvites,
  listRooms,
  listStaff,
  type InviteRow,
  type RoomRow,
  type StaffRow,
} from '@/lib/admin/admin'
import { onChange } from '@/lib/live/changes'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

// ===== 1. The tabs =====
const TABS = [
  ['staff', 'Staff'],
  ['invite', 'Invite'],
  ['rooms', 'Rooms'],
  ['activity', 'Activity'],
] as const
type Tab = (typeof TABS)[number][0]

function Admin() {
  const auth = useAuth()
  useRightPage(auth.status, '/admin/')
  const router = useRouter()
  const params = useSearchParams()
  const asked = params.get('tab')
  const tab: Tab = TABS.some(([key]) => key === asked) ? (asked as Tab) : 'staff'
  const { client, staff: me } = auth

  const [staff, setStaff] = useState<StaffRow[] | null>(null)
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [rooms, setRooms] = useState<RoomRow[]>([])

  // ===== 2. Load everything once, and again after each change =====
  const reload = useCallback(async () => {
    if (!client) return
    const [people, open, places] = await Promise.all([
      listStaff(client),
      listInvites(client),
      listRooms(client),
    ])
    setStaff(people)
    setInvites(open)
    setRooms(places)
  }, [client])

  useEffect(() => {
    if (auth.status !== 'ready' || !me?.can_admin) return
    const timer = window.setTimeout(reload, 0)
    // The Refresh button, and anybody's change (an invitation, an access
    // change), read the lists again without leaving the page.
    const stop = client ? onChange(client, 'records', () => void reload()) : undefined
    return () => {
      window.clearTimeout(timer)
      stop?.()
    }
  }, [auth.status, me?.can_admin, reload, client])

  if (auth.status !== 'ready' || !client || !me) return null

  // ===== 3. The page =====
  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Admin</h2>
        {!me.can_admin ? (
          <p className={styles.muted}>Only an admin can open this page.</p>
        ) : (
          <>
            <div className={styles.tabs} role="tablist">
              {TABS.map(([key, words]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => router.replace(`/admin/?tab=${key}`)}
                >
                  {words}
                </button>
              ))}
            </div>

            {staff === null ? <p className={styles.muted}>Loading…</p> : null}
            {staff && tab === 'staff' ? (
              <StaffTab client={client} myId={me.id} staff={staff} rooms={rooms} reload={reload} />
            ) : null}
            {staff && tab === 'invite' ? (
              <InviteTab client={client} invites={invites} rooms={rooms} reload={reload} />
            ) : null}
            {staff && tab === 'rooms' ? (
              <RoomsTab client={client} rooms={rooms} reload={reload} />
            ) : null}
            {staff && tab === 'activity' ? <ActivityTab client={client} staff={staff} /> : null}
          </>
        )}
      </div>
    </AppShell>
  )
}

// The address is read in the browser, so the page waits for it.
export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <Admin />
    </Suspense>
  )
}
