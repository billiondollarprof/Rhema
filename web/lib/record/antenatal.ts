/*
 * lib/record/antenatal.ts: reading and saving the antenatal booking and the
 * operation consent (request 170, 2026-11-09).
 *
 * Why: the hospital's antenatal card, word for word from the matron: extra
 * next of kin details, the routine tests, previous pregnancies (and the baby
 * if it died), the totals, "Would you like your delivery to be documented?
 * (photos and video)", and a consent form for an operation, for any
 * patient. A tick stands for each signature, with the name and the date.
 *
 * Never: save in somebody else's name, or show any of this outside the
 * opened medical record (the database refuses both).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Shapes and words =====
export const TEST_WORDS: [string, string][] = [
  ['pcv', 'PCV'],
  ['rvs', 'RVS'],
  ['blood_group', 'Blood group'],
  ['genotype', 'Genotype'],
  ['hepatitis_b', 'Hepatitis B'],
  ['hepatitis_c', 'Hepatitis C'],
  ['urinalysis', 'Urinalysis'],
  ['rbs_fbs', 'RBS / FBS'],
  ['h_pylori', 'H. pylori'],
  ['pt', 'PT'],
]
export const testWords = (test: string) => TEST_WORDS.find(([key]) => key === test)?.[1] ?? test

type Voided = {
  voided_at: string | null
  void_reason: string | null
  voider: { full_name: string } | null
}

export type Booking = {
  patient_id: number
  kin_occupation: string | null
  kin_religion: string | null
  kin_education: string | null
  kin_age: number | null
  kin_tribe: string | null
  abortions: number | null
  miscarriages: number | null
  total_pregnancies: number | null
  parity: string | null
  documented_delivery: boolean | null
  documented_answered_at: string | null
  answerer: { full_name: string } | null
}

export type AntenatalTest = Voided & {
  id: number
  test: string
  result: string
  tested_on: string | null
  created_at: string
  recorder: { full_name: string } | null
}

export type Pregnancy = Voided & {
  id: number
  born_on: string | null
  duration: string | null
  birth_weight: string | null
  delivery_method: string | null
  baby_sex: 'female' | 'male' | null
  baby_died: boolean
  age_at_death: string | null
  cause_of_death: string | null
  created_at: string
  recorder: { full_name: string } | null
}

export type Consent = Voided & {
  id: number
  consenting_name: string
  operation: string
  relationship: string | null
  address: string | null
  consented_on: string
  witness_name: string | null
  witnessed_on: string | null
  created_at: string
  recorder: { full_name: string } | null
}

const VOID = 'voided_at, void_reason, voider:staff!voided_by(full_name)'

// ===== 2. Read =====
export async function loadAntenatal(client: SupabaseClient, patientId: number) {
  const [booking, tests, pregnancies] = await Promise.all([
    client
      .from('antenatal_bookings')
      .select(
        'patient_id, kin_occupation, kin_religion, kin_education, kin_age, kin_tribe, abortions, miscarriages, total_pregnancies, parity, documented_delivery, documented_answered_at, answerer:staff!documented_answered_by(full_name)',
      )
      .eq('patient_id', patientId)
      .maybeSingle(),
    client
      .from('antenatal_tests')
      .select(
        `id, test, result, tested_on, created_at, recorder:staff!recorded_by(full_name), ${VOID}`,
      )
      .eq('patient_id', patientId)
      .order('created_at'),
    client
      .from('previous_pregnancies')
      .select(
        `id, born_on, duration, birth_weight, delivery_method, baby_sex, baby_died, age_at_death, cause_of_death, created_at, recorder:staff!recorded_by(full_name), ${VOID}`,
      )
      .eq('patient_id', patientId)
      .order('born_on', { nullsFirst: false }),
  ])
  return {
    booking: (booking.data as unknown as Booking | null) ?? null,
    tests: (tests.data as unknown as AntenatalTest[] | null) ?? [],
    pregnancies: (pregnancies.data as unknown as Pregnancy[] | null) ?? [],
  }
}

export async function loadConsents(client: SupabaseClient, patientId: number): Promise<Consent[]> {
  const { data } = await client
    .from('operation_consents')
    .select(
      `id, consenting_name, operation, relationship, address, consented_on, witness_name, witnessed_on, created_at, recorder:staff!recorded_by(full_name), ${VOID}`,
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  return (data as unknown as Consent[] | null) ?? []
}

// ===== 3. Save the booking (one per patient: insert the first time) =====
export async function saveBooking(
  client: SupabaseClient,
  patientId: number,
  staffId: string,
  values: Partial<Omit<Booking, 'patient_id' | 'answerer' | 'documented_answered_at'>> & {
    documented_answered_by?: string | null
    documented_answered_at?: string | null
  },
  exists: boolean,
): Promise<string | null> {
  const row = { ...values, updated_by: staffId }
  const { error } = exists
    ? await client.from('antenatal_bookings').update(row).eq('patient_id', patientId)
    : await client.from('antenatal_bookings').insert({ ...row, patient_id: patientId })
  if (error) {
    console.warn(`Antenatal booking for patient ${patientId} could not be saved: ${error.code}`)
    return error.code === '23514'
      ? 'One of the numbers is outside the normal range. Check it and try again.'
      : 'That could not be saved. Check the internet and try again.'
  }
  return null
}

// ===== 4. The doctor's dispensed notice (request 171c) =====
export async function markDispenseSeen(client: SupabaseClient, prescriptionId: number) {
  await client.rpc('mark_dispense_seen', { prescription: prescriptionId })
}
