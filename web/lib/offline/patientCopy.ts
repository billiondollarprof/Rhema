/*
 * lib/offline/patientCopy.ts: a copy, on this device, of the patients the
 * hospital is working with now, so Find patient and the patient's details
 * still open when the network is slow or down (request 128, step 3).
 *
 * Why: Anthony, 2026-11-02: "bring data of people who are currently being
 * managed or being treated, and leave those who they're probably not
 * attending to in the last 30 days." And: "Never load file, never load
 * pictures." So: registration details only (text), for patients whose
 * details changed or who were sent to a room in the last 30 days.
 *
 * The medical record itself is not copied: opening a record must reach the
 * database, because every opening goes in the activity log (CLAUDE.md 10).
 *
 * Refreshed quietly after Home shows, then every 10 minutes. Wiped when
 * the person signs out.
 *
 * Never: copy a file, a picture or the medical record; keep the copy after
 * sign out.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PatientCard } from '@/lib/patients/patients'

const DAYS = 30

function key(staffId: string) {
  return `rhema-patients-${staffId}`
}

// ===== 1. Read and wipe =====
export function readCopy(staffId: string): PatientCard[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key(staffId)) ?? 'null') as {
      patients: PatientCard[]
    } | null
    return saved?.patients ?? []
  } catch {
    return []
  }
}

export function wipeCopy(staffId: string) {
  try {
    localStorage.removeItem(key(staffId))
  } catch {
    // Nothing to wipe.
  }
}

// ===== 2. Refresh from the database =====
// columns: the same registration columns Find patient reads.
export async function refreshCopy(
  client: SupabaseClient,
  staffId: string,
  columns: string,
): Promise<void> {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()
  const [changed, visits] = await Promise.all([
    client
      .from('patients')
      .select(columns)
      .is('voided_at', null)
      .gte('updated_at', since)
      .limit(3000),
    client.from('queue_entries').select('patient_id').gte('created_at', since).limit(5000),
  ])
  if (changed.error || visits.error) return
  const patients = (changed.data as unknown as PatientCard[]) ?? []
  const have = new Set(patients.map((patient) => patient.id))
  const seen = [
    ...new Set(
      ((visits.data as { patient_id: number }[]) ?? [])
        .map((visit) => visit.patient_id)
        .filter((id) => !have.has(id)),
    ),
  ]
  // Patients seen in a room but not changed: fetched in groups of 200.
  for (let at = 0; at < seen.length; at += 200) {
    const { data } = await client
      .from('patients')
      .select(columns)
      .is('voided_at', null)
      .in('id', seen.slice(at, at + 200))
    patients.push(...((data as unknown as PatientCard[]) ?? []))
  }
  try {
    localStorage.setItem(key(staffId), JSON.stringify({ saved: Date.now(), patients }))
  } catch {
    // Storage full or blocked: Find patient simply needs the network.
  }
}

// ===== 3. Search the copy, the same way Find patient searches =====
export function searchCopy(staffId: string, typed: string): PatientCard[] {
  const words = typed.trim().toLowerCase()
  const digits = typed.replace(/\D/g, '')
  const all = readCopy(staffId)
  if (!words) return all.slice(0, 30)
  return all
    .filter(
      (patient) =>
        patient.full_name.toLowerCase().includes(words) ||
        patient.patient_number.toLowerCase().includes(words) ||
        (patient.family?.family_number ?? '').toLowerCase().includes(words) ||
        (digits.length >= 4 && (patient.phone ?? '').includes(digits)),
    )
    .slice(0, 30)
}
