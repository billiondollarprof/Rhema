/*
 * app/admin/_parts/RoomsTab.tsx: the hospital's rooms; add one or rename one.
 *
 * Why: Anthony, 2026-10-30: the admin "can add a room and rename the
 * room." Rooms are where staff work and where patients are sent, so a new
 * room shows up in Send to room and in Call attention at once.
 *
 * Never: delete a room. Patients' visits point at it.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './admin.module.css'
import { ROOM_KINDS, addRoom, renameRoom, type RoomRow } from '@/lib/admin/admin'

const kindWords = (kind: string) => ROOM_KINDS.find(([value]) => value === kind)?.[1] ?? kind

// ===== 1. The list, with rename =====
export default function RoomsTab({
  client,
  rooms,
  reload,
}: {
  client: SupabaseClient
  rooms: RoomRow[]
  reload: () => Promise<void>
}) {
  const [editingId, setEditingId] = useState<number | null>(null)

  return (
    <div className={styles.split}>
      <div className={styles.card}>
        <h3>Rooms ({rooms.length})</h3>
        <div className={styles.list}>
          {rooms.map((room) =>
            editingId === room.id ? (
              <RenameRow
                key={room.id}
                client={client}
                room={room}
                done={async () => {
                  setEditingId(null)
                  await reload()
                }}
                cancel={() => setEditingId(null)}
              />
            ) : (
              <div key={room.id} className={styles.row}>
                <span className={styles.rowText}>
                  <b>{room.name}</b>
                  <small>{kindWords(room.kind)}</small>
                </span>
                <button
                  className={`${styles.button} ${styles.small}`}
                  onClick={() => setEditingId(room.id)}
                >
                  Rename
                </button>
              </div>
            ),
          )}
        </div>
      </div>
      <AddRoom client={client} reload={reload} />
    </div>
  )
}

// ===== 2. Renaming one room =====
function RenameRow({
  client,
  room,
  done,
  cancel,
}: {
  client: SupabaseClient
  room: RoomRow
  done: () => Promise<void>
  cancel: () => void
}) {
  const [name, setName] = useState(room.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = name.trim().length >= 2 && name.trim() !== room.name

  async function save() {
    setBusy(true)
    setError(null)
    const problem = await renameRoom(client, room.id, name)
    setBusy(false)
    if (problem) setError(problem)
    else await done()
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <label className={styles.muted} htmlFor={`room-${room.id}`}>
          New name for {room.name}
        </label>
        <input
          id={`room-${room.id}`}
          className={styles.input}
          value={name}
          maxLength={60}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && ready && !busy && save()}
        />
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
      <div className={styles.buttons}>
        <button className={`${styles.button} ${styles.small}`} onClick={cancel}>
          Cancel
        </button>
        <button
          className={`${styles.button} ${styles.small} ${styles.primary}`}
          onClick={save}
          disabled={!ready || busy}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ===== 3. Adding a room =====
function AddRoom({ client, reload }: { client: SupabaseClient; reload: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('consultation')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ good: boolean; text: string } | null>(null)

  async function add() {
    setBusy(true)
    setMessage(null)
    const problem = await addRoom(client, name, kind)
    setBusy(false)
    if (problem) {
      setMessage({ good: false, text: problem })
      return
    }
    setMessage({ good: true, text: `${name.trim()} added.` })
    setName('')
    await reload()
  }

  return (
    <div className={styles.card}>
      <h3>Add a room</h3>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="room-name">Name</label>
          <input
            id="room-name"
            className={styles.input}
            placeholder="e.g. Consultant Room 4"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="room-kind">What kind of room</label>
          <select
            id="room-kind"
            className={styles.input}
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {ROOM_KINDS.map(([value, words]) => (
              <option key={value} value={value}>
                {words}
              </option>
            ))}
          </select>
        </div>
      </div>
      {message ? <p className={message.good ? styles.good : styles.error}>{message.text}</p> : null}
      <button
        className={`${styles.button} ${styles.primary}`}
        onClick={add}
        disabled={name.trim().length < 2 || busy}
      >
        {busy ? 'Adding…' : 'Add room'}
      </button>
    </div>
  )
}
