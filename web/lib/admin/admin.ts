/*
 * lib/admin/admin.ts: everything the Admin screen reads and writes.
 *
 * Why: request 112 (Anthony, 2026-10-30). The admin invites staff, changes
 * a person's room or access, suspends, unsuspends or revokes them with
 * their own PIN, adds and renames rooms, and sees who signed in and what
 * they did today.
 *
 * Every change here goes through the database, which checks the admin and
 * the PIN itself (supabase/migrations/20261030120025_staff_invites.sql).
 * The screen only asks.
 *
 * Never: decide here who is an admin, or check a PIN here. Never put a
 * patient's name or details into an activity line; a line names the record.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Shapes =====
export type Access = {
  can_patients: boolean
  can_medical: boolean
  can_pharmacy: boolean
  can_lab: boolean
  can_announce: boolean
  can_admin: boolean
}

export type StaffRow = Access & {
  id: string
  full_name: string
  email: string
  role: string
  room_id: number | null
  is_active: boolean
  revoked_at: string | null
}

export type InviteRow = Access & {
  id: number
  email: string
  full_name: string
  role: string
  room_id: number | null
  created_at: string
  expires_at: string
  status: 'waiting' | 'accepted' | 'cancelled' | 'replaced'
}

export type RoomRow = { id: number; name: string; kind: string; is_active: boolean }

export type SessionRow = {
  staff_id: string
  started_at: string
  last_seen_at: string
  ended_at: string | null
}

export type LogRow = {
  id: number
  happened_at: string
  actor_id: string | null
  action: string
  table_name: string
  record_id: string
  patient_id: number | null
  changed_fields: string[] | null
  // The patient's number, when this admin may see patients.
  patient: { patient_number: string } | null
}

// ===== 2. Words for roles, access and room kinds =====
export const ROLES: [string, string][] = [
  ['front_desk', 'Front Desk'],
  ['doctor', 'Doctor'],
  ['nurse', 'Nurse'],
  ['matron', 'Matron'],
  ['pharmacy', 'Pharmacy'],
  ['laboratory', 'Laboratory'],
  ['admin', 'Admin'],
]

// The six ticks, in the demo's order and words.
export const ACCESS: [keyof Access, string][] = [
  ['can_patients', 'Register and find patients'],
  ['can_medical', 'Medical records'],
  ['can_pharmacy', 'Pharmacy'],
  ['can_lab', 'Laboratory'],
  ['can_announce', 'Post announcements'],
  ['can_admin', 'Admin: invite staff, rooms and activity log'],
]

export const ROOM_KINDS: [string, string][] = [
  ['consultation', 'Consultant room'],
  ['nursing', 'Nursing station'],
  ['matron', "Matron's office"],
  ['laboratory', 'Laboratory'],
  ['pharmacy', 'Pharmacy'],
  ['front_desk', 'Front desk'],
]

// The starting ticks for a role, the same as the database gives a new
// person (set_default_permissions). The admin can change each one.
export function accessForRole(role: string): Access {
  return {
    can_patients: true,
    can_medical: ['doctor', 'nurse', 'matron', 'admin'].includes(role),
    can_pharmacy: ['pharmacy', 'doctor', 'admin'].includes(role),
    can_lab: ['laboratory', 'doctor', 'admin'].includes(role),
    can_announce: ['admin', 'nurse', 'matron'].includes(role),
    can_admin: role === 'admin',
  }
}

// ===== 3. Reading =====
const STAFF_COLUMNS =
  'id, full_name, email, role, room_id, is_active, revoked_at, ' +
  'can_patients, can_medical, can_pharmacy, can_lab, can_announce, can_admin'

export async function listStaff(client: SupabaseClient): Promise<StaffRow[]> {
  const { data } = await client.from('staff').select(STAFF_COLUMNS).order('full_name')
  return (data as unknown as StaffRow[] | null) ?? []
}

export async function listInvites(client: SupabaseClient): Promise<InviteRow[]> {
  const { data } = await client
    .from('staff_invites')
    .select(
      'id, email, full_name, role, room_id, created_at, expires_at, status, ' +
        'can_patients, can_medical, can_pharmacy, can_lab, can_announce, can_admin',
    )
    .in('status', ['waiting', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(100)
  return (data as unknown as InviteRow[] | null) ?? []
}

export async function listRooms(client: SupabaseClient): Promise<RoomRow[]> {
  const { data } = await client.from('rooms').select('id, name, kind, is_active').order('name')
  return (data as RoomRow[] | null) ?? []
}

// Today, from midnight on this device's clock.
function startOfToday(): string {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  return midnight.toISOString()
}

export async function loadToday(
  client: SupabaseClient,
): Promise<{ sessions: SessionRow[]; lines: LogRow[] }> {
  const since = startOfToday()
  const [sessions, lines] = await Promise.all([
    client
      .from('staff_sessions')
      .select('staff_id, started_at, last_seen_at, ended_at')
      .or(`started_at.gte.${since},last_seen_at.gte.${since}`)
      .order('started_at'),
    client
      .from('activity_log')
      .select(
        'id, happened_at, actor_id, action, table_name, record_id, patient_id, changed_fields, ' +
          'patient:patients(patient_number)',
      )
      .gte('happened_at', since)
      .order('happened_at', { ascending: false })
      .limit(1000),
  ])
  return {
    sessions: (sessions.data as SessionRow[] | null) ?? [],
    lines: (lines.data as LogRow[] | null) ?? [],
  }
}

// ===== 4. Invitations =====
export type InviteForm = Access & {
  email: string
  full_name: string
  role: string
  room_id: number | null
}

// What the database answered, in words for the admin.
const INVITE_WORDS: Record<string, string> = {
  invited: '',
  already_sent: '',
  already_staff: 'This email already belongs to a staff member.',
  suspended: 'This person is suspended. Open them in Staff and tap Unsuspend instead.',
  already_invited: 'This email already has a waiting invitation.',
  still_waiting: 'This invitation is still waiting. It has not run out yet.',
  not_needed: 'This invitation was already used.',
}

// Returns null when it worked, or the words to show.
export async function inviteStaff(client: SupabaseClient, form: InviteForm) {
  const { data, error } = await client.rpc('invite_staff', {
    person_email: form.email,
    person_name: form.full_name,
    person_role: form.role,
    person_room: form.room_id,
    patients: form.can_patients,
    medical: form.can_medical,
    pharmacy: form.can_pharmacy,
    lab: form.can_lab,
    announce: form.can_announce,
    admin: form.can_admin,
  })
  if (error) return 'The invitation could not be saved. Check the internet and try again.'
  return INVITE_WORDS[data as string] || null
}

export async function sendInviteAgain(client: SupabaseClient, inviteId: number) {
  const { data, error } = await client.rpc('send_invite_again', { invite_id: inviteId })
  if (error) return 'It could not be sent again. Check the internet and try again.'
  return INVITE_WORDS[data as string] || null
}

// The link in the invitation: the sign in page with the email already
// typed in. The email rides after the #, so it never reaches a server log.
export function inviteLink(email: string): string {
  return `${window.location.origin}/sign-in/#email=${encodeURIComponent(email)}`
}

export type InviteState = 'waiting' | 'expired' | 'cancelled'

export function inviteState(invite: InviteRow): InviteState {
  if (invite.status === 'cancelled') return 'cancelled'
  return new Date(invite.expires_at).getTime() > Date.now() ? 'waiting' : 'expired'
}

// "Runs out in 71 hours", "Runs out in 40 minutes".
export function timeLeftWords(expiresAt: string): string {
  const minutes = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000))
  if (minutes >= 120) return `Runs out in ${Math.floor(minutes / 60)} hours`
  if (minutes >= 60) return 'Runs out in 1 hour'
  return `Runs out in ${minutes} minutes`
}

// ===== 5. Changes that need the admin's PIN =====
// Answers: null when it worked, 'locked' when 5 wrong PINs locked the
// admin out (they must sign in again), or the words to show.
export type PinResult = null | 'locked' | string

function pinWords(answer: string): PinResult {
  if (answer === 'done' || answer === 'cancelled' || answer === 'already') return null
  if (answer === 'locked') return 'locked'
  if (answer === 'wrong_pin') return 'That PIN is not right. Try again.'
  if (answer === 'not_yourself') return 'You cannot change your own account here.'
  return 'That did not work. Try again.'
}

export async function changeAccess(
  client: SupabaseClient,
  person: string,
  change: 'suspend' | 'unsuspend' | 'revoke',
  pin: string,
): Promise<PinResult> {
  const { data, error } = await client.rpc('change_staff_access', { person, change, pin })
  if (error) {
    if (error.message.includes('last admin')) {
      return 'This is the last admin. Make somebody else an admin first.'
    }
    return 'That did not work. Check the internet and try again.'
  }
  return pinWords(data as string)
}

export async function cancelInvite(
  client: SupabaseClient,
  inviteId: number,
  pin: string,
): Promise<PinResult> {
  const { data, error } = await client.rpc('cancel_invite', { invite_id: inviteId, pin })
  if (error) return 'That did not work. Check the internet and try again.'
  return pinWords(data as string)
}

// ===== 6. A person's role, room and access =====
export async function saveStaff(
  client: SupabaseClient,
  id: string,
  change: Access & { role: string; room_id: number | null },
): Promise<string | null> {
  const { error } = await client
    .from('staff')
    .update({ ...change, can_logs: change.can_admin })
    .eq('id', id)
  if (!error) return null
  if (error.message.includes('last admin')) {
    return 'This is the last admin. Make somebody else an admin first.'
  }
  return 'The change could not be saved. Check the internet and try again.'
}

// ===== 7. Rooms =====
export async function addRoom(client: SupabaseClient, name: string, kind: string) {
  const { error } = await client.from('rooms').insert({ name: name.trim(), kind })
  if (!error) return null
  if (error.code === '23505') return 'A room with that name already exists.'
  return 'The room could not be added. Check the internet and try again.'
}

export async function renameRoom(client: SupabaseClient, id: number, name: string) {
  const { error } = await client.from('rooms').update({ name: name.trim() }).eq('id', id)
  if (!error) return null
  if (error.code === '23505') return 'A room with that name already exists.'
  return 'The new name could not be saved. Check the internet and try again.'
}

// ===== 8. The activity log in plain words =====
// What a line says, e.g. "Updated patient RMC-0012: phone, address".
// It names the record, never the person in it.
const THINGS: Record<string, string> = {
  families: 'a family',
  queue_entries: 'a queue entry',
  medical_profiles: 'a medical record',
  allergies: 'an allergy',
  conditions: 'a condition',
  patient_medications: 'a medication',
  medications_given: 'a dose given',
  vital_signs: 'vital signs',
  nursing_notes: 'a nursing note',
  consultation_notes: 'a consultation note',
  push_devices: 'call alerts on a device',
  staff: 'a staff member',
  staff_invites: 'an invitation',
  rooms: 'a room',
}

export function lineWords(line: LogRow): string {
  const patient = line.patient
    ? `patient ${line.patient.patient_number}`
    : line.patient_id
      ? `patient ${line.patient_id}`
      : ''
  const fields = (line.changed_fields ?? []).map((field) => field.replace(/_/g, ' '))
  const what = fields.length ? `: ${fields.join(', ')}` : ''

  if (line.table_name === 'attention_calls') return 'Called for attention'
  if (line.table_name === 'record_openings') return `Opened the medical record of ${patient}`
  if (line.table_name === 'patients') {
    return line.action === 'insert' ? `Registered ${patient}` : `Updated ${patient}${what}`
  }
  const thing = THINGS[line.table_name] ?? line.table_name.replace(/_/g, ' ')
  const forWhom = patient ? ` for ${patient}` : ''
  return line.action === 'insert' ? `Added ${thing}${forWhom}` : `Updated ${thing}${forWhom}${what}`
}
