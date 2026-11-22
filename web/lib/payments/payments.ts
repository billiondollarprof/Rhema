/*
 * lib/payments/payments.ts: payments and their receipts (request 123,
 * part 2: "other payments with printable receipts").
 *
 * Why: Anthony, 2026-10-31 and 2026-11-02: the Front Desk takes any
 * payment, types a price per line, the app adds them up; every payment has
 * a receipt they can print as many times as they want; a patient who pays
 * more on the same day gets one receipt for the day that grows with it.
 *
 * The database adds the lines and refuses a double payment
 * (supabase/migrations/20261102184013_receipts.sql). Only the Front Desk
 * and admins can read payments.
 *
 * Never: send a total of our own; never log a patient's name or an amount.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMode } from '../lab/lab'

// ===== 1. Shapes and words =====
export type PaymentPurpose =
  'registration_card' | 'consultation' | 'lab_test' | 'scan' | 'drugs' | 'other' | 'bill'

export const PURPOSE_WORDS: Record<PaymentPurpose, string> = {
  registration_card: 'Card',
  consultation: 'Consultation',
  lab_test: 'Lab tests',
  scan: 'Scan',
  drugs: 'Drugs',
  other: 'Other',
  // A doctor's or the matron's bill: procedures, bed fee and the rest (235).
  bill: 'Bill',
}

// What the Front Desk picks from when taking a payment here. Lab tests and
// drugs are here too (Anthony, 2026-11-16, request 211): at rush hour a
// doctor writes on paper, and the patient pays at the Front Desk without a
// request in the app.
export const TAKE_PURPOSES: PaymentPurpose[] = [
  'registration_card',
  'consultation',
  'lab_test',
  'drugs',
  'scan',
  'other',
]

export const MODE_WORDS: Record<PaymentMode, string> = {
  cash: 'Cash',
  pos: 'POS',
  transfer: 'Transfer',
}

export type Payment = {
  id: number
  receipt_number: string
  amount: number
  purpose: PaymentPurpose
  mode: PaymentMode
  received_at: string
  voided_at: string | null
  receiver: { full_name: string } | null
  patient: { id: number; full_name: string; patient_number: string; email: string | null } | null
  lines: { label: string; amount: number }[]
}

// ===== 1b. The receipt number, as people see it =====
// Anthony, 2026-11-09: "make receipt number to look significantly
// different. You know how bank transaction numbers used to look?" The
// database keeps RCT-000123 (unique, never changes). People see the day it
// was paid and that number, as one long figure in groups of four, like a
// bank reference: paid 9 November 2026, number 123 -> 2611 0900 0123. It
// can never be mistaken for a patient number (RMC-000001). The same rule
// is in worker/src/receipts.ts, for the email: change both together.
export function receiptCode(receiptNumber: string, receivedAt: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(receivedAt))
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00'
  const sequence = receiptNumber.replace(/\D/g, '').padStart(6, '0')
  const digits = part('year') + part('month') + part('day') + sequence
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

const COLUMNS =
  'id, receipt_number, amount, purpose, mode, received_at, voided_at, ' +
  'receiver:staff!payments_received_by_fkey(full_name), ' +
  'patient:patients(id, full_name, patient_number, email), ' +
  'lines:payment_lines(label, amount)'

// ===== 2. Take a payment =====
// Answers the payment's id (the same id again for a double tap), or the
// words to show.
export async function takePayment(
  client: SupabaseClient,
  patientId: number,
  purpose: PaymentPurpose,
  lines: { label: string; amount: number }[],
  mode: PaymentMode,
): Promise<number | string> {
  const { data, error } = await client.rpc('take_payment', {
    patient: patientId,
    what: purpose,
    lines,
    paid_by: mode,
  })
  if (error || typeof data !== 'number') {
    return 'The payment could not be saved. Check the network and try again.'
  }
  return data
}

// ===== 3. Read payments =====
export async function patientPayments(
  client: SupabaseClient,
  patientId: number,
): Promise<Payment[]> {
  const { data } = await client
    .from('payments')
    .select(COLUMNS)
    .eq('patient_id', patientId)
    .is('voided_at', null)
    .order('received_at', { ascending: false })
    .limit(50)
  return (data as unknown as Payment[] | null) ?? []
}

export async function getPayment(client: SupabaseClient, id: number): Promise<Payment | null> {
  const { data } = await client.from('payments').select(COLUMNS).eq('id', id).maybeSingle()
  return (data as unknown as Payment | null) ?? null
}

// Every payment this patient made on one day (the day's receipt, which
// grows when they pay more).
export async function paymentsOnDay(
  client: SupabaseClient,
  patientId: number,
  day: Date,
): Promise<Payment[]> {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const { data } = await client
    .from('payments')
    .select(COLUMNS)
    .eq('patient_id', patientId)
    .is('voided_at', null)
    .gte('received_at', start.toISOString())
    .lt('received_at', end.toISOString())
    .order('received_at')
  return (data as unknown as Payment[] | null) ?? []
}

// The newest payment this person took for this patient (Print receipt
// right after paying for lab tests or drugs on Home).
export async function latestPayment(
  client: SupabaseClient,
  patientId: number,
  staffId: string,
): Promise<Payment | null> {
  const { data } = await client
    .from('payments')
    .select(COLUMNS)
    .eq('patient_id', patientId)
    .eq('received_by', staffId)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as unknown as Payment | null) ?? null
}

// ===== Send a receipt to the patient's email (request 159) =====
// The Worker reads the payments again as this person (so only staff who
// may see receipts can send one) and emails them to the patient's own
// address. Returns null when it went, or the words to show.
export async function emailReceipt(client: SupabaseClient, ids: number[]): Promise<string | null> {
  const { data } = await client.auth.getSession()
  const token = data.session?.access_token
  if (!token) return 'Please sign in again.'
  try {
    const answer = await fetch('/api/receipts/email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (answer.ok) return null
  } catch {
    // No network: the words below.
  }
  return 'The email did not go.'
}

// ===== Everything a family has paid (request 160) =====
// Shown when a member is added to the family, so the front desk sees what
// was already paid before adding a payment. Newest first.
export async function familyPayments(
  client: SupabaseClient,
  patientIds: number[],
): Promise<Payment[]> {
  if (!patientIds.length) return []
  const { data } = await client
    .from('payments')
    .select(COLUMNS)
    .in('patient_id', patientIds)
    .is('voided_at', null)
    .order('received_at', { ascending: false })
    .limit(20)
  return (data as unknown as Payment[] | null) ?? []
}

// ===== Send a payment on (request 213a, 2026-11-16) =====
// The Front Desk sends paid lab tests to the Laboratory, or paid drugs to the
// Pharmacy. The database checks it is the Front Desk, that the payment is of
// that kind, and that it is sent once.
function sendWords(error: { code?: string } | null, data: unknown): string | null {
  if (error?.code === '42501') return 'Only the Front Desk can send a payment on.'
  if (error) return 'It could not be sent. Check the internet and try again.'
  if (data === 'already_sent') return 'This payment was already sent.'
  return null
}

export async function sendPaidToLab(
  client: SupabaseClient,
  paymentId: number,
  tests: string[],
  doctor: string | null,
): Promise<string | null> {
  const { data, error } = await client.rpc('send_paid_to_lab', {
    payment: paymentId,
    wanted: tests,
    doctor,
    send_note: null,
  })
  return sendWords(error, data)
}

export async function sendPaidToPharmacy(
  client: SupabaseClient,
  paymentId: number,
  items: { drug: string; strength: string | null; quantity: string | null }[],
  doctor: string | null,
): Promise<string | null> {
  const { data, error } = await client.rpc('send_paid_to_pharmacy', {
    payment: paymentId,
    items,
    doctor,
    send_note: null,
  })
  return sendWords(error, data)
}

// Doctors, nurses and the matron, to say who wrote the paper.
export async function loadClinicians(
  client: SupabaseClient,
): Promise<{ id: string; full_name: string }[]> {
  const { data } = await client
    .from('staff')
    .select('id, full_name')
    .eq('is_active', true)
    .eq('can_medical', true)
    .order('full_name')
    .limit(200)
  return (data as { id: string; full_name: string }[] | null) ?? []
}
