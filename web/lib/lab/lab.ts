/*
 * lib/lab/lab.ts: everything the Laboratory screens read and write.
 *
 * Why: request 115 (Anthony, 2026-10-30). A doctor, nurse or matron
 * requests tests; the Front Desk records the payment in naira with its
 * mode; the lab types the results; the results go straight into the
 * patient's record, and only the person who asked is alerted.
 *
 * Every write goes through a database function that checks who is asking
 * (supabase/migrations/20261030164236_laboratory.sql). The screens only ask.
 *
 * Never: show a result outside the opened medical record or the lab's own
 * list. Never decide here who may do what.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Shapes and words =====
export type LabStatus = 'awaiting_payment' | 'awaiting_test' | 'completed' | 'voided'
export type PaymentMode = 'cash' | 'pos' | 'transfer'

export type LabRequest = {
  id: number
  patient_id: number
  tests: string[]
  note: string | null
  status: LabStatus
  requested_at: string
  completed_at: string | null
  patient: { full_name: string; patient_number: string } | null
  requester: { full_name: string } | null
}

export type LabResult = {
  id: number
  request_id: number | null
  test: string
  result: string
  file_key: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  recorded_at: string
  recorder: { full_name: string } | null
}

// The demo's common tests, in its order.
export const COMMON_TESTS = [
  'Full Blood Count',
  'Malaria test',
  'Urinalysis',
  'Blood sugar',
  'Pregnancy scan',
]

export const STATUS_WORDS: Record<LabStatus, string> = {
  awaiting_payment: 'Waiting for payment',
  awaiting_test: 'Awaiting test',
  completed: 'Completed',
  voided: 'Cancelled',
}

export const PAYMENT_MODES: [PaymentMode, string][] = [
  ['cash', 'Cash'],
  ['pos', 'POS'],
  ['transfer', 'Transfer'],
]

const REQUEST_COLUMNS =
  'id, patient_id, tests, note, status, requested_at, completed_at, ' +
  'patient:patients(full_name, patient_number), requester:staff!lab_requests_requested_by_fkey(full_name)'

// "₦7,500.50", "₦7,500".
export function naira(amount: number): string {
  return '₦' + amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })
}

// ===== 2. A doctor, nurse or matron requests tests =====
export async function requestLab(
  client: SupabaseClient,
  patientId: number,
  tests: string[],
  note: string,
  sendTo: 'front_desk' | 'laboratory',
): Promise<string | null> {
  const { error } = await client.rpc('request_lab', {
    patient: patientId,
    wanted: tests,
    request_note: note,
    send_to: sendTo,
  })
  return error ? 'The request could not be sent. Check the internet and try again.' : null
}

// ===== 3. The Front Desk: tests waiting for payment, and the payment =====
export async function listAwaitingPayment(client: SupabaseClient): Promise<LabRequest[]> {
  const { data } = await client
    .from('lab_requests')
    .select(REQUEST_COLUMNS)
    .eq('status', 'awaiting_payment')
    .order('requested_at')
  return (data as unknown as LabRequest[] | null) ?? []
}

export async function payLabRequest(
  client: SupabaseClient,
  requestId: number,
  amount: number,
  mode: PaymentMode,
): Promise<string | null> {
  const { data, error } = await client.rpc('pay_lab_request', {
    request: requestId,
    amount_paid: amount,
    paid_by: mode,
  })
  // "already_paid": somebody else at the desk paid it a moment ago. The
  // list refreshes and it drops off, so there is nothing to say.
  if (error || (data !== 'paid' && data !== 'already_paid')) {
    return 'The payment could not be saved. Check the internet and try again.'
  }
  return null
}

// ===== 4. The lab: tests to do, and the results =====
export async function listAwaitingTest(client: SupabaseClient): Promise<LabRequest[]> {
  const { data } = await client
    .from('lab_requests')
    .select(REQUEST_COLUMNS)
    .eq('status', 'awaiting_test')
    .order('requested_at')
  return (data as unknown as LabRequest[] | null) ?? []
}

export async function getLabRequest(
  client: SupabaseClient,
  requestId: number,
): Promise<LabRequest | null> {
  const { data } = await client
    .from('lab_requests')
    .select(REQUEST_COLUMNS)
    .eq('id', requestId)
    .maybeSingle()
  return (data as unknown as LabRequest | null) ?? null
}

export type ResultItem = {
  test: string
  result: string
  file_key?: string
  file_name?: string
  file_type?: string
  file_size?: number
}

// Answers null when saved, or the words to show.
export async function recordResults(
  client: SupabaseClient,
  requestId: number | null,
  patientId: number | null,
  items: ResultItem[],
): Promise<string | null> {
  const { data, error } = await client.rpc('record_lab_results', {
    request: requestId,
    patient: patientId,
    items,
  })
  if (error) return 'The results could not be saved. Check the internet and try again.'
  if (data === 'not_paid') return 'This test has not been paid for yet. Ask the Front Desk.'
  return null
}

// ===== 5. The person who asked: results ready for them =====
export async function listMyReadyResults(
  client: SupabaseClient,
  staffId: string,
): Promise<LabRequest[]> {
  const { data } = await client
    .from('lab_requests')
    .select(REQUEST_COLUMNS)
    .eq('requested_by', staffId)
    .eq('status', 'completed')
    .is('result_seen_at', null)
    .order('completed_at', { ascending: false })
  return (data as unknown as LabRequest[] | null) ?? []
}

export async function markSeen(client: SupabaseClient, requestId: number) {
  await client.rpc('mark_lab_result_seen', { request: requestId })
}

// ===== 6. The patient's record: results and open requests =====
export async function loadPatientLab(
  client: SupabaseClient,
  patientId: number,
): Promise<{ results: LabResult[]; open: LabRequest[] }> {
  const [results, open] = await Promise.all([
    client
      .from('lab_results')
      .select(
        'id, request_id, test, result, file_key, file_name, file_type, file_size, recorded_at, ' +
          'recorder:staff!lab_results_recorded_by_fkey(full_name)',
      )
      .eq('patient_id', patientId)
      .is('voided_at', null)
      .order('recorded_at', { ascending: false }),
    client
      .from('lab_requests')
      .select(REQUEST_COLUMNS)
      .eq('patient_id', patientId)
      .in('status', ['awaiting_payment', 'awaiting_test'])
      .order('requested_at', { ascending: false }),
  ])
  return {
    results: (results.data as unknown as LabResult[] | null) ?? [],
    open: (open.data as unknown as LabRequest[] | null) ?? [],
  }
}
