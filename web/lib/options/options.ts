/*
 * lib/options/options.ts: the short lists people pick from instead of typing:
 * doses, how often, allergens, reactions and conditions.
 *
 * Why: Anthony, 2026-11-12: "we want it easy so they can always pick from a
 * list... virtually everything repetitive, so they will have just little to
 * write. When they choose Other, they can type by hand, and also type notes
 * by hand. The aim is to reduce what they type by hand."
 *
 * What a record keeps is still the words. These lists only help pick them.
 * Something typed with "Other" is kept for that person (and appears in their
 * list from then on); when a second person types the same one it becomes
 * standard for everybody (the database decides). A person can remove one they
 * typed themselves.
 *
 * The last lists are kept in memory and on this device (they hold no patient
 * information), so the drop downs open at once and still work without a
 * network.
 *
 * Never: put anything about a patient in these lists.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { recall, remember } from '../cache/memory'

export type PickList = 'dose' | 'frequency' | 'allergen' | 'reaction' | 'condition'

export type PickOption = {
  id: number
  list: PickList
  label: string
  standard: boolean
  position: number | null
}

function deviceKey(staffId: string) {
  return `rhema-options-${staffId}`
}

// ===== 1. Read =====
export function knownOptions(staffId: string | undefined): PickOption[] {
  if (!staffId) return []
  const inMemory = recall<PickOption[]>(staffId, 'options')
  if (inMemory) return inMemory
  try {
    const saved = JSON.parse(localStorage.getItem(deviceKey(staffId)) ?? 'null') as
      PickOption[] | null
    return saved ?? []
  } catch {
    return []
  }
}

export async function loadOptions(
  client: SupabaseClient,
  staffId: string,
): Promise<PickOption[] | null> {
  const { data, error } = await client
    .from('pick_options')
    .select('id, list, label, standard, position')
    .order('position', { ascending: true, nullsFirst: false })
    .order('label')
    .limit(2000)
  if (error || !data) return null
  const all = data as unknown as PickOption[]
  remember(staffId, 'options', all)
  try {
    localStorage.setItem(deviceKey(staffId), JSON.stringify(all))
  } catch {
    // The device is full or private: the memory copy still works.
  }
  return all
}

export function wipeOptions(staffId: string) {
  try {
    localStorage.removeItem(deviceKey(staffId))
  } catch {
    // Nothing to wipe.
  }
}

// One list, in its own order: the starter order first, then what the person
// typed.
export function optionsOf(all: PickOption[], list: PickList): PickOption[] {
  return all
    .filter((option) => option.list === list)
    .sort((a, b) => {
      const left = a.position ?? 100000
      const right = b.position ?? 100000
      return left - right || a.label.localeCompare(b.label)
    })
}

// ===== 2. Type one that is missing, or remove one I typed =====
// Returns the words to use (the list's own spelling if it is already there),
// or null when it could not be saved.
export async function addOption(
  client: SupabaseClient,
  list: PickList,
  label: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('use_pick_option', { p_list: list, p_label: label })
  if (error || typeof data !== 'string') return null
  return data
}

export async function removeOption(client: SupabaseClient, list: PickList, label: string) {
  await client.rpc('forget_pick_option', { p_list: list, p_label: label })
}
