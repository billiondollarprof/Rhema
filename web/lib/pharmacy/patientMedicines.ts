/*
 * lib/pharmacy/patientMedicines.ts: what a patient has taken, for the
 * Pharmacy.
 *
 * Why: Anthony, 2026-11-12: patients often do not remember their drugs, so
 * the Pharmacy looks them up: "the one they are currently taking, the one
 * they suspended, the one they have stopped." The Pharmacy has no access to
 * the medical record; the database hands back the medicines and nothing else,
 * and writes each look to the activity log.
 *
 * Kept in memory per person, so going back to the patient shows it at once
 * while a fresh copy loads.
 *
 * Never: show anything but the medicines.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { recall, remember } from '../cache/memory'

export type PharmacyMedicine = {
  id: number
  medicine: string
  dose: string | null
  how_often: string | null
  status: 'active' | 'suspended' | 'stopped'
  started: string
  added_by: string | null
  // The last time its status was changed (suspended, stopped, resumed), and why.
  last_change: string | null
  last_reason: string | null
  last_changed_at: string | null
  // The course (request 240, 2026-11-23): doses in all (if charted), doses
  // the nurses gave, and doses the Pharmacy handed over.
  doses?: number | null
  given?: number
  dispensed?: number
  // Request 247 (2026-11-24): doses brought back to the store, the route,
  // and the last dose the nurses gave (for Last given and Next due).
  returned?: number
  route?: string | null
  last_given_at?: string | null
}

export function knownPatientMedicines(
  staffId: string,
  patientId: number,
): PharmacyMedicine[] | null {
  return recall<PharmacyMedicine[]>(staffId, `pmeds:${patientId}`)
}

// Returns null when it could not be read (no network): the caller keeps what
// it shows.
export async function loadPatientMedicines(
  client: SupabaseClient,
  staffId: string,
  patientId: number,
): Promise<PharmacyMedicine[] | null> {
  const { data, error } = await client.rpc('patient_medicines_for_pharmacy', {
    p_patient: patientId,
  })
  if (error || !Array.isArray(data)) return null
  remember(staffId, `pmeds:${patientId}`, data as PharmacyMedicine[])
  return data as PharmacyMedicine[]
}

// ===== Dispense from the chart (request 240) =====
// The Pharmacy hands a supply to the ward: how many doses. Answers the words
// to show when it did not go, or null.
export async function dispenseFromChart(
  client: SupabaseClient,
  medicationId: number,
  doses: number,
): Promise<string | null> {
  const { data, error } = await client.rpc('dispense_chart', {
    medication: medicationId,
    how_many: doses,
  })
  if (error?.code === '42501') return 'Only the Pharmacy dispenses.'
  // "already_dispensed": the same, a moment ago (a double tap).
  if (error || (data !== 'dispensed' && data !== 'already_dispensed')) {
    return 'That could not be saved. Check the internet and try again.'
  }
  return null
}

// Doses brought back to the store (request 247: "a button [that] records
// [what is returned]"). Never more than went out; the database checks.
export async function returnToStore(
  client: SupabaseClient,
  medicationId: number,
  doses: number,
): Promise<string | null> {
  const { data, error } = await client.rpc('return_to_store', {
    medication: medicationId,
    how_many: doses,
  })
  if (error?.code === '42501') return 'Only the Pharmacy records a return.'
  if (data === 'too_many') return 'That is more than was dispensed and not yet returned.'
  if (error || (data !== 'returned' && data !== 'already_returned')) {
    return 'That could not be saved. Check the internet and try again.'
  }
  return null
}
