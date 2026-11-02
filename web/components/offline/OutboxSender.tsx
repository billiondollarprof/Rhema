/*
 * components/offline/OutboxSender.tsx: sends what waited on this device
 * while the network was down, and keeps the device copy of recent patients
 * fresh (request 128, step 3).
 *
 * Why: Anthony, 2026-11-02: "when the network is back, the system just
 * automatically push it to server." And: "let them not say that the system
 * is slow, but let them understand that it's the network."
 *
 * When it tries: a few seconds after the app opens, the moment the device
 * says the network is back, and every 30 seconds. Before sending anything
 * again it checks the database does not already have it, so a reply lost
 * on the way never makes a double.
 *
 * What shows: a small pill, "2 entries are waiting for the network", only while something
 * waits. Tap it to see what. Anything the database refused (not a network
 * problem) says so, with Discard.
 *
 * Never: send something twice, or hide that something has not been sent.
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './offline.module.css'
import {
  OUTBOX_CHANGED,
  isNetworkFailure,
  markFailed,
  readOutbox,
  removeFromOutbox,
  type OutboxTask,
} from '@/lib/offline/outbox'
import { refreshCopy } from '@/lib/offline/patientCopy'
import { CARD_COLUMNS } from '@/lib/patients/patients'

// The column holding when a row was saved, per table.
const TIME_COLUMN: Record<string, string> = { vital_signs: 'recorded_at' }

// ===== 1. Is it already saved? (a reply that got lost on the way) =====
async function alreadySaved(client: SupabaseClient, task: OutboxTask): Promise<boolean> {
  const since = new Date(task.created - 60_000).toISOString()
  // A message is checked by its key in the database itself.
  if (task.kind === 'message') return false
  if (task.kind === 'register') {
    const { data } = await client
      .from('patients')
      .select('id')
      .eq('created_by', String(task.values.created_by))
      .eq('full_name', String(task.values.full_name))
      .gte('created_at', since)
      .limit(1)
    return Boolean(data && data.length)
  }
  // Every plain value must match, saved at or after the task was made.
  const plain = Object.fromEntries(
    Object.entries(task.values).filter(([, value]) => value !== null && typeof value !== 'object'),
  ) as Record<string, string | number | boolean>
  const { data } = await client
    .from(task.table)
    .select('id')
    .match(plain)
    .gte(TIME_COLUMN[task.table] ?? 'created_at', since)
    .limit(1)
  return Boolean(data && data.length)
}

// ===== 2. Send one; answers false when the network is still down =====
async function sendOne(client: SupabaseClient, staffId: string, task: OutboxTask) {
  // A message carries its own key: sending it again is the same message.
  if (task.kind === 'message') {
    const { error } = await client.rpc('send_message', {
      to_kind: task.toKind,
      to_room: task.toRoom,
      body: task.body,
      client_key: task.clientKey,
    })
    if (isNetworkFailure(error)) return false
    if (error) markFailed(staffId, task.id, 'Could not be sent. Open Messages and send it again.')
    else removeFromOutbox(staffId, task.id)
    return true
  }
  try {
    if (await alreadySaved(client, task)) {
      removeFromOutbox(staffId, task.id)
      return true
    }
  } catch {
    return false
  }
  const table = task.kind === 'register' ? 'patients' : task.table
  const { error } = await client.from(table).insert(task.values)
  if (isNetworkFailure(error)) return false
  // The double tap guard: the first one is in already.
  if (!error || error.code === '23505') {
    removeFromOutbox(staffId, task.id)
    return true
  }
  markFailed(
    staffId,
    task.id,
    task.kind === 'register'
      ? 'Could not be registered. Check the details and register again.'
      : 'Could not be saved. Open the record and add it again.',
  )
  return true
}

export default function OutboxSender({
  client,
  staffId,
}: {
  client: SupabaseClient
  staffId: string
}) {
  const [tasks, setTasks] = useState<OutboxTask[]>([])
  const [open, setOpen] = useState(false)
  const sending = useRef(false)

  // ===== 3. Send everything waiting, in order, stopping if the network drops =====
  const sendAll = useCallback(async () => {
    if (sending.current) return
    sending.current = true
    for (const task of readOutbox(staffId)) {
      if (task.failed) continue
      if (!(await sendOne(client, staffId, task))) break
    }
    sending.current = false
  }, [client, staffId])

  useEffect(() => {
    const show = () => setTasks(readOutbox(staffId))
    const first = window.setTimeout(() => {
      show()
      void sendAll()
    }, 3000)
    const timer = window.setInterval(() => void sendAll(), 30_000)
    const online = () => void sendAll()
    window.addEventListener(OUTBOX_CHANGED, show)
    window.addEventListener('online', online)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      window.removeEventListener(OUTBOX_CHANGED, show)
      window.removeEventListener('online', online)
    }
  }, [staffId, sendAll])

  // ===== 4. The device copy: soon after opening, then every 10 minutes =====
  useEffect(() => {
    const refresh = () => void refreshCopy(client, staffId, CARD_COLUMNS)
    const first = window.setTimeout(refresh, 5000)
    const timer = window.setInterval(refresh, 10 * 60_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [client, staffId])

  if (tasks.length === 0) return null
  const failed = tasks.filter((task) => task.failed).length

  // ===== 5. The pill, and what is waiting =====
  return (
    <div className={styles.wrap}>
      {open ? (
        <div className={styles.panel}>
          <b>Waiting to send</b>
          <ul>
            {tasks.map((task) => (
              <li key={task.id}>
                <span>
                  {task.label}
                  <small>{task.failed ?? 'Sends when the network is back'}</small>
                </span>
                {task.failed ? (
                  <button onClick={() => removeFromOutbox(staffId, task.id)}>Discard</button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        className={`${styles.pill} ${failed ? styles.pillFailed : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {failed
          ? `${failed === 1 ? '1 entry' : `${failed} entries`} could not be sent`
          : `${tasks.length === 1 ? '1 entry is' : `${tasks.length} entries are`} waiting for the network`}
      </button>
    </div>
  )
}
