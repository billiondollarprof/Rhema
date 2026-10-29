/*
 * components/attention/AttentionMenu.tsx: the bell in the top bar, and the
 * list that drops down from it. The icon is a phone, not a bell, because
 * the bell means notifications (Anthony, 2026-10-29).
 *
 * Why: Anthony, 2026-10-29. "It's more like a drop down overlay that
 * doesn't shift anything on the interface. It just drop down like a
 * rolling paper." Front Desk first. One tap on a group rings it. Consultant
 * and Matron open their rooms. A small search finds a room by its number
 * or by the name of the person in it. When a call goes, its phone shakes and
 * turns into a tick, "so the person knows: I've called their attention."
 *
 * Sections:
 *   1. The bell button, and opening and shutting
 *   2. One line: tap, the bell shakes, then the tick
 *   3. The list: search, groups, then Consultant and Matron, and at the
 *      bottom the switch for alerts when the app is closed (AlertsSwitch)
 *
 * Never: open a new page, take a form, or ask for typing to send a call.
 * The search is only there to find a room faster.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Icon from '@/components/shell/Icon'
import AlertsSwitch from './AlertsSwitch'
import { useAttentionMenu } from './AttentionContext'
import styles from './attention.module.css'
import {
  callAttention,
  loadDirectory,
  searchTargets,
  type CallResult,
  type Directory,
  type Target,
} from '@/lib/attention/attention'

type MenuProps = {
  client: SupabaseClient
  staffId: string
  myRoomId: number | null
  buttonClass: string
}

// ===== 1. The Call attention button =====
export default function AttentionMenu({ client, staffId, myRoomId, buttonClass }: MenuProps) {
  const { open, setOpen } = useAttentionMenu()
  const [directory, setDirectory] = useState<Directory | null>(null)
  const [words, setWords] = useState('')
  const [unfolded, setUnfolded] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // Read the rooms each time the list opens, so a new room shows at once.
  useEffect(() => {
    if (!open) return
    let current = true
    loadDirectory(client, myRoomId).then((found) => {
      if (current) setDirectory(found)
    })
    return () => {
      current = false
    }
  }, [open, client, myRoomId])

  // A tap outside the list, or Escape, shuts it.
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, setOpen])

  // Shutting the list clears the search for next time.
  function toggle() {
    if (open) {
      setWords('')
      setUnfolded(null)
    }
    setOpen(!open)
  }

  const found = directory ? searchTargets(directory, words) : []

  return (
    <div className={styles.menuWrap} ref={box}>
      <button
        className={buttonClass}
        onClick={toggle}
        aria-expanded={open}
        aria-controls="attention-list"
        aria-label="Call attention"
      >
        <Icon name="call" size={16} />
        <span>Call attention</span>
      </button>

      {/* ===== 3. The list ===== */}
      {open ? (
        <div id="attention-list" className={styles.panel} role="dialog" aria-label="Call attention">
          <div className={styles.search}>
            <Icon name="find" size={15} />
            <input
              aria-label="Find a room or a person"
              placeholder="Find a room or a person"
              value={words}
              onChange={(event) => setWords(event.target.value)}
            />
          </div>

          {!directory ? <p className={styles.quiet}>Loading…</p> : null}

          {directory && words.trim() ? (
            found.length ? (
              found.map((target) => (
                <CallLine key={`${target.kind}:${target.roomId}`} client={client} target={target} />
              ))
            ) : (
              <p className={styles.quiet}>Nothing matches “{words.trim()}”.</p>
            )
          ) : null}

          {directory && !words.trim() ? (
            <>
              {directory.groups.map((target) => (
                <CallLine key={target.kind} client={client} target={target} />
              ))}
              {directory.lists.map((list) => (
                <div key={list.kind}>
                  <button
                    className={styles.fold}
                    aria-expanded={unfolded === list.kind}
                    onClick={() => setUnfolded(unfolded === list.kind ? null : list.kind)}
                  >
                    <span>{list.label}</span>
                    <small>{list.rooms.length}</small>
                    <svg
                      className={styles.chevron}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                  {unfolded === list.kind ? (
                    <div className={styles.rooms}>
                      {list.rooms.map((target) => (
                        <CallLine key={target.roomId} client={client} target={target} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </>
          ) : null}
          {/* Alerts when the app is closed (step 2). */}
          <AlertsSwitch client={client} staffId={staffId} />
        </div>
      ) : null}
    </div>
  )
}

// ===== 2. One line =====
function CallLine({ client, target }: { client: SupabaseClient; target: Target }) {
  const [state, setState] = useState<'idle' | 'ringing' | CallResult>('idle')

  async function call() {
    if (state === 'ringing') return
    setState('ringing')
    // The phone shakes while the call is saved, for at least 0.6 seconds.
    const [result] = await Promise.all([
      callAttention(client, target),
      new Promise((done) => setTimeout(done, 600)),
    ])
    setState(result)
    setTimeout(() => setState('idle'), 3000)
  }

  const words =
    state === 'sent'
      ? 'Sent'
      : state === 'already_sent'
        ? 'Already sent'
        : state === 'failed'
          ? 'Not sent. Tap again'
          : null

  return (
    <button className={styles.line} onClick={call}>
      <span className={styles.lineText}>
        <b>{target.label}</b>
        {target.detail ? <small>{target.detail}</small> : null}
      </span>
      <small className={state === 'failed' ? styles.bad : styles.good} aria-live="polite">
        {words}
      </small>
      <span
        className={`${styles.mark} ${state === 'ringing' ? styles.shake : ''} ${
          state === 'sent' || state === 'already_sent' ? styles.done : ''
        } ${state === 'failed' ? styles.failed : ''}`}
        aria-hidden="true"
      >
        {state === 'sent' || state === 'already_sent' ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <Icon name="call" size={16} />
        )}
      </span>
    </button>
  )
}
