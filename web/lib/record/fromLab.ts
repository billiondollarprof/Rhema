/*
 * lib/record/fromLab.ts: the newest value of one thing (HB, PCV, urine
 * protein, blood group...) out of a patient's lab results, so the antenatal
 * card shows it without anybody typing it again.
 *
 * Why: Anthony, 2026-11-26 (request 256): "When a row or a detail is
 * already filled in somewhere, let them automatically appear in the
 * antenatal section too so they don't have to fill any information twice."
 * The Laboratory writes each result as plain lines, "HB: 11 g/dl (normal
 * M 14 to 18, F 12 to 14)" or "Protein: +" (lib/lab/catalogue.ts,
 * composeResult), so the value is the words after the name and before the
 * unit or the normal range.
 *
 * Never: change a value. A word the visit form does not take (such as
 * "++++" for urine) is not filled in; the matron picks it herself.
 */

// ===== 1. Shapes =====
// One lab result, as the record reads it.
export type LabLine = { test: string; result: string; recorded_at: string }

// A value found, and when the lab recorded it.
export type Found = { value: string; at: string }

// ===== 2. The newest value under any of these names =====
// names: what the line may start with, such as ['HB', 'Haemoglobin (HB)'].
// withinDays: only results this recent; leave out for any age.
export function newestValue(
  results: LabLine[],
  names: string[],
  withinDays?: number,
): Found | null {
  const since = withinDays ? Date.now() - withinDays * 24 * 60 * 60 * 1000 : 0
  const wanted = names.map((name) => name.toLowerCase())
  // Newest first.
  const sorted = [...results].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
  for (const one of sorted) {
    if (new Date(one.recorded_at).getTime() < since) continue
    for (const line of one.result.split('\n')) {
      const colon = line.indexOf(':')
      if (colon < 1) continue
      const name = line.slice(0, colon).trim().toLowerCase()
      if (!wanted.includes(name)) continue
      // "11 g/dl (normal M 14 to 18)" -> "11 g/dl" -> the words before a bracket.
      const value = line
        .slice(colon + 1)
        .split('(normal')[0]
        .trim()
      if (value) return { value, at: one.recorded_at }
    }
  }
  return null
}

// ===== 3. A number, such as HB 11 or PCV 33 =====
export function newestNumber(
  results: LabLine[],
  names: string[],
  withinDays?: number,
): Found | null {
  const found = newestValue(results, names, withinDays)
  if (!found) return null
  const number = found.value.match(/^\d+(\.\d+)?/)
  return number ? { value: number[0], at: found.at } : null
}

// ===== 4. Urine on the dipstick, in the visit form's words =====
// The visit takes Nil, Trace, +, ++ and +++. The lab also says Negative
// (the same as Nil) and Small (the same as Trace); anything else is left
// for the matron to pick.
export function dipstickWords(value: string): string | null {
  const word = value.trim()
  if (word === 'Nil' || word === 'Negative') return 'Nil'
  if (word === 'Trace' || word === 'Small') return 'Trace'
  if (word === '+' || word === '++' || word === '+++') return word
  return null
}

// ===== 5. Blood group in the record's short form =====
// "O Rh D positive" -> "O+". Anything else is shown as the lab wrote it.
export function shortBloodGroup(value: string): string {
  const match = value.match(/^(A|B|AB|O)\s+Rh\s*D\s+(positive|negative)$/i)
  if (!match) return value
  return `${match[1].toUpperCase()}${match[2].toLowerCase() === 'positive' ? '+' : '-'}`
}

// ===== 6. The names each thing is written under =====
export const LAB_NAMES = {
  hb: ['HB', 'Haemoglobin (HB)'],
  pcv: ['PCV'],
  protein: ['Protein'],
  sugar: ['Glucose'],
  bloodGroup: ['Blood Group'],
  genotype: ['Genotype'],
  rvs: ['RVS', 'RVS (HIV 1 & 2)'],
  hepatitisB: ['Hepatitis B (HBsAg)'],
  hepatitisC: ['Hepatitis C (HCV)'],
}
