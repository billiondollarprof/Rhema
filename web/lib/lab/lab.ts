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
import { COMMON_LAB_TESTS } from './catalogue'

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
  // When the Laboratory took the sample (request 219c); null before.
  sample_taken_at: string | null
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

// The Laboratory's most asked tests, one tap away (request 202, 2026-11-16).
export const COMMON_TESTS = COMMON_LAB_TESTS

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
  'id, patient_id, tests, note, status, requested_at, completed_at, sample_taken_at, ' +
  'patient:patients(full_name, patient_number), requester:staff!lab_requests_requested_by_fkey(full_name)'

// "₦7,500.50", "₦7,500".
export function naira(amount: number): string {
  // Whole naira show no kobo (₦7,500); kobo always show two digits (₦4,700.50).
  const digits = Number.isInteger(amount) ? 0 : 2
  return (
    '₦' +
    amount.toLocaleString('en-NG', { minimumFractionDigits: digits, maximumFractionDigits: 2 })
  )
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
// Every test not paid and not cancelled, however it was sent, even one
// already tested (request 227k). With a patient: that patient's only.
export async function listAwaitingPayment(
  client: SupabaseClient,
  patientId?: number,
): Promise<LabRequest[]> {
  let query = client
    .from('lab_requests')
    .select(REQUEST_COLUMNS)
    .is('payment_id', null)
    .neq('status', 'voided')
  if (patientId) query = query.eq('patient_id', patientId)
  const { data } = await query.order('requested_at')
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

// A price per test (2026-10-31: "let the app always work out the total").
// The database adds the lines up; the screen never sends a total.
export async function payLabRequestLines(
  client: SupabaseClient,
  requestId: number,
  lines: { label: string; amount: number }[],
  mode: PaymentMode,
): Promise<string | null> {
  const { data, error } = await client.rpc('pay_lab_request_lines', {
    request: requestId,
    lines,
    paid_by: mode,
  })
  if (error || (data !== 'paid' && data !== 'already_paid')) {
    return 'The payment could not be saved. Check the internet and try again.'
  }
  return null
}

// ===== 4. The lab: tests to do, and the results =====
// The lab sees a request the moment the doctor sends it, at the same time
// as the Front Desk sees it for payment (Anthony, 2026-11-09: "request lab
// goes to lab and front desk simultaneously"). An unpaid one shows as
// waiting for payment and turns ready the moment it is paid.
export async function listAwaitingTest(client: SupabaseClient): Promise<LabRequest[]> {
  const { data } = await client
    .from('lab_requests')
    .select(REQUEST_COLUMNS)
    .in('status', ['awaiting_test', 'awaiting_payment'])
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
  if (data === 'missing_tests')
    return 'Some tests have no details yet. Add the result for every test before Result ready.'
  return null
}

// ===== 4b. Corrections by the Laboratory (request 214, 2026-11-16) =====
// "The lab scientists can make mistake and discover later and go to edit or
// cancel." Only on a request the Front Desk confirmed paid; the database checks.

// The results on one request, cancelled ones too (they stay, crossed out).
export type RequestResult = LabResult & {
  voided_at: string | null
  void_reason: string | null
}

export async function loadRequestResults(
  client: SupabaseClient,
  requestId: number,
): Promise<RequestResult[]> {
  const { data } = await client
    .from('lab_results')
    .select(
      'id, request_id, test, result, file_key, file_name, file_type, file_size, recorded_at, voided_at, void_reason, ' +
        'recorder:staff!lab_results_recorded_by_fkey(full_name)',
    )
    .eq('request_id', requestId)
    .order('recorded_at')
  return (data as unknown as RequestResult[] | null) ?? []
}

// Add one result to a paid request (a missed test, or the corrected one).
export async function addResult(
  client: SupabaseClient,
  requestId: number,
  item: ResultItem,
): Promise<string | null> {
  const { data, error } = await client.rpc('add_lab_result', { request: requestId, item })
  if (error) return 'The result could not be saved. Check the internet and try again.'
  if (data === 'not_paid') return 'This test has not been paid for yet. Ask the Front Desk.'
  if (data === 'missing_tests') return 'Type the result, or attach a file, first.'
  return null
}

// Cancel a wrong result. It stays in the record, crossed out, with the reason.
export async function cancelResult(
  client: SupabaseClient,
  resultId: number,
  reason: string,
): Promise<string | null> {
  if (reason.trim().length < 2) return 'Give a short reason.'
  const { data, error } = await client.rpc('cancel_lab_result', {
    result_id: resultId,
    why: reason,
  })
  if (error) return 'That could not be cancelled. Check the internet and try again.'
  if (data !== 'cancelled') return 'That result was already cancelled.'
  return null
}

// A patient's paid lab requests (waiting for the Lab, or finished), newest first.
export async function listPaidRequests(
  client: SupabaseClient,
  patientId: number,
): Promise<LabRequest[]> {
  const { data } = await client
    .from('lab_requests')
    .select(REQUEST_COLUMNS)
    .eq('patient_id', patientId)
    .in('status', ['awaiting_test', 'completed'])
    .order('requested_at', { ascending: false })
    .limit(50)
  return (data as unknown as LabRequest[] | null) ?? []
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

// ===== Sample taken (request 219c, number 4) =====
// The Laboratory taps it once; the doctor then sees the test is in progress.
// A second tap changes nothing. Answers null when it is done.
export async function markSampleTaken(
  client: SupabaseClient,
  requestId: number,
): Promise<string | null> {
  const { data, error } = await client.rpc('mark_sample_taken', { request: requestId })
  if (error) return 'That did not save. Check the internet and try again.'
  if (data === 'not_paid') return 'This test has not been paid for yet.'
  return null
}
