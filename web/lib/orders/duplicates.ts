/*
 * lib/orders/duplicates.ts: has this patient already been asked for the
 * same test, or prescribed the same drug, and it is not done yet? And at
 * the Front Desk: is the same test or drug on another request of this
 * patient from the last 24 hours?
 *
 * Why: Anthony, 2026-11-26 (request 251): "if requesting for the exact same
 * test for the exact same patient then [a warning] shows so they don't
 * request for the test twice... treat duplication for that area as well...
 * the system shows [a] warning and then give them a key to continue anyway
 * or cancel." On 24 Nov a nurse sent the same three tests for the same
 * patient 6 minutes apart, and both were paid.
 *
 * How: it only reads what the person may already read (their own requests,
 * every request of a record they opened in the last 12 hours, and all of
 * them for the Front Desk), so it needs no new database rule.
 *
 * Never: stop anybody. It only finds; the screen warns, and the person
 * chooses Send anyway or Cancel. No network: it finds nothing and the
 * screen goes on as before.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { HOSPITAL_TIME_ZONE } from '../time/zone'

// ===== 1. Shapes =====
// One earlier request with something in common with the new one.
export type Earlier = {
  // What is the same: the test names, or the drug with its strength.
  same: string[]
  // When it was asked for.
  at: string
  // Paid already (for the Front Desk's words).
  paid: boolean
}

// ===== 2. Small helpers =====
// Names compared without letter case or extra spaces: "PCV" and "pcv ".
const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

// "21:40" today, "24 Nov, 21:40" on another day, in the hospital's time.
export function whenWords(iso: string): string {
  const moment = new Date(iso)
  const day = (date: Date) => date.toLocaleDateString('en-GB', { timeZone: HOSPITAL_TIME_ZONE })
  const time = moment.toLocaleTimeString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
  if (day(moment) === day(new Date())) return time
  const date = moment.toLocaleDateString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  })
  return `${date}, ${time}`
}

// "MP", "MP and Widal", "MP, Widal and PCV".
export function listWords(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// The times of the earlier requests, in order, each once.
function timesWords(earlier: Earlier[]): string {
  const times = [...new Set(earlier.map((one) => whenWords(one.at)))]
  return listWords(times)
}

// The names in common, each once, in the order first seen.
function sameNames(earlier: Earlier[]): string[] {
  const seen: string[] = []
  for (const one of earlier) {
    for (const name of one.same) if (!seen.some((had) => key(had) === key(name))) seen.push(name)
  }
  return seen
}

// ===== 3. Lab: the same tests asked for and not done yet =====
// Open means: not cancelled, not completed, not expired, paid or not, any age.
export async function sameTestsOpen(
  client: SupabaseClient,
  patientId: number,
  tests: string[],
): Promise<Earlier[]> {
  const wanted = new Set(tests.map(key))
  const { data, error } = await client
    .from('lab_requests')
    .select('tests, requested_at, payment_id')
    .eq('patient_id', patientId)
    .in('status', ['awaiting_payment', 'awaiting_test'])
    .is('expired_at', null)
    .order('requested_at')
  if (error || !data) return []
  return (data as { tests: string[]; requested_at: string; payment_id: number | null }[])
    .map((row) => ({
      same: row.tests.filter((test) => wanted.has(key(test))),
      at: row.requested_at,
      paid: row.payment_id !== null,
    }))
    .filter((one) => one.same.length > 0)
}

// "Widal and PCV were already requested for this patient at 21:40 and are
// not done yet."
export function sameTestsWords(earlier: Earlier[]): string {
  const names = sameNames(earlier)
  const many = names.length > 1
  return (
    `${listWords(names)} ${many ? 'were' : 'was'} already requested for this patient at ` +
    `${timesWords(earlier)} and ${many ? 'are' : 'is'} not done yet.`
  )
}

// ===== 4. Pharmacy: the same drug prescribed and not given yet =====
// A drug is the same when its name matches and, if both have a strength,
// the strength matches too.
type ItemRow = { drug: string; strength: string | null }
const drugWords = (item: ItemRow) => [item.drug, item.strength].filter(Boolean).join(' ')
const sameDrug = (a: ItemRow, b: ItemRow) =>
  key(a.drug) === key(b.drug) && (!a.strength || !b.strength || key(a.strength) === key(b.strength))

export async function sameDrugsOpen(
  client: SupabaseClient,
  patientId: number,
  drugs: ItemRow[],
): Promise<Earlier[]> {
  const { data, error } = await client
    .from('prescriptions')
    .select('prescribed_at, payment_id, items:prescription_items(drug, strength)')
    .eq('patient_id', patientId)
    .in('status', ['awaiting_payment', 'awaiting_dispense'])
    .is('expired_at', null)
    .order('prescribed_at')
  if (error || !data) return []
  return (data as { prescribed_at: string; payment_id: number | null; items: ItemRow[] }[])
    .map((row) => ({
      same: row.items.filter((item) => drugs.some((drug) => sameDrug(item, drug))).map(drugWords),
      at: row.prescribed_at,
      paid: row.payment_id !== null,
    }))
    .filter((one) => one.same.length > 0)
}

// "Amoxicillin 500 mg was already prescribed for this patient at 10:15 and
// is not given yet."
export function sameDrugsWords(earlier: Earlier[]): string {
  const names = sameNames(earlier)
  const many = names.length > 1
  return (
    `${listWords(names)} ${many ? 'were' : 'was'} already prescribed for this patient at ` +
    `${timesWords(earlier)} and ${many ? 'are' : 'is'} not given yet.`
  )
}

// ===== 5. The Front Desk: the same on another request, last 24 hours =====
// Paid or not, not cancelled, not the request being paid now.
const DAY = 24 * 60 * 60 * 1000

export async function sameTestsElsewhere(
  client: SupabaseClient,
  patientId: number,
  requestId: number,
  tests: string[],
): Promise<Earlier[]> {
  const wanted = new Set(tests.map(key))
  const since = new Date(Date.now() - DAY).toISOString()
  const { data, error } = await client
    .from('lab_requests')
    .select('id, tests, requested_at, payment_id')
    .eq('patient_id', patientId)
    .neq('id', requestId)
    .neq('status', 'voided')
    .gte('requested_at', since)
    .order('requested_at')
  if (error || !data) return []
  return (data as { tests: string[]; requested_at: string; payment_id: number | null }[])
    .map((row) => ({
      same: row.tests.filter((test) => wanted.has(key(test))),
      at: row.requested_at,
      paid: row.payment_id !== null,
    }))
    .filter((one) => one.same.length > 0)
}

export async function sameDrugsElsewhere(
  client: SupabaseClient,
  patientId: number,
  prescriptionId: number,
  drugs: ItemRow[],
): Promise<Earlier[]> {
  const since = new Date(Date.now() - DAY).toISOString()
  const { data, error } = await client
    .from('prescriptions')
    .select('id, prescribed_at, payment_id, items:prescription_items(drug, strength)')
    .eq('patient_id', patientId)
    .neq('id', prescriptionId)
    .neq('status', 'voided')
    .gte('prescribed_at', since)
    .order('prescribed_at')
  if (error || !data) return []
  return (data as { prescribed_at: string; payment_id: number | null; items: ItemRow[] }[])
    .map((row) => ({
      same: row.items.filter((item) => drugs.some((drug) => sameDrug(item, drug))).map(drugWords),
      at: row.prescribed_at,
      paid: row.payment_id !== null,
    }))
    .filter((one) => one.same.length > 0)
}

// "This patient has the same tests on another request (asked for at 21:40,
// paid). Check before taking payment twice."
export function elsewhereWords(earlier: Earlier[], what: 'tests' | 'drugs'): string {
  const which = earlier
    .map((one) => `asked for at ${whenWords(one.at)}, ${one.paid ? 'paid' : 'not paid yet'}`)
    .join('; ')
  const thing =
    what === 'tests'
      ? `the same tests (${listWords(sameNames(earlier))})`
      : `the same drugs (${listWords(sameNames(earlier))})`
  return `This patient has ${thing} on another request (${which}). Check before taking payment twice.`
}
