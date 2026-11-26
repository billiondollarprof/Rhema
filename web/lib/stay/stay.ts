/*
 * lib/stay/stay.ts: a patient's stay in the hospital (inpatient or
 * outpatient), Admit and Discharge.
 *
 * Why: Anthony, 2026-11-23 (requests 240 and 242): "a patient can be marked
 * inpatient or outpatient"; "people that can tap admit are the doctor, the
 * matron, the front desk... antenatal patients... switch from being
 * outpatient to inpatient when they come to do delivery"; once the bill is
 * paid "the system can ask the doctor to discharge this patient... once
 * discharge is clicked the person [goes] to outpatient".
 *
 * The database decides who may admit and discharge
 * (supabase/migrations/20261123215523_inpatient_bill.sql); these only ask.
 *
 * Never: decide access here.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { actsAsDoctor } from '@/lib/auth/roles'

// ===== 1. The open stay, or null for an outpatient =====
export type Stay = { id: number; admitted_at: string; admitter: { full_name: string } | null }

export async function loadStay(
  client: SupabaseClient,
  patientId: number,
): Promise<Stay | null | undefined> {
  const { data, error } = await client
    .from('admissions')
    .select('id, admitted_at, admitter:staff!admissions_admitted_by_fkey(full_name)')
    .eq('patient_id', patientId)
    .is('discharged_at', null)
    .maybeSingle()
  // undefined: not known (no network), so the screen keeps what it shows.
  if (error) return undefined
  return (data as unknown as Stay | null) ?? null
}

// ===== 2. Who sees the buttons (the database checks the same) =====
type Person = { role: string; can_medical?: boolean; room: { kind: string } | null }
export function canAdmit(staff: Person): boolean {
  return staff.role === 'front_desk' || staff.role === 'matron' || actsAsDoctor(staff)
}
export function canDischarge(staff: Person): boolean {
  return staff.role === 'matron' || actsAsDoctor(staff)
}

// ===== 3. Admit and Discharge: the words to show when it did not go =====
export async function admit(client: SupabaseClient, patientId: number): Promise<string | null> {
  const { data, error } = await client.rpc('admit_patient', { patient: patientId })
  if (error?.code === '42501') return 'Only a doctor, the matron or the Front Desk admits.'
  if (error || (data !== 'admitted' && data !== 'already_admitted')) {
    return 'That could not be saved. Check the internet and try again.'
  }
  return null
}

export async function discharge(client: SupabaseClient, patientId: number): Promise<string | null> {
  const { data, error } = await client.rpc('discharge_patient', { patient: patientId })
  if (error?.code === '42501') return 'Only a doctor or the matron discharges.'
  if (error || (data !== 'discharged' && data !== 'not_admitted')) {
    return 'That could not be saved. Check the internet and try again.'
  }
  return null
}

// ===== 4. Admitted on: the day the stay began (request 247, 2026-11-24) =====
// For a patient already on the ward before the app had stays: "front desk
// [or] Dr... put admitted on [a] date and then everything from [then on]".
export async function setAdmittedOn(
  client: SupabaseClient,
  patientId: number,
  day: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('set_admitted_on', {
    patient: patientId,
    admitted_on: day,
  })
  if (error?.code === '42501') return 'Only a doctor, the matron or the Front Desk sets this.'
  if (error?.code === '22023') return 'Choose a day in the last 90 days, not in the future.'
  if (error || data !== 'saved') return 'That could not be saved. Check the internet and try again.'
  return null
}

// ===== 5. Everybody in the hospital now, for the In and Out pill =====
// Request 258 (2026-11-26): every patient line carries a small "In" or
// "Out". One read of the open stays (only the patient numbers), shared by
// every line on the screen. null: no network; the pills wait.
export async function loadInPatients(client: SupabaseClient): Promise<Set<number> | null> {
  const { data, error } = await client
    .from('admissions')
    .select('patient_id')
    .is('discharged_at', null)
  if (error || !data) return null
  return new Set((data as { patient_id: number }[]).map((row) => row.patient_id))
}
