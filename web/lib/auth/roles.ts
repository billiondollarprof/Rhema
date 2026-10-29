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
