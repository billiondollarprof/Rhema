/*
 * app/admin/_parts/InviteTab.tsx: invite a new staff member, and the
 * invitations still open.
 *
 * Why: the demo's "Invite staff" form, and Anthony, 2026-10-30: the
 * invitation is a link that opens sign in with the email already typed in,
 * but "if they do not click the link, they can still type in the email".
 * It lasts 72 hours; "the admin will see that this invitation has expired"
 * and can send it again. Cancelling asks for the admin's PIN.
 *
 * Saving the invitation also emails it (2026-11-07, through the Worker and
 * Resend). Each invitation keeps a "Copy link" button too, for when the
 * email does not arrive and the link goes another way, such as WhatsApp.
 *
 * Never: show an invitation as waiting once it has run out.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import AccessTicks from './AccessTicks'
import PinCheck from './PinCheck'
import styles from './admin.module.css'
import Icon from '@/components/shell/Icon'
import {
  ROLES,
  accessForRole,
  cancelInvite,
  emailInvite,
  inviteLink,
  inviteStaff,
  inviteState,
  sendInviteAgain,
  timeLeftWords,
  type Access,
  type InviteRow,
  type RoomRow,
} from '@/lib/admin/admin'
import { roleLabel } from '@/lib/auth/roles'

// ===== 1. The tab: the form, then the open invitations =====
export default function InviteTab({
  client,
  invites,
  rooms,
  reload,
}: {
  client: SupabaseClient
  invites: InviteRow[]
  rooms: RoomRow[]
  reload: () => Promise<void>
}) {
  return (
    <div className={styles.split}>
      <InviteForm client={client} rooms={rooms} reload={reload} />
      <Invitations client={client} invites={invites} reload={reload} />
    </div>
  )
}

// ===== 2. The form =====
function InviteForm({
  client,
  rooms,
  reload,
}: {
  client: SupabaseClient
  rooms: RoomRow[]
  reload: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('front_desk')
  const [roomId, setRoomId] = useState<number | null>(null)
  const [access, setAccess] = useState<Access>(accessForRole('front_desk'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  const cleanEmail = email.trim().toLowerCase()
  const ready =
    name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail) && roomId !== null

  async function send() {
    setBusy(true)
    setError(null)
    const problem = await inviteStaff(client, {
      email: cleanEmail,
      full_name: name.trim(),
      role,
      room_id: roomId,
      ...access,
    })
    if (problem) {
      setBusy(false)
      setError(problem)
      return
    }
    // Saved. Now email it; if the email fails, the link can still be copied.
    const emailProblem = await emailInvite(client, cleanEmail)
    setBusy(false)
    if (emailProblem) setError(emailProblem)
    else setSent(cleanEmail)
    setName('')
    setEmail('')
    await reload()
  }

  return (
    <div className={styles.card}>
      <div className={styles.sectionHead}>
        <i>
          <Icon name="reg" size={20} />
        </i>
        <div>
          <b>Invite a new staff member</b>
          <small>They sign in with a code sent to this email</small>
        </div>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="invite-name">Full name</label>
          <input
            id="invite-name"
            className={styles.input}
            placeholder="e.g. Chioma Eze"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="invite-email">Email</label>
          <input
            id="invite-email"
            className={styles.input}
            type="email"
            inputMode="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="invite-role">Role</label>
          <select
            id="invite-role"
            className={styles.input}
            value={role}
            onChange={(event) => {
              setRole(event.target.value)
              setAccess(accessForRole(event.target.value))
              // An admin goes to an Admin Office, if there is one.
              const office = rooms.find((room) => room.kind === 'office' && room.is_active)
              if (event.target.value === 'admin' && office) setRoomId(office.id)
            }}
          >
            {ROLES.map(([value, words]) => (
              <option key={value} value={value}>
                {words}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="invite-room">Room</label>
          <select
            id="invite-room"
            className={styles.input}
            value={roomId ?? ''}
            onChange={(event) => setRoomId(event.target.value ? Number(event.target.value) : null)}
          >
            {/* Everybody has a room, admins included (Anthony, 2026-11-09,
                option A): messages go from room to room. */}
            <option value="" disabled>
              Choose a room
            </option>
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

      <AccessTicks value={access} onChange={setAccess} />

      {error ? <p className={styles.error}>{error}</p> : null}
      {sent ? (
        <p className={styles.good}>
          Invitation emailed to {sent}. It lasts 72 hours. Ask them to check spam too.
        </p>
      ) : null}

      <button
        className={`${styles.button} ${styles.primary}`}
        onClick={send}
        disabled={!ready || busy}
      >
        {busy ? 'Sending…' : 'Send invitation'}
      </button>
    </div>
  )
}

