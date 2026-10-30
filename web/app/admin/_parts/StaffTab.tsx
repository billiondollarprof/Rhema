/*
 * app/admin/_parts/StaffTab.tsx: every staff member, and changing one.
 *
 * Why: Anthony, 2026-10-30: "The admin can change anybody's room or access
 * and can switch a person off." Suspend keeps the account ("suspend does
 * not mean the person will have to get a new invitation"). Revoke ends it;
 * the person can be invited again and starts fresh. All three ask for the
 * admin's PIN.
 *
 * Never: offer suspend or revoke on the admin's own row. Never change a
 * person without the Save button or the PIN box.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import AccessTicks from './AccessTicks'
import PinCheck from './PinCheck'
import styles from './admin.module.css'
import PersonBadge from '@/components/auth/PersonBadge'
import {
  ROLES,
  accessForRole,
  changeAccess,
  saveStaff,
  type Access,
  type RoomRow,
  type StaffRow,
} from '@/lib/admin/admin'
import { roleLabel } from '@/lib/auth/roles'

type Change = 'suspend' | 'unsuspend' | 'revoke'

// ===== 1. The words for each change =====
const CHANGE_WORDS: Record<Change, { action: string; explain: string; serious: boolean }> = {
  suspend: {
    action: 'Suspend',
    explain: 'They cannot sign in until you unsuspend them. Nothing they did is lost.',
    serious: true,
  },
  unsuspend: {
    action: 'Unsuspend',
    explain: 'They can sign in again with their email.',
    serious: false,
  },
  revoke: {
    action: 'Revoke',
    explain:
      'Their access ends. To bring them back, invite them again and they start fresh with a new PIN. Nothing they did is lost.',
    serious: true,
  },
}

export function staffState(person: StaffRow): 'active' | 'suspended' | 'revoked' {
  if (person.revoked_at) return 'revoked'
  return person.is_active ? 'active' : 'suspended'
}

const STATE_TAG = {
  active: ['Active', styles.tagGreen],
  suspended: ['Suspended', styles.tagAmber],
  revoked: ['Revoked', styles.tagGrey],
} as const

// ===== 2. The list =====
export default function StaffTab({
  client,
  myId,
  staff,
  rooms,
  reload,
}: {
  client: SupabaseClient
  myId: string
  staff: StaffRow[]
  rooms: RoomRow[]
  reload: () => Promise<void>
}) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const chosen = staff.find((person) => person.id === chosenId) ?? null
  const roomName = (id: number | null) => rooms.find((room) => room.id === id)?.name ?? 'No room'

  return (
    <div className={styles.split}>
      <div className={styles.card}>
        <h3>Staff ({staff.length})</h3>
        <div className={styles.list}>
          {staff.map((person) => {
            const [words, colour] = STATE_TAG[staffState(person)]
            return (
              <button
                key={person.id}
                className={styles.row}
                aria-current={person.id === chosenId}
                onClick={() => setChosenId(person.id)}
              >
                <PersonBadge name={person.full_name} />
                <span className={styles.rowText}>
                  <b>{person.full_name}</b>
                  <small>
                    {roleLabel(person.role)}
                    {person.can_admin && person.role !== 'admin' ? ' · Admin' : ''} ·{' '}
                    {roomName(person.room_id)}
                  </small>
                </span>
                <span className={`${styles.tag} ${colour}`}>{words}</span>
              </button>
            )
          })}
        </div>
      </div>

      {chosen ? (
        <PersonEditor
          // A new key per person starts the form fresh.
          key={chosen.id}
          client={client}
          person={chosen}
          isMe={chosen.id === myId}
          rooms={rooms}
          reload={reload}
        />
      ) : (
        <div className={styles.card}>
          <p className={styles.muted}>Tap a name to change their room or access.</p>
        </div>
      )}
    </div>
  )
}

// ===== 3. One person: role, room, access, and the PIN changes =====
function PersonEditor({
  client,
  person,
  isMe,
  rooms,
  reload,
}: {
  client: SupabaseClient
  person: StaffRow
  isMe: boolean
  rooms: RoomRow[]
  reload: () => Promise<void>
}) {
  const [role, setRole] = useState(person.role)
  const [roomId, setRoomId] = useState<number | null>(person.room_id)
  const [access, setAccess] = useState<Access>({
    can_patients: person.can_patients,
    can_medical: person.can_medical,
    can_pharmacy: person.can_pharmacy,
    can_lab: person.can_lab,
    can_announce: person.can_announce,
    can_admin: person.can_admin,
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ good: boolean; text: string } | null>(null)
  const [asking, setAsking] = useState<Change | null>(null)
  const state = staffState(person)

  // On a phone the editor sits under the list, so bring it into view.
  const card = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (window.innerWidth < 900)
      card.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // A new role brings that role's starting access, as on the invite form.
  function pickRole(next: string) {
    setRole(next)
    setAccess(accessForRole(next))
  }

  async function save() {
    setBusy(true)
    setMessage(null)
    const problem = await saveStaff(client, person.id, { role, room_id: roomId, ...access })
    if (!problem) await reload()
    setBusy(false)
    setMessage(problem ? { good: false, text: problem } : { good: true, text: 'Saved.' })
  }

  return (
    <div className={styles.card} ref={card}>
      <div className={styles.sectionHead}>
        <PersonBadge name={person.full_name} />
        <div>
          <b>{person.full_name}</b>
          <small>{person.email}</small>
        </div>
      </div>

      {state === 'revoked' ? (
        <p className={styles.muted}>
          Revoked. To bring them back, invite them again from the Invite tab.
        </p>
      ) : (
        <>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="edit-role">Role</label>
              <select
                id="edit-role"
                className={styles.input}
                value={role}
                onChange={(event) => pickRole(event.target.value)}
              >
                {ROLES.map(([value, words]) => (
                  <option key={value} value={value}>
                    {words}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="edit-room">Room</label>
              <select
                id="edit-room"
                className={styles.input}
                value={roomId ?? ''}
                onChange={(event) =>
                  setRoomId(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">No room</option>
                {rooms
                  .filter((room) => room.is_active)
                  .map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <AccessTicks value={access} onChange={setAccess} open />
          {message ? (
            <p className={message.good ? styles.good : styles.error}>{message.text}</p>
          ) : null}
          <div className={styles.buttons}>
            <button className={`${styles.button} ${styles.primary}`} onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      )}

      {/* ----- Suspend, unsuspend, revoke: never on your own account ----- */}
      {isMe ? (
        <p className={styles.muted}>This is you. Another admin can suspend or revoke you.</p>
      ) : (
        <div className={styles.buttons}>
          {state === 'active' ? (
            <button
              className={`${styles.button} ${styles.danger}`}
              onClick={() => setAsking('suspend')}
            >
              Suspend
            </button>
          ) : null}
          {state === 'suspended' ? (
            <button className={styles.button} onClick={() => setAsking('unsuspend')}>
              Unsuspend
            </button>
          ) : null}
          {state !== 'revoked' ? (
            <button
              className={`${styles.button} ${styles.danger}`}
              onClick={() => setAsking('revoke')}
            >
              Revoke
            </button>
          ) : null}
        </div>
      )}

      {asking ? (
        <PinCheck
          title={`${CHANGE_WORDS[asking].action} ${person.full_name}?`}
          explain={CHANGE_WORDS[asking].explain}
          action={CHANGE_WORDS[asking].action}
          serious={CHANGE_WORDS[asking].serious}
          run={(pin) => changeAccess(client, person.id, asking, pin)}
          onDone={async () => {
            setAsking(null)
            await reload()
          }}
          onCancel={() => setAsking(null)}
        />
      ) : null}
    </div>
  )
}
