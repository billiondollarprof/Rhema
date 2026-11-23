/*
 * lib/prices/prices.ts: the hospital's price list (Settings part 1).
 *
 * Why: Anthony, 2026-11-16 (requests 197 and 201). The admin keeps one
 * price for the card, the consultation and each lab test. The Front Desk
 * sees the price filled in when it takes a payment and can still change it
 * for one patient.
 *
 * Only an admin can change a price: the database function set_price checks
 * (supabase/migrations/20261116072103_price_list.sql). The screens only ask.
 *
 * Never: hold anything about a patient.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Shapes =====
// drug: a drug and its strength, since 2026-11-22 (request 236).
// procedure: a line of a bill (bed fee, dressing and the rest), part 3 of 235.
export type PriceKind = 'card' | 'consultation' | 'lab_test' | 'drug' | 'procedure'
export type Price = { id: number; kind: PriceKind; item: string; amount: number }

// The names the card and consultation prices are kept under.
export const CARD_ITEM = 'Registration card'
export const CONSULTATION_ITEM = 'Consultation'

// A card fee for each kind of patient (Anthony, 2026-11-16: "individual,
// antenatal and family are different amounts... admin 3 card fees").
export const CARD_ITEMS: Record<string, string> = {
  individual: 'Card (Individual)',
  family: 'Card (Family)',
  antenatal: 'Card (Antenatal)',
}

// The card fee for this kind of patient; the single card fee set before
// 2026-11-16 still counts for an Individual.
export function cardPriceFor(prices: Price[], category: string): number | undefined {
  return (
    priceOf(prices, 'card', CARD_ITEMS[category] ?? CARD_ITEMS.individual) ??
    (category === 'individual' ? priceOf(prices, 'card', CARD_ITEM) : undefined)
  )
}

// ===== 2. Read =====
export async function loadPrices(client: SupabaseClient): Promise<Price[] | null> {
  const { data, error } = await client
    .from('price_list')
    .select('id, kind, item, amount')
    .order('kind')
    .order('item')
    .limit(2000)
  if (error || !data) return null
  return (data as { id: number; kind: PriceKind; item: string; amount: number | string }[]).map(
    (row) => ({ ...row, amount: Number(row.amount) }),
  )
}

// The price of one thing, or undefined. Lab tests match whatever the capitals.
export function priceOf(prices: Price[], kind: PriceKind, item: string): number | undefined {
  const wanted = item.trim().toLowerCase()
  return prices.find((price) => price.kind === kind && price.item.toLowerCase() === wanted)?.amount
}

// ===== 3. Set or remove (admin only; the database checks) =====
// An amount of null removes the price. Returns words to show, or null.
export async function setPrice(
  client: SupabaseClient,
  kind: PriceKind,
  item: string,
  amount: number | null,
): Promise<string | null> {
  const { error } = await client.rpc('set_price', { p_kind: kind, p_item: item, p_amount: amount })
  if (!error) return null
  if (error.code === '42501') return 'Only an admin can change prices.'
  return 'The price could not be saved. Check the internet and try again.'
}

// "7,500" and "7500.50" read as numbers; anything else reads as null.
export function readAmount(typed: string): number | null {
  const value = Number(typed.replace(/[,\s₦]/g, ''))
  if (!typed.trim() || !Number.isFinite(value) || value <= 0 || value >= 100000000) return null
  return Math.round(value * 100) / 100
}

// ===== 4. Lab test prices the Laboratory proposed (request 208) =====
// A proposal waits for the admin. After 72 hours with no answer it becomes
// standard on its own (the backup job runs it every 2 hours).
export type PriceChange = {
  id: number
  item: string
  amount: number
  status: 'waiting' | 'approved' | 'automatic' | 'refused' | 'replaced'
  proposed_at: string
  proposer: { full_name: string } | null
}

export async function loadPriceChanges(client: SupabaseClient): Promise<PriceChange[] | null> {
  const { data, error } = await client
    .from('price_changes')
    .select(
      'id, item, amount, status, proposed_at, proposer:staff!price_changes_proposed_by_fkey(full_name)',
    )
    .eq('status', 'waiting')
    .order('proposed_at')
    .limit(500)
  if (error || !data) return null
  return (data as unknown as (PriceChange & { amount: number | string })[]).map((row) => ({
    ...row,
    amount: Number(row.amount),
  }))
}

// The proposal still waiting for one test, if any.
export function waitingPriceOf(changes: PriceChange[], item: string): PriceChange | undefined {
  const wanted = item.trim().toLowerCase()
  return changes.find((change) => change.item.toLowerCase() === wanted)
}

// The Laboratory proposes a price. Returns words to show, or null.
export async function proposePrice(
  client: SupabaseClient,
  item: string,
  amount: number,
): Promise<string | null> {
  const { error } = await client.rpc('propose_price', { p_item: item, p_amount: amount })
  if (!error) return null
  if (error.code === '23505') return 'That price was just sent. It is waiting for the admin.'
  if (error.code === '42501') return 'Only the Laboratory or an admin can change lab prices.'
  return 'The price could not be sent. Check the internet and try again.'
}

// The admin approves or refuses. Returns words to show, or null.
export async function decidePrice(
  client: SupabaseClient,
  change: number,
  approve: boolean,
): Promise<string | null> {
  const { error } = await client.rpc('decide_price', { p_change: change, p_approve: approve })
  if (!error) return null
  if (error.code === '42501') return 'Only an admin can approve prices.'
  return 'That could not be saved. Check the internet and try again.'
}

// When a waiting price becomes standard on its own: 72 hours after it was sent.
export function standardOn(change: PriceChange): Date {
  return new Date(new Date(change.proposed_at).getTime() + 72 * 60 * 60 * 1000)
}

// ===== My own prices (request 235, part 2, 2026-11-22) =====
// The doctor or matron sets the price of each drug and test. Their last
// price for each one is kept, to fill in next time ("so that particular
// consultant can use it again"). Each person reads only their own.
export type MyPrice = { kind: 'drug' | 'lab_test' | 'procedure'; item: string; amount: number }

// The name a price is kept under: the drug and its strength, or the test,
// in small letters, as the database keeps it.
export function priceKey(name: string, strength?: string | null): string {
  return [name.trim(), (strength ?? '').trim()].filter(Boolean).join(' ').toLowerCase()
}

export async function loadMyPrices(client: SupabaseClient): Promise<MyPrice[]> {
  const { data } = await client.from('my_prices').select('kind, item, amount')
  return ((data as MyPrice[] | null) ?? []).map((one) => ({ ...one, amount: Number(one.amount) }))
}

export function myPriceOf(mine: MyPrice[], kind: MyPrice['kind'], key: string): number | undefined {
  return mine.find((one) => one.kind === kind && one.item === key)?.amount
}

// ===== Standard prices from a doctor or the matron (request 236) =====
// "Make these the standard prices?" after sending: they fill in for everybody
// next time. Answers the words to show when it did not go.
export type StandardPrice = {
  kind: 'drug' | 'lab_test' | 'procedure'
  item: string
  amount: number
}

export async function makeStandardPrices(
  client: SupabaseClient,
  prices: StandardPrice[],
): Promise<string | null> {
  const { error } = await client.rpc('make_standard_prices', { prices })
  if (!error) return null
  if (error.code === '42501') return 'Only a doctor, the matron or an admin sets standard prices.'
  return 'The prices could not be saved. Check the internet and try again.'
}
