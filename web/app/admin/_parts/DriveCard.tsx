/*
 * app/admin/_parts/DriveCard.tsx: the "Monthly copy to Google Drive" card on
 * the Data tab. The admin connects the hospital's own Google account once,
 * then a text copy of all the records is saved there at the end of every
 * month: a folder for each year, a ZIP for each month.
 *
 * Why: Anthony, 2026-11-17 (request 226b): a monthly text backup in the
 * hospital's own Google Drive. Built once under StellaXafe, so each hospital
 * only taps Connect.
 *
 * How it goes:
 *   1. The admin taps "Connect Google Drive". The database gives a one time
 *      code (15 minutes), and the page goes to Google through our Worker.
 *   2. The admin picks the hospital's Google account and taps Allow.
 *   3. Google sends them back through the Worker, which scrambles the key
 *      and puts it after a "#" in the address (#drive-link=...). This page
 *      takes it off the address at once and hands it to the database as
 *      the signed in admin (finish_drive_link). A problem comes back as
 *      ?drive=failed, expired or not-set-up instead.
 *   4. The card shows the account and the last copy saved.
 *
 * Never: show or hold the Google key. It stays sealed in the database, and
 * only the monthly job can open it.
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './admin.module.css'

// ===== 1. What the database tells the card =====
type DriveStatus = {
  connected: boolean
  google_email: string | null
  connected_at: string | null
  last_backup_at: string | null
  last_backup_file: string | null
  last_problem: string | null
} | null

// The words for each answer Google's return can bring back (?drive=...).
const RETURN_WORDS: Record<string, { good: boolean; words: string }> = {
  connected: { good: true, words: 'Google Drive is connected.' },
  failed: { good: false, words: 'Google Drive did not connect. Please try again.' },
  expired: { good: false, words: 'That took too long. Please tap Connect again.' },
  'not-set-up': {
    good: false,
    words: 'Google Drive is not set up for this system yet. Please ask StellaXafe.',
  },
}

// What Google's return put in the address (?drive=...), or ''.
function returnAnswer(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('drive') ?? ''
}

// What the Worker handed back after Google (#drive-link=...): the one time
// code, the scrambled key and the account's email. After a "#", so it never
// left this device. null when the page has not just come back from Google.
type Handover = { code: string; key: string; email: string | null }
function readHandover(): Handover | null {
  if (typeof window === 'undefined') return null
  const part = window.location.hash.match(/^#drive-link=([A-Za-z0-9_-]+)$/)?.[1]
  if (!part) return null
  try {
    const found = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Handover
    return typeof found.code === 'string' && typeof found.key === 'string' ? found : null
  } catch {
    return null
  }
}

function when(moment: string | null): string {
  if (!moment) return ''
  return new Date(moment).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.NEXT_PUBLIC_TIME_ZONE || 'Africa/Lagos',
  })
}

export default function DriveCard({ client }: { client: SupabaseClient }) {
  const [status, setStatus] = useState<DriveStatus>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  // The answer from Google's return, if the page has just come back from it.
  const [note, setNote] = useState<{ good: boolean; words: string } | null>(
    () => RETURN_WORDS[returnAnswer()] ?? null,
  )

  // ===== 2. Read the status =====
  // Asks the database what is connected. Answers the status, or 'problem'.
  const read = useCallback(async (): Promise<DriveStatus | 'problem'> => {
    const { data, error } = await client.rpc('drive_link_status')
    return error ? 'problem' : ((data as DriveStatus) ?? null)
  }, [client])

  // Puts what the database answered on the card.
  function show(found: DriveStatus | 'problem') {
    if (found === 'problem')
      setNote({ good: false, words: 'Could not read the Google Drive status.' })
    else setStatus(found)
    setLoaded(true)
  }

  // Back from Google: hand the scrambled key to the database, as this admin.
  // Answers the words to show. The ref makes sure it is handed in once.
  const handedIn = useRef(false)
  const finish = useCallback(
    async (handover: Handover) => {
      const { data, error } = await client.rpc('finish_drive_link', {
        code: handover.code,
        key_sealed: handover.key,
        google_email: handover.email,
      })
      if (error) return RETURN_WORDS.failed
      return data === 'done' ? RETURN_WORDS.connected : RETURN_WORDS.expired
    },
    [client],
  )

  useEffect(() => {
    let current = true
    const handover = handedIn.current ? null : readHandover()
    // Take Google's answer and the key off the address at once, so a refresh
    // or the browser's history never holds them.
    if (handover || returnAnswer()) window.history.replaceState(null, '', '/admin/?tab=data')
    async function start() {
      if (handover) {
        handedIn.current = true
        const words = await finish(handover)
        if (current) setNote(words)
      }
      const found = await read()
      if (current) show(found)
    }
    void start()
    return () => {
      current = false
    }
  }, [read, finish])

  // ===== 3. Connect: a one time code, then off to Google =====
  async function connect() {
    setBusy(true)
    setNote(null)
    const { data, error } = await client.rpc('start_drive_link')
    if (error || !data) {
      setBusy(false)
      setNote({ good: false, words: 'Could not start. Please try again.' })
      return
    }
    window.location.assign(`/api/drive/start?code=${encodeURIComponent(String(data))}`)
  }

  // ===== 4. Disconnect, after one "are you sure" =====
  async function disconnect() {
    setBusy(true)
    const { error } = await client.rpc('disconnect_drive')
    setBusy(false)
    setSure(false)
    if (error) {
      setNote({ good: false, words: 'Could not disconnect. Please try again.' })
      return
    }
    setNote({ good: true, words: 'Google Drive is disconnected. No more monthly copies.' })
    show(await read())
  }

  // ===== 5. The card =====
  return (
    <div className={styles.card}>
      <h3>Monthly copy to Google Drive</h3>
      <p className={styles.muted}>
        At the end of every month, a copy of all the records, as they stand that day, is saved in
        the hospital&apos;s own Google Drive, in a folder for each year. Text only: the scans and
        photos stay where they are.
      </p>

      {loaded && status?.connected ? (
        <>
          <p>
            Connected to <strong>{status.google_email}</strong>
          </p>
          <p className={styles.muted}>
            {status.last_backup_file
              ? `Last copy: ${status.last_backup_file}, saved ${when(status.last_backup_at)}.`
              : 'The first copy is saved at the end of this month.'}
          </p>
          {status.last_problem ? <p className={styles.error}>{status.last_problem}</p> : null}
          <p className={styles.muted}>
            Keep this Google account safe: turn on 2-Step Verification in its security settings.
          </p>
          <div className={styles.buttons}>
            {sure ? (
              <>
                <button
                  type="button"
                  className={`${styles.button} ${styles.danger}`}
                  disabled={busy}
                  onClick={() => void disconnect()}
                >
                  Yes, disconnect
                </button>
                <button type="button" className={styles.button} onClick={() => setSure(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className={styles.button} onClick={() => setSure(true)}>
                Disconnect
              </button>
            )}
          </div>
        </>
      ) : null}

      {loaded && !status?.connected ? (
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            disabled={busy}
            onClick={() => void connect()}
          >
            {busy ? 'Opening Google…' : 'Connect Google Drive'}
          </button>
        </div>
      ) : null}

      {note ? <p className={note.good ? styles.good : styles.error}>{note.words}</p> : null}
    </div>
  )
}
