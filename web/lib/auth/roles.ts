/*
 * lib/auth/roles.ts: how each staff role is written on screen.
 *
 * Why: the database stores roles as short codes (front_desk, matron). Staff
 * should read words ("Front Desk", "Matron"), the same as the RHEMA demo.
 *
 * Never: decide access from these words. Access is decided in the database.
 */
const ROLE_LABELS: Record<string, string> = {
  front_desk: 'Front Desk',
  doctor: 'Doctor',
  nurse: 'Nurse',
  matron: 'Matron',
  pharmacy: 'Pharmacy',
  laboratory: 'Laboratory',
  admin: 'Admin',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

// Does this person see patients in a room (doctor, nurse, matron)? An admin
// who works in a consulting, nursing or matron's room counts too, so they get
// that work first (Anthony, 2026-11-10: "if admin is also a doctor or nurse
// or matron, let them see in the home page what's more urgent and important
// before any admin related information"). The Admin Office does not count.
export function worksWithPatients(staff: { role: string; room: { kind: string } | null }): boolean {
  if (['doctor', 'nurse', 'matron'].includes(staff.role)) return true
  return (
    staff.role === 'admin' && ['consultation', 'nursing', 'matron'].includes(staff.room?.kind ?? '')
  )
}

// Who sees Take payment (Anthony, 2026-11-16, request 213e): the Front Desk,
// and an admin who does not work with patients. A doctor, nurse or matron
// never does, even one who is also an admin. The database checks payments
// on its own; this only decides what the screen shows.
export function takesPayments(staff: {
  role: string
  can_admin?: boolean
  room: { kind: string } | null
}): boolean {
  if (staff.role === 'front_desk') return true
  return Boolean(staff.can_admin) && !worksWithPatients(staff)
}

// Who does what a doctor does on screen (request 241, 2026-11-23:
// "everybody with a consultant room can do everything that a consultant can
// do"): a doctor, or anybody with medical access in a consulting room. The
// database decides the same way (private.is_doctor); this only shows the
// buttons.
type Person = { role: string; can_medical?: boolean; room: { kind: string } | null }
export function actsAsDoctor(staff: Person): boolean {
  if (staff.role === 'doctor') return true
  return Boolean(staff.can_medical) && staff.room?.kind === 'consultation'
}

// Who sets prices and adds bills: the same, and the matron anywhere
// (private.sets_prices).
export function setsPrices(staff: Person): boolean {
  return staff.role === 'matron' || actsAsDoctor(staff)
}

// Two letters for the round name badge, e.g. "Chioma Eze" -> "CE".
export function initials(name: string): string {
  const parts = name
    .replace(/^dr\.?\s+/i, '')
    .trim()
    .split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}
