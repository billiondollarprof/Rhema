/*
 * lib/bills/bills.ts: bills. A doctor or the matron bills a patient for a
 * procedure, an operation, the bed fee and the rest; the Front Desk takes
 * exactly that amount.
 *
 * Why: the director's voice note and Anthony, 2026-11-21 and 22 (request
 * 235, part 3). "let everyone see the bill" (2026-11-22). A bill never
 * expires.
 *
 * The database decides who may add, pay or void a bill, and adds up the
 * lines itself (supabase/migrations/20261122204301_bills.sql). These
 * functions only ask.
 *
 * Paying sends each line with its amount: the doctor's, or the one the
 * Front Desk changed it to (request 239). The database adds them up.
 *
 * Never: send a total. The database adds the lines up itself.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMode } from '@/lib/lab/lab'

// ===== 1. The kinds of line, and the name each starts with =====
// The hospital's Discharge / Billing Form (photo, 2026-11-23), with the bed
// as Regular, Private or VIP (request 240d). Medicines given and Laboratory
// tests are worked out from the stay. The first kinds (2026-11-22) stay for
// the bills already made.
export type BillKind =
  | 'professional_fee'
  | 'nursing_fee'
  | 'procedure_surgery'
  | 'anaesthetics'
  | 'oxygen'
  | 'phototherapy'
  | 'blood_transfusion'
  | 'delivery'
  | 'episiotomy_repair'
  | 'bed_regular'
  | 'bed_private'
  | 'bed_vip'
  | 'orals'
  | 'injectable'
  | 'infusion_cannulation'
  | 'consumables'
  | 'antibiotics'
  | 'take_home_drugs'
  | 'others'
  | 'medicines_given'
  | 'lab_tests'
  | 'procedure'
  | 'operation'
  | 'bed'
  | 'consultation'
  | 'dressing'
  | 'catheter'
  | 'other'

// What the doctor picks from, in the form's order. Others: type a name.
export const BILL_KINDS: { kind: BillKind; words: string }[] = [
  { kind: 'professional_fee', words: 'Professional Fee' },
  { kind: 'nursing_fee', words: 'Nursing Fee' },
  { kind: 'procedure_surgery', words: 'Procedures / Surgery' },
  { kind: 'anaesthetics', words: 'Anaesthetics' },
  { kind: 'oxygen', words: 'Oxygen' },
  { kind: 'phototherapy', words: 'Phototherapy' },
  { kind: 'blood_transfusion', words: 'Blood Transfusion' },
  { kind: 'delivery', words: 'Delivery' },
  { kind: 'episiotomy_repair', words: 'Episiotomy Tear and Repair' },
  { kind: 'bed_regular', words: 'Bed space: Regular' },
  { kind: 'bed_private', words: 'Bed space: Private' },
  { kind: 'bed_vip', words: 'Bed space: VIP' },
  { kind: 'orals', words: 'Orals' },
  { kind: 'injectable', words: 'Injectable' },
  { kind: 'infusion_cannulation', words: 'Infusion / Cannulation' },
  { kind: 'consumables', words: 'Consumables' },
  { kind: 'antibiotics', words: 'Antibiotics' },
  { kind: 'take_home_drugs', words: 'Take Home Drugs' },
  { kind: 'others', words: 'Others' },
]

// The lines worked out from the stay, and the first kinds, for their words.
const MORE_WORDS: Partial<Record<BillKind, string>> = {
  medicines_given: 'Medicines given',
  lab_tests: 'Laboratory tests',
  procedure: 'Procedure',
  operation: 'Operation',
  bed: 'Bed fee',
  consultation: 'Consultation',
  dressing: 'Dressing',
  catheter: 'Catheter',
  other: 'Other',
}

export function billKindWords(kind: BillKind): string {
  return BILL_KINDS.find((one) => one.kind === kind)?.words ?? MORE_WORDS[kind] ?? 'Others'
}

// ===== 2. Shapes =====
export type BillLine = { id: number; kind: BillKind; item: string; amount: number }
export type Bill = {
  id: number
  patient_id: number
  note: string | null
  status: 'awaiting_payment' | 'paid' | 'voided'
  created_at: string
  created_by: string
  // The stay it belongs to (an inpatient's bill), or null.
  admission_id: number | null
  patient: { full_name: string; patient_number: string } | null
  maker: { full_name: string } | null
  lines: BillLine[]
}

const COLUMNS =
  'id, patient_id, note, status, created_at, created_by, admission_id, ' +
  'patient:patients(full_name, patient_number), ' +
  'maker:staff!bills_created_by_fkey(full_name), ' +
  'lines:bill_lines(id, kind, item, amount)'

// The total of a bill, for the eye only.
export function billTotal(bill: Pick<Bill, 'lines'>): number {
  return bill.lines.reduce((sum, line) => sum + line.amount, 0)
}

// ===== 3. Read =====
// toPay: only bills not paid yet (the Front Desk's list). With a patient:
// that patient's only. Voided bills never show.
export async function listBills(
  client: SupabaseClient,
  { patientId, toPay = false }: { patientId?: number; toPay?: boolean },
): Promise<Bill[] | null> {
  let query = client.from('bills').select(COLUMNS).neq('status', 'voided')
  if (toPay) query = query.eq('status', 'awaiting_payment')
  if (patientId) query = query.eq('patient_id', patientId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
  if (error || !data) return null
  return (data as unknown as Bill[]).map((bill) => ({
    ...bill,
    lines: [...bill.lines]
      .sort((a, b) => a.id - b.id)
      .map((line) => ({ ...line, amount: Number(line.amount) })),
  }))
}

// ===== 4. Add, pay, void =====
// Each answers the words to show when it did not go, or null.
export async function addBill(
  client: SupabaseClient,
  patientId: number,
  lines: { kind: BillKind; item: string; amount: number }[],
  note: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('add_bill', {
    patient: patientId,
    lines,
    bill_note: note.trim() || null,
  })
  if (error?.code === '42501') return 'Only a doctor or the matron adds a bill.'
  // "already_sent": the same bill went a moment ago (a double tap).
  if (error || (data !== 'sent' && data !== 'already_sent')) {
    return 'The bill could not be sent. Check the internet and try again.'
  }
  return null
}

export async function payBill(
  client: SupabaseClient,
  billId: number,
  lines: { label: string; amount: number }[],
  mode: PaymentMode,
): Promise<string | null> {
  const { data, error } = await client.rpc('pay_bill', { bill: billId, lines, paid_by: mode })
  if (data === 'voided') return 'The doctor cancelled this bill.'
  // "already_paid": paid at another desk a moment ago. The list refreshes.
  if (error || (data !== 'paid' && data !== 'already_paid')) {
    return 'The payment could not be saved. Check the internet and try again.'
  }
  return null
}

export async function voidBill(client: SupabaseClient, billId: number): Promise<string | null> {
  const { data, error } = await client.rpc('void_bill', { bill: billId })
  if (data === 'already_paid') return 'This bill is already paid, so it cannot be cancelled.'
  if (error?.code === '42501') return 'Only the person who made a bill can cancel it.'
  if (error || data !== 'voided')
    return 'That could not be saved. Check the internet and try again.'
  return null
}

// ===== 5. The stay's statement (request 240, 2026-11-23) =====
// Everything charged and paid since admission, and the balance. Medicine and
// test names are for the doctor and the Front Desk on screen; the receipt
// shows only the bill's lines.
export type Statement = {
  admitted: boolean
  admission_id?: number
  admitted_at?: string
  medicines?: { medicine: string; doses: number; dose_price: number; amount: number }[]
  prescriptions?: { id: number; at: string; paid: boolean; drugs: string; amount: number | null }[]
  labs?: { id: number; at: string; paid: boolean; tests: string; amount: number | null }[]
  bills?: { id: number; at: string; status: Bill['status']; total: number }[]
  billed?: number
  deposits?: number
  paid?: number
  balance?: number
}

// null: not allowed, or no network.
export async function loadStatement(
  client: SupabaseClient,
  patientId: number,
): Promise<Statement | null> {
  const { data, error } = await client.rpc('bill_statement', { patient: patientId })
  if (error || !data) return null
  return data as Statement
}

// The total of a list of amounts, ignoring the ones with no price.
export function sumOf(amounts: (number | null | undefined)[]): number {
  return amounts.reduce<number>((sum, amount) => sum + Number(amount ?? 0), 0)
}

// ===== 6. The bill a payment paid, for its receipt =====
export async function billForPayment(
  client: SupabaseClient,
  paymentId: number,
): Promise<Bill | null> {
  const { data } = await client
    .from('bills')
    .select(COLUMNS)
    .eq('payment_id', paymentId)
    .maybeSingle()
  if (!data) return null
  const bill = data as unknown as Bill
  return {
    ...bill,
    lines: [...bill.lines]
      .sort((a, b) => a.id - b.id)
      .map((line) => ({ ...line, amount: Number(line.amount) })),
  }
}

// The balance in words: what is owed, or that more was paid than billed.
export function balanceWords(balance: number, money: (amount: number) => string): string {
  if (balance >= 0) return money(balance)
  return `${money(0)} (${money(-balance)} more was paid)`
}
