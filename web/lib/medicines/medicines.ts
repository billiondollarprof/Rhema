/*
 * lib/medicines/medicines.ts: the hospital's list of medicines to pick from.
 *
 * Why: Anthony, 2026-11-11: nobody should type a medicine's name and strength
 * when it can be picked. The Pharmacy keeps the list; a doctor or nurse can
 * add something that is missing, and it stays pending (seen only by them and
 * the Pharmacy) until the Pharmacy confirms it. The database decides who sees
 * what (migration medicine_list); this file only asks.
 *
 * The last list is kept in memory and on this device (the list holds no
 * patient information), so the pickers open at once and still work when the
 * network is down.
 *
 * Never: decide here whether a line is standard. Only the Pharmacy's
 * confirm makes it standard, in the database.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { recall, remember } from '../cache/memory'

// ===== 1. The shape =====
export type MedicineLine = {
  id: number
  name: string
  strength: string | null
  kind: 'medicine' | 'item'
  status: 'standard' | 'pending'
  source: 'pharmacy' | 'staff' | 'starter'
  is_active: boolean
  added_by: string | null
  created_at: string
  adder: { full_name: string } | null
  // Stock (request 214, 2026-11-16): the unit sold (tablet, sachet...), how
  // many are left, and the level below which the Pharmacy is warned. in_stock
  // null: the Pharmacy does not count this line, so nothing is required.
  unit: string | null
  in_stock: number | null
  low_level: number | null
}

// "12 tablets left", "Out of stock", or null when the line is not counted.
export function stockWords(line: Pick<MedicineLine, 'unit' | 'in_stock'>): string | null {
  if (line.in_stock === null || line.in_stock === undefined) return null
  const left = Number(line.in_stock)
  if (left <= 0) return 'Out of stock'
  return `${left} ${unitWords(line.unit, left)} left`.replace(/\s+/g, ' ')
}

// "1 tablet", "12 tablets": the unit with an s when there is more than one.
export function unitWords(unit: string | null | undefined, count: number): string {
  if (!unit) return ''
  return count === 1 || unit.endsWith('s') ? unit : `${unit}s`
}

const COLUMNS =
  'id, name, strength, kind, status, source, is_active, added_by, created_at, adder:staff!added_by(full_name), unit, in_stock, low_level'

function deviceKey(staffId: string) {
  return `rhema-medicines-${staffId}`
}

// ===== 2. Read: what is known now, and a fresh copy =====
export function knownMedicines(staffId: string | undefined): MedicineLine[] {
  if (!staffId) return []
  const inMemory = recall<MedicineLine[]>(staffId, 'medicines')
  if (inMemory) return inMemory
  try {
    const saved = JSON.parse(localStorage.getItem(deviceKey(staffId)) ?? 'null') as
      MedicineLine[] | null
    return saved ?? []
  } catch {
    return []
  }
}

export async function loadMedicines(
  client: SupabaseClient,
  staffId: string,
): Promise<MedicineLine[] | null> {
  const { data, error } = await client
    .from('medicine_list')
    .select(COLUMNS)
    .order('name')
    .order('strength')
    .limit(5000)
  // No network (or not set up yet): the caller keeps what it shows.
  if (error || !data) return null
  const lines = data as unknown as MedicineLine[]
  remember(staffId, 'medicines', lines)
  try {
    localStorage.setItem(deviceKey(staffId), JSON.stringify(lines))
  } catch {
    // The device is full or private: the memory copy still works.
  }
  return lines
}

// Forget the device copy (sign out).
export function wipeMedicines(staffId: string) {
  try {
    localStorage.removeItem(deviceKey(staffId))
  } catch {
    // Nothing to wipe.
  }
}

// ===== 3. Group and search =====
export type MedicineName = { name: string; kind: 'medicine' | 'item'; strengths: MedicineLine[] }

// One entry per name, with its strengths, only what can be used (active).
export function groupMedicines(lines: MedicineLine[]): MedicineName[] {
  const byName = new Map<string, MedicineName>()
  for (const line of lines) {
    if (!line.is_active) continue
    const key = line.name.toLowerCase()
    const found = byName.get(key)
    if (found) found.strengths.push(line)
    else byName.set(key, { name: line.name, kind: line.kind, strengths: [line] })
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// Names that start with the letters first, then names that contain them.
export function findMedicines(names: MedicineName[], typed: string, limit = 12): MedicineName[] {
  const words = typed.trim().toLowerCase()
  if (!words) return names.slice(0, limit)
  const starts = names.filter((entry) => entry.name.toLowerCase().startsWith(words))
  const contains = names.filter(
    (entry) =>
      !entry.name.toLowerCase().startsWith(words) && entry.name.toLowerCase().includes(words),
  )
  return [...starts, ...contains].slice(0, limit)
}

// ===== 4. Add, confirm, correct =====
// The Pharmacy adds it as standard; anybody else adds it as pending. Returns
// the words to show when it did not go.
export async function addMedicine(
  client: SupabaseClient,
  name: string,
  strength: string | null,
  kind: 'medicine' | 'item' = 'medicine',
): Promise<string | null> {
  const { error } = await client.rpc('add_medicine', {
    p_name: name,
    p_strength: strength,
    p_kind: kind,
  })
  if (error) {
    console.warn(`A medicine could not be added: ${error.code}`)
    return 'It could not be added to the list. Check the internet and try again.'
  }
  return null
}

export async function confirmMedicine(client: SupabaseClient, id: number): Promise<string | null> {
  const { error } = await client.rpc('confirm_medicine', { p_id: id })
  return error ? 'It could not be confirmed. Check the internet and try again.' : null
}

export async function confirmStarterMedicines(client: SupabaseClient): Promise<string | null> {
  const { error } = await client.rpc('confirm_starter_medicines')
  return error ? 'It could not be confirmed. Check the internet and try again.' : null
}

export async function updateMedicine(
  client: SupabaseClient,
  id: number,
  values: { name?: string; strength?: string | null; is_active?: boolean },
): Promise<string | null> {
  const { error } = await client.from('medicine_list').update(values).eq('id', id)
  if (error) {
    return error.code === '23505'
      ? 'That medicine and strength is already in the list.'
      : 'It could not be saved. Check the internet and try again.'
  }
  return null
}

// The words on a line: "Paracetamol 500 mg tablet".
export const medicineWords = (name: string, strength: string | null | undefined) =>
  [name, strength].filter(Boolean).join(' ')

// ===== Stock (request 214, 2026-11-16) =====
// Only the Pharmacy; the database checks. Each answers words to show, or null.
export async function setStockSettings(
  client: SupabaseClient,
  id: number,
  unit: string,
  lowLevel: number | null,
): Promise<string | null> {
  const { error } = await client.rpc('set_stock_settings', {
    medicine: id,
    new_unit: unit,
    new_low: lowLevel,
  })
  if (error?.code === '42501') return 'Only the Pharmacy sets stock.'
  return error ? 'That could not be saved. Check the internet and try again.' : null
}

export async function moveStock(
  client: SupabaseClient,
  id: number,
  amount: number,
  reason: string,
  note: string | null,
  // The expiry date of new stock, as YYYY-MM-DD (request 219c); optional.
  expires: string | null = null,
): Promise<string | null> {
  const { error } = await client.rpc('move_stock', {
    medicine: id,
    amount,
    why: reason,
    move_note: note,
    expires,
  })
  if (error?.code === '23505') return 'That was just saved.'
  if (error?.code === '42501') return 'Only the Pharmacy changes stock.'
  return error ? 'That could not be saved. Check the internet and try again.' : null
}

// ===== Stock that expires soon (request 219c, number 6) =====
// New stock whose expiry date is within 90 days, or past, for medicines
// still in stock, soonest first. Only the Pharmacy can read stock moves.
export type ExpiringBatch = {
  id: number
  medicine_id: number
  change: number
  expiry_date: string
  medicine: {
    name: string
    strength: string | null
    in_stock: number | null
    unit: string | null
  } | null
}

export async function loadExpiring(client: SupabaseClient): Promise<ExpiringBatch[]> {
  const soon = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data } = await client
    .from('stock_moves')
    .select(
      'id, medicine_id, change, expiry_date, medicine:medicine_list(name, strength, in_stock, unit)',
    )
    .eq('reason', 'restock')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', soon)
    .order('expiry_date', { ascending: true })
    .limit(100)
  const batches = (data as unknown as ExpiringBatch[] | null) ?? []
  return batches.filter((batch) => Number(batch.medicine?.in_stock ?? 0) > 0)
}
