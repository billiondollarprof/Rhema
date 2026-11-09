/*
 * lib/pharmacy/pharmacy.ts: everything the Pharmacy screens read and write.
 *
 * Why: request 123 (Anthony, 2026-10-31): "do pharmacy with drug payments
 * now." A doctor prescribes; the Front Desk types a price for each drug and
 * the app adds them up; the Pharmacy taps Dispensed and the drugs join the
 * patient's current medications.
 *
 * Every write goes through a database function that checks who is asking
 * (supabase/migrations/20261031151251_pharmacy.sql). The screens only ask.
 *
 * Never: decide here who may prescribe, charge or dispense.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMode } from '@/lib/lab/lab'

// ===== 1. Shapes and words =====
export type PrescriptionStatus = 'awaiting_payment' | 'awaiting_dispense' | 'dispensed' | 'voided'

export type PrescriptionItem = {
  id?: number
  drug: string
  strength: string | null
  dose: string | null
  how_often: string | null
  days: number | null
  quantity: string | null
  note: string | null
}

export type Prescription = {
  id: number
  patient_id: number
  note: string | null
  status: PrescriptionStatus
  prescribed_at: string
  dispensed_at: string | null
  // Sent also to the other place (request 130c), and whether it is paid.
  also_sent: boolean
  payment_id: number | null
  patient: { full_name: string; patient_number: string } | null
  prescriber: { full_name: string } | null
  items: PrescriptionItem[]
}

export const STATUS_WORDS: Record<PrescriptionStatus, string> = {
  awaiting_payment: 'Waiting for payment',
  awaiting_dispense: 'Waiting at the pharmacy',
  dispensed: 'Dispensed',
  voided: 'Cancelled',
}

// The usual ways a drug is taken, to tap instead of typing.
export const HOW_OFTEN = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'At night',
  'When needed',
]

// "Paracetamol 500 mg · 2 tablets · Three times daily · 5 days · 30 tablets"
export function itemWords(item: PrescriptionItem): string {
  return [
    [item.drug, item.strength].filter(Boolean).join(' '),
    item.dose,
    item.how_often,
    item.days ? `${item.days} days` : null,
    item.quantity,
  ]
    .filter(Boolean)
    .join(' · ')
}

const COLUMNS =
  'id, patient_id, note, status, prescribed_at, dispensed_at, also_sent, payment_id, ' +
  'patient:patients(full_name, patient_number), ' +
  'prescriber:staff!prescriptions_prescribed_by_fkey(full_name), ' +
  'items:prescription_items(id, drug, strength, dose, how_often, days, quantity, note)'

// ===== 2. A doctor prescribes =====
export async function prescribe(
  client: SupabaseClient,
  patientId: number,
  items: PrescriptionItem[],
  note: string,
  sendTo: 'front_desk' | 'pharmacy',
): Promise<string | null> {
  const { error } = await client.rpc('prescribe', {
    patient: patientId,
    items,
    prescription_note: note,
    send_to: sendTo,
  })
  return error ? 'The prescription could not be sent. Check the internet and try again.' : null
}

// ===== 3. Lists =====
async function listWhere(client: SupabaseClient, filter: string) {
  const { data } = await client
    .from('prescriptions')
    .select(COLUMNS)
    .or(filter)
    .order('prescribed_at')
  return (data as unknown as Prescription[] | null) ?? []
}

// The Front Desk: waiting for payment, or sent straight to the Pharmacy and
// also to the Front Desk, not paid yet.
export const listAwaitingPayment = (client: SupabaseClient) =>
  listWhere(
    client,
    'status.eq.awaiting_payment,and(also_sent.is.true,payment_id.is.null,status.in.(awaiting_dispense,dispensed))',
  )

// The Pharmacy: ready to dispense, or sent to the Front Desk and also to
// the Pharmacy (shown as waiting for payment until it is paid).
export const listAwaitingDispense = (client: SupabaseClient) =>
  listWhere(client, 'status.eq.awaiting_dispense,and(also_sent.is.true,status.eq.awaiting_payment)')

// ===== 3b. Send also to the other place (request 130c) =====
// The doctor's newest prescription for this patient, the one just sent.
export async function sendAlso(
  client: SupabaseClient,
  patientId: number,
  doctorId: string,
): Promise<string | null> {
  const { data: found } = await client
    .from('prescriptions')
    .select('id')
    .eq('patient_id', patientId)
    .eq('prescribed_by', doctorId)
    .order('prescribed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!found) return 'It could not be sent. Check the network and try again.'
  const { data, error } = await client.rpc('send_prescription_also', {
    prescription: (found as { id: number }).id,
  })
  if (error || (data !== 'sent' && data !== 'already_sent')) {
    return 'It could not be sent. Check the network and try again.'
  }
  return null
}

export async function loadPatientPrescriptions(
  client: SupabaseClient,
  patientId: number,
): Promise<Prescription[]> {
  const { data } = await client
    .from('prescriptions')
    .select(COLUMNS)
    .eq('patient_id', patientId)
    .order('prescribed_at', { ascending: false })
  return (data as unknown as Prescription[] | null) ?? []
}

// ===== 4. The Front Desk: a price per drug, the database adds them up =====
export type PriceLine = { label: string; amount: number }

export async function payPrescription(
  client: SupabaseClient,
  prescriptionId: number,
  lines: PriceLine[],
  mode: PaymentMode,
): Promise<string | null> {
  const { data, error } = await client.rpc('pay_prescription', {
    prescription: prescriptionId,
    lines,
    paid_by: mode,
  })
  if (error || (data !== 'paid' && data !== 'already_paid')) {
    return 'The payment could not be saved. Check the internet and try again.'
  }
  return null
}

// ===== 5. The Pharmacy dispenses =====
export async function dispense(client: SupabaseClient, prescriptionId: number) {
  const { data, error } = await client.rpc('dispense_prescription', {
    prescription: prescriptionId,
  })
  if (error) return 'It could not be saved. Check the internet and try again.'
  if (data === 'not_paid') return 'This prescription has not been paid for yet.'
  return null
}

// ===== The doctor is told when their prescription is dispensed =====
// Anthony, 2026-11-09: "once any request is fulfilled, the doctor gets a
// notification." Shown until the doctor opens that patient's record.
export async function listMyDispensed(
  client: SupabaseClient,
  staffId: string,
): Promise<Prescription[]> {
  const { data } = await client
    .from('prescriptions')
    .select(COLUMNS)
    .eq('prescribed_by', staffId)
    .eq('status', 'dispensed')
    .is('dispense_seen_at', null)
    .order('dispensed_at', { ascending: false })
  return (data as unknown as Prescription[] | null) ?? []
}

// Opening the patient's record marks their dispensed prescriptions seen.
export async function markDispensedSeenFor(
  client: SupabaseClient,
  staffId: string,
  patientId: number,
): Promise<void> {
  const mine = await listMyDispensed(client, staffId)
  await Promise.all(
    mine
      .filter((prescription) => prescription.patient_id === patientId)
      .map((prescription) => client.rpc('mark_dispense_seen', { prescription: prescription.id })),
  )
}
