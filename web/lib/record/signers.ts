/*
 * lib/record/signers.ts: who can sign a sheet, the routes, and the ward's
 * own events, as on the hospital's paper sheets.
 *
 * Why: Anthony, 2026-11-17 (request 224): "the nurse can enter their name
 * from a picker that contains only nurses, and for doctors in consulting
 * room... including the midwife/nurse who is currently consulting in room
 * 2; she is the one in charge of antenatal patients." And the ward's
 * treatment sheet: Time, Name of drugs, Dosage, Route, Sign, with events
 * such as "Blood connected" written in red.
 *
 * Never: list anybody without medical access (the database refuses them
 * as a signer anyway).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SelectOption } from '@/components/options/SearchSelect'
import { recall, remember } from '@/lib/cache/memory'

export type Signer = {
  id: string
  full_name: string
  role: string
  room: { name: string; kind: string } | null
}

// ===== 1. Clinical staff, kept in memory for an instant list =====
export async function loadSigners(client: SupabaseClient, staffId: string): Promise<Signer[]> {
  const { data } = await client
    .from('staff')
    .select('id, full_name, role, room:rooms(name, kind)')
    .eq('is_active', true)
    .eq('can_medical', true)
    .order('full_name')
  const found = (data as unknown as Signer[] | null) ?? null
  if (found) return remember(staffId, 'signers', found)
  return recall<Signer[]>(staffId, 'signers') ?? []
}

export function knownSigners(staffId: string): Signer[] {
  return recall<Signer[]>(staffId, 'signers') ?? []
}

// ===== 2. The two lists =====
// Nurses' sheets: nurses and matrons (midwives) only.
export function nurseOptions(signers: Signer[]): SelectOption[] {
  return signers
    .filter((one) => one.role === 'nurse' || one.role === 'matron')
    .map((one) => ({ value: one.id, label: one.full_name, note: one.room?.name }))
}

// The consultation: whoever has a consulting room (the midwife in Consultant
// Room 2 included), then the doctors without one.
export function clinicianOptions(signers: Signer[]): SelectOption[] {
  const inRoom = signers.filter((one) => one.room?.kind === 'consultation')
  const doctors = signers.filter(
    (one) => one.role === 'doctor' && one.room?.kind !== 'consultation',
  )
  return [...inRoom, ...doctors].map((one) => ({
    value: one.id,
    label: one.full_name,
    note: one.room?.name,
  }))
}

// ===== 3. Routes, and the ward's events =====
export const ROUTES = [
  'IV',
  'IM',
  'Oral',
  'SC',
  'Infusion',
  'PR',
  'PV',
  'Sublingual',
  'Topical',
  'Inhaled',
  'Eye drops',
  'Ear drops',
]

// Written in red on the paper sheet; one tap each here.
export const WARD_EVENTS = [
  'Blood connected',
  'Blood finished',
  'Blood disconnected',
  'IV fluid started',
  'IV fluid finished',
]
