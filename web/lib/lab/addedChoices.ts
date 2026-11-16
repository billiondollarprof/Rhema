/*
 * lib/lab/addedChoices.ts: words the Laboratory typed with Other inside a
 * lab test's box, kept so they are on the list next time, for everybody.
 *
 * Why: Anthony, 2026-11-16 (request 209e): "even under a test, if there is a
 * type they can add, because I noticed there's no significant titre value."
 * Saved by the database function add_lab_choice (Laboratory or admin only).
 *
 * Never: hold anything about a patient. These are words such as "1/1280".
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// "Widal Test|S. typhi D, O antigen", in small letters, so capitals never
// make two lists.
export function choiceKey(test: string, box: string): string {
  return `${test.trim().toLowerCase()}|${box.trim().toLowerCase()}`
}

// Every added word, by test and box.
export async function loadAddedChoices(client: SupabaseClient): Promise<Record<string, string[]>> {
  const { data, error } = await client
    .from('lab_field_choices')
    .select('test, field, label')
    .order('created_at')
    .limit(2000)
  if (error || !data) return {}
  const found: Record<string, string[]> = {}
  for (const row of data as { test: string; field: string; label: string }[]) {
    const key = choiceKey(row.test, row.field)
    found[key] = [...(found[key] ?? []), row.label]
  }
  return found
}

// Keep one word for a test's box. Returns the words as kept, or null.
export async function saveAddedChoice(
  client: SupabaseClient,
  test: string,
  box: string,
  words: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('add_lab_choice', {
    p_test: test,
    p_field: box,
    p_label: words,
  })
  if (error || typeof data !== 'string') return null
  return data
}
