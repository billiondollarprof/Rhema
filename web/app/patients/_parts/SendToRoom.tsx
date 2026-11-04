/*
 * app/patients/_parts/SendToRoom.tsx: send one patient to a room, with an
 * optional note for the staff there.
 *
 * Why: the demo's "Send to room". The patient joins that room's queue and
 * shows on that room's Home. A patient already in a room is moved instead
 * (request 140, Anthony, 2026-11-04: "a patient is in a laboratory, but
 * doctor calls..."): the visit there ends with the time, and a new one
 * starts in the chosen room, so a patient is never in two rooms at once.
 *
 * Never: put clinical detail in the note. Everyone at that desk reads it.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './patients.module.css'
import { loadRooms, sendToRoom } from '@/lib/patients/patients'
import { movePatient } from '@/lib/queue/queue'

type SendProps = {
  client: SupabaseClient
  staffId: string
  patientId: number
  patientName: string
  // The visit the patient is in now, if any: they are moved from it.
  openVisit?: { id: number; room: string } | null
  onSent: (roomName: string) => void
  onCancel: () => void
}

export default function SendToRoom({
  client,
  staffId,
  patientId,
  patientName,
  openVisit = null,
  onSent,
  onCancel,
}: SendProps) {
  const [rooms, setRooms] = useState<{ id: number; name: string; kind: string }[]>([])
  const [roomId, setRoomId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // ===== 1. The rooms a patient can be sent to (not the front desk) =====
  useEffect(() => {
    loadRooms(client).then((all) =>
      setRooms(all.filter((room) => room.kind !== 'front_desk' && room.name !== openVisit?.room)),
    )
  }, [client, openVisit?.room])

  // ===== 2. Send =====
  async function send() {
    if (!roomId) return
    setBusy(true)
    setProblem(null)
    const result = openVisit
      ? await movePatient(client, openVisit.id, roomId, note)
      : await sendToRoom(client, patientId, roomId, note, staffId)
    setBusy(false)
    if (result) setProblem(result)
    else onSent(rooms.find((room) => room.id === roomId)?.name ?? '')
  }

  return (
    <section className={styles.card} aria-label="Send to room">
      <div>
        <b>{openVisit ? `Move ${patientName} to another room` : `Send ${patientName} to a room`}</b>
        <p className={styles.muted}>
          {openVisit
            ? `${patientName} is in ${openVisit.room} now. Moving ends that visit.`
            : 'The staff in that room see the patient on their Home.'}
        </p>
      </div>
      <div className={styles.field}>
        <label htmlFor="send-room">Room</label>
        <select
          id="send-room"
          className={styles.input}
          value={roomId ?? ''}
          onChange={(event) => setRoomId(Number(event.target.value) || null)}
        >
          <option value="">Choose a room</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="send-note">Note for the staff there (optional)</label>
        <input
          id="send-note"
          className={styles.input}
          placeholder="e.g. Please see her first"
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.buttons}>
        <button
          className={`${styles.button} ${styles.primary}`}
          disabled={!roomId || busy}
          onClick={send}
        >
          {busy ? 'Saving…' : openVisit ? 'Move to room' : 'Send to room'}
        </button>
        <button className={styles.button} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
