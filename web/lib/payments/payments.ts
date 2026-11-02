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
  'registration_card' | 'consultation' | 'lab_test' | 'scan' | 'drugs' | 'other'

export const PURPOSE_WORDS: Record<PaymentPurpose, string> = {
  registration_card: 'Card',
  consultation: 'Consultation',
  lab_test: 'Lab tests',
  scan: 'Scan',
  drugs: 'Drugs',
  other: 'Other',
}

// What the Front Desk picks from when taking a payment here (lab tests and
// drugs are paid from their own cards on Home).
export const TAKE_PURPOSES: PaymentPurpose[] = [
  'consultation',
  'registration_card',
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
  patient: { id: number; full_name: string; patient_number: string } | null
  lines: { label: string; amount: number }[]
}

const COLUMNS =
  'id, receipt_number, amount, purpose, mode, received_at, voided_at, ' +
  'receiver:staff!payments_received_by_fkey(full_name), ' +
  'patient:patients(id, full_name, patient_number), ' +
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
