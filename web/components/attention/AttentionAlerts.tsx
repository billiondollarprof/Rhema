/*
 * components/attention/AttentionAlerts.tsx: the card that floats in when
 * somebody calls your room. It rings with the bell sound, and shows a
 * phone icon (the bell icon means notifications).
 *
 * Why: Anthony, 2026-10-29. "Once that attention is needed, even if they
 * are doing something on the computer, it can float immediately... with
 * the X to remove it... it doesn't affect what they are doing. If they were
 * typing, it just floats in."
 *
 * How a call arrives:
 *   1. Live: Supabase sends each new call the moment it is saved.
 *   2. Behind that, every 20 seconds, a quiet check for calls in the last
 *      3 minutes, in case the live line dropped (a weak connection).
 *   3. On opening the app, calls from the last 5 minutes still show.
 * A call closed with X stays closed on this device.
 *
 * Call patient (request 129, 2026-11-02): when a room taps Call in, the
 * Front Desk gets its own card, green, with a door icon and a chime
 * instead of the bell: "Call patient · Adaeze Okafor to Consultant Room 1".
 *
 * Never: take the cursor or the keyboard. The card is not focused, and
 * nothing behind it moves.
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Icon from '@/components/shell/Icon'
import { ringBell, ringChime } from './bell'
import { pushSupported, refreshAlerts } from '@/lib/attention/push'
import styles from './attention.module.css'
import {
  KIND_LABELS,
  listenForCalls,
  loadRecentCalls,
  type AttentionCall,
} from '@/lib/attention/attention'
import { BRAND } from '@/lib/brand/brand'

const CHECK_EVERY_MS = 20_000

// Blocked alerts (request 107): the person tapped Block, so we left them
// alone. When a call does reach them in the app, the card says how to
// switch alerts back on. The phone will not ask "Allow?" a second time.
function alertsBlocked(): boolean {
  return pushSupported() && Notification.permission === 'denied'
}

// ===== 1. Calls closed with X, remembered on this device =====
function closedKey(staffId: string) {
  return `rhema-attention-closed-${staffId}`
}
function readClosed(staffId: string): number[] {
  try {
    return JSON.parse(localStorage.getItem(closedKey(staffId)) ?? '[]') as number[]
  } catch {
    return []
  }
}
function saveClosed(staffId: string, ids: number[]) {
  try {
    localStorage.setItem(closedKey(staffId), JSON.stringify(ids.slice(-100)))
  } catch {
    // Private window: the card still closes, it just may show again after a refresh.
  }
}

// ===== 2. The cards =====
export default function AttentionAlerts({
  client,
  staffId,
}: {
  client: SupabaseClient
  staffId: string
}) {
  const [calls, setCalls] = useState<AttentionCall[]>([])
  const known = useRef(new Set<number>())

  // Add calls not seen before; ring once for each new batch.
  const take = useCallback(
    (incoming: AttentionCall[], ring: boolean) => {
      const closed = new Set(readClosed(staffId))
      const fresh = incoming.filter((call) => !known.current.has(call.id) && !closed.has(call.id))
      if (!fresh.length) return
      for (const call of fresh) known.current.add(call.id)
      setCalls((shown) => [...shown, ...fresh])
      if (ring) {
        // A patient being called chimes; Call attention rings the bell.
        if (incoming.some((call) => call.kind === 'call_patient')) ringChime()
        if (incoming.some((call) => call.kind !== 'call_patient')) ringBell()
      }
    },
    [staffId],
  )

  useEffect(() => {
    let current = true
    // 3. On opening: the last 5 minutes, without a ring (they may be old).
    loadRecentCalls(client, staffId, 5).then((recent) => {
      if (current) take(recent, false)
    })
    // If alerts are on in this browser, keep this person on it (step 2).
    void refreshAlerts(client, staffId)
    // 1. Live.
    const stop = listenForCalls(client, staffId, (call) => take([call], true))
    // 2. The quiet check behind it.
    const timer = setInterval(() => {
      loadRecentCalls(client, staffId, 3).then((recent) => {
        if (current) take(recent, true)
      })
    }, CHECK_EVERY_MS)
    return () => {
      current = false
      stop()
      clearInterval(timer)
    }
  }, [client, staffId, take])

  function close(id: number) {
    saveClosed(staffId, [...readClosed(staffId), id])
    setCalls((shown) => shown.filter((call) => call.id !== id))
  }

  return (
    <div className={styles.alerts} aria-live="assertive">
      {calls.map((call) => (
        <div
          key={call.id}
          className={`${styles.alert} ${call.kind === 'call_patient' ? styles.alertPatient : ''}`}
          role="status"
        >
          <span className={`${styles.alertBell} ${styles.shake}`} aria-hidden="true">
            <Icon name={call.kind === 'call_patient' ? 'door' : 'call'} size={20} />
          </span>
          <div className={styles.alertText}>
            {call.kind === 'call_patient' ? (
              <>
                <span className={styles.alertKind}>Call patient</span>
                <b>
                  {call.patient?.full_name ?? 'The next patient'} to{' '}
                  {call.from_room?.name ?? 'the room'}
                </b>
              </>
            ) : (
              <b>
                {call.from_room?.name ?? call.caller?.full_name ?? 'Someone'} needs{' '}
                {call.to_room?.name ?? KIND_LABELS[call.to_kind]}
              </b>
            )}
            <small>
              {call.caller?.full_name ?? 'Staff'} ·{' '}
              {new Date(call.created_at).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </small>
            {alertsBlocked() ? (
              <small className={styles.blockedHint}>
                Calls can&apos;t reach you when {BRAND.short} is closed. Allow notifications for{' '}
                {BRAND.short} in your Settings.
              </small>
            ) : null}
          </div>
          <button className={styles.close} onClick={() => close(call.id)} aria-label="Close">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
