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
