/*
 * lib/history/history.ts: the numbers behind History in the menu.
 *
 * Why: Anthony, 2026-11-16 (requests 215 and 216): the Front Desk wants to
 * know "how much they made when they were on duty... by category... by mode
 * of payment... count the cash they have and know that it matches"; the Lab
 * and the Pharmacy see numbers only; each consultant sees their own work.
 *
 * Each total is worked out by a database function that checks who is asking
 * (supabase/migrations/20261116155137_history_summaries.sql).
 *
 * Never: work out money here from rows; always ask the database.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Periods =====
export type PeriodKey = 'today' | 'hours6' | 'hours24' | 'week' | 'month' | 'custom'

export const PERIODS: [PeriodKey, string][] = [
  ['today', 'Today'],
  ['hours6', 'Last 6 hours'],
  ['hours24', 'Last 24 hours'],
  ['week', 'This week'],
  ['month', 'This month'],
  ['custom', 'Choose dates'],
]

// The start and end of a period, on this device's clock. A week starts on
// Monday. "custom" uses the two times typed (datetime-local text).
export function periodRange(key: PeriodKey, from = '', to = ''): { from: Date; to: Date } | null {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (key === 'today') return { from: start, to: now }
  if (key === 'hours6') return { from: new Date(now.getTime() - 6 * 3600 * 1000), to: now }
  if (key === 'hours24') return { from: new Date(now.getTime() - 24 * 3600 * 1000), to: now }
  if (key === 'week') {
    const monday = new Date(start)
    monday.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    return { from: monday, to: now }
  }
  if (key === 'month') {
    const first = new Date(start)
    first.setDate(1)
    return { from: first, to: now }
  }
  const a = new Date(from)
  const b = new Date(to)
  if (!from || !to || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return null
  return { from: a, to: b }
}

// ===== 2. Words =====
export const CATEGORY_WORDS: Record<string, string> = {
  card_individual: 'Card: Individual',
  card_family: 'Card: Family',
  card_antenatal: 'Card: Antenatal',
  consultation: 'Consultation',
  lab_test: 'Lab tests',
  drugs: 'Drugs',
  scan: 'Scan',
  other: 'Other',
}

export const MODE_WORDS: Record<string, string> = { cash: 'Cash', pos: 'POS', transfer: 'Transfer' }

export const PATIENT_CATEGORY_WORDS: Record<string, string> = {
  individual: 'Individual',
  family: 'Family',
  antenatal: 'Antenatal',
}

// "₦12,500"
export function naira(amount: number): string {
  return `₦${Number(amount).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
}

// ===== 3. Shapes =====
export type Bucket = { key: string; count: number; amount: number }
export type Money = {
  total: number
  count: number
  by_category: Bucket[]
  by_mode: Bucket[]
  payments: {
    id: number
    at: string
    receipt: string | null
    patient: string
    category: string
    mode: string
    amount: number
    taken_by: string | null
  }[]
  registered: { at: string; patient: string; category: string; old_file: boolean }[]
}
export type LabNumbers = {
  requested: number
  done: number
  waiting: number
  unpaid: number
  by_test: { test: string; count: number }[]
}
export type PharmacyNumbers = {
  dispensed: number
  waiting: number
  unpaid: number
  by_drug: { drug: string; times: number; amount: number | null; unit: string | null }[]
}
export type MyWork = {
  patients: number
  counts: Record<string, number>
  list: { patient: string; at: string; times: number }[]
}

// ===== 4. Ask the database =====
async function ask<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T | null> {
  const { data, error } = await client.rpc(name, args)
  if (error || !data) return null
  return data as T
}

export const loadMoney = (client: SupabaseClient, from: Date, to: Date, mine: boolean) =>
  ask<Money>(client, 'money_summary', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_mine: mine,
  })
export const loadLab = (client: SupabaseClient, from: Date, to: Date) =>
  ask<LabNumbers>(client, 'lab_summary', { p_from: from.toISOString(), p_to: to.toISOString() })
export const loadPharmacy = (client: SupabaseClient, from: Date, to: Date) =>
  ask<PharmacyNumbers>(client, 'pharmacy_summary', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
export const loadMyWork = (client: SupabaseClient, from: Date, to: Date) =>
  ask<MyWork>(client, 'my_summary', { p_from: from.toISOString(), p_to: to.toISOString() })