// ===== 3. The open invitations =====
const STATE_TAG = {
  waiting: ['Waiting', styles.tagGreen],
  expired: ['Expired', styles.tagRed],
  cancelled: ['Cancelled', styles.tagGrey],
} as const

function Invitations({
  client,
  invites,
  reload,
}: {
  client: SupabaseClient
  invites: InviteRow[]
  reload: () => Promise<void>
}) {
  const [cancelling, setCancelling] = useState<InviteRow | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const [shownLink, setShownLink] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function copy(invite: InviteRow) {
    try {
      await navigator.clipboard.writeText(inviteLink(invite.email))
      setCopied(invite.id)
      setShownLink(null)
    } catch {
      // Copying is blocked here: show the link so it can be selected.
      setShownLink(invite.id)
    }
  }

  async function again(invite: InviteRow) {
    setError(null)
    const problem = await sendInviteAgain(client, invite.id)
    if (problem) setError(problem)
    else {
      const emailProblem = await emailInvite(client, invite.email)
      if (emailProblem) setError(emailProblem)
    }
    await reload()
  }

  return (
    <div className={styles.card}>
      <h3>Invitations</h3>
      {invites.length === 0 ? <p className={styles.muted}>No open invitations.</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.list}>
        {invites.map((invite) => {
          const state = inviteState(invite)
          const [words, colour] = STATE_TAG[state]
          return (
            <div key={invite.id} className={styles.row}>
              <span className={styles.rowText}>
                <b>{invite.full_name}</b>
                <small>
                  {invite.email} · {roleLabel(invite.role)}
                </small>
                <small>
                  {state === 'waiting'
                    ? timeLeftWords(invite.expires_at)
                    : state === 'expired'
                      ? 'The link no longer works. Send it again.'
                      : 'The link no longer works.'}
                </small>
              </span>
              <span className={`${styles.tag} ${colour}`}>{words}</span>
              <div className={styles.buttons}>
                {state === 'waiting' ? (
                  <>
                    <button
                      className={`${styles.button} ${styles.small}`}
                      onClick={() => copy(invite)}
                    >
                      {copied === invite.id ? 'Copied' : 'Copy link'}
                    </button>
                    <button
                      className={`${styles.button} ${styles.small} ${styles.danger}`}
                      onClick={() => setCancelling(invite)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className={`${styles.button} ${styles.small} ${styles.primary}`}
                    onClick={() => again(invite)}
                  >
                    Send again
                  </button>
                )}
              </div>
              {shownLink === invite.id ? (
                <div className={styles.link}>{inviteLink(invite.email)}</div>
              ) : null}
            </div>
          )
        })}
      </div>

      {cancelling ? (
        <PinCheck
          title={`Cancel the invitation for ${cancelling.full_name}?`}
          explain="The link stops working. You can invite them again later."
          action="Cancel invitation"
          serious
          run={(pin) => cancelInvite(client, cancelling.id, pin)}
          onDone={async () => {
            setCancelling(null)
            await reload()
          }}
          onCancel={() => setCancelling(null)}
        />
      ) : null}
    </div>
  )
}
