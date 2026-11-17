/*
 * lib/lab/ranges.ts: is a lab value above or below its normal range?
 *
 * Why: request 219c (Anthony, 2026-11-17: add all of 1 to 6). Number 3: a
 * value outside its normal range shows with an arrow, as Bahmni and Epic
 * do, so the doctor sees it at a glance. It only compares the number with
 * the range the Laboratory already writes beside it.
 *
 * What it reads: a result line as composeResult writes it, for example
 * "HB: 10.2 g/dl (normal M 14 to 18, F 12 to 14)". The ranges it
 * understands:
 *   - "4 to 10"
 *   - "M 40 to 54, F 36 to 46" and "men 3.45 to 17.42, women 4.60 to 25.07"
 *     (by the patient's sex; no sex recorded, no mark)
 *   - "below 200"
 *   - "4 or more"
 * Anything else ("fasting 70 to 110, random below 140", "below 92 in
 * pregnancy...") gets no mark, because the right range depends on facts
 * this cannot see.
 *
 * Never: name a diagnosis, or mark a value when the range is not certain.
 */

export type Mark = 'high' | 'low' | null

// ===== 1. The first number in some words =====
function numberIn(words: string): number | null {
  const found = words.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  return found ? Number(found[0]) : null
}

// ===== 2. One range against one value =====
function against(range: string, value: number): Mark | undefined {
  const words = range.trim().toLowerCase()
  const between = words.match(/^(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)$/)
  if (between) {
    if (value < Number(between[1])) return 'low'
    if (value > Number(between[2])) return 'high'
    return null
  }
  const below = words.match(/^below\s+(-?\d+(?:\.\d+)?)$/)
  if (below) return value >= Number(below[1]) ? 'high' : null
  const atLeast = words.match(/^(-?\d+(?:\.\d+)?)\s+or\s+more$/)
  if (atLeast) return value < Number(atLeast[1]) ? 'low' : null
  // A range we do not understand.
  return undefined
}

// ===== 3. A whole result line =====
// sex: 'male' | 'female' | anything else (no sex-specific mark then).
export function markOf(line: string, sex: string | null): Mark {
  const shape = line.match(/^[^:]+:\s*(.+?)\s*\(normal\s+(.+)\)\s*$/i)
  if (!shape) return null
  const valueWords = shape[1]
  // Words such as "Negative" or "+" have no number to compare.
  if (!/^\s*-?\d/.test(valueWords)) return null
  const value = numberIn(valueWords)
  if (value === null) return null
  const range = shape[2].trim()

  // A range for men and one for women.
  const bySex = range.match(/^(?:m|men)\s+(.+?),\s*(?:f|women)\s+(.+)$/i)
  if (bySex) {
    if (sex === 'male') return against(bySex[1], value) ?? null
    if (sex === 'female') return against(bySex[2], value) ?? null
    return null
  }
  return against(range, value) ?? null
}
