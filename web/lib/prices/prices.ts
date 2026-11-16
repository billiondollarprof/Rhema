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
export type PriceKind = 'card' | 'consultation' | 'lab_test'
export type Price = { id: number; kind: PriceKind; item: string; amount: number }

// The names the card and consultation prices are kept under.
export const CARD_ITEM = 'Registration card'
export const CONSULTATION_ITEM = 'Consultation'

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
