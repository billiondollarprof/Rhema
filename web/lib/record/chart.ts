/*
 * lib/record/chart.ts: the sums behind the medication chart. When was each
 * medicine last given, by whom, and when is the next dose due.
 *
 * Why: the director, 2026-11-16 (request 217c): nurses need a chart "like a
 * spreadsheet... so-so drug given at so-so time, so-so dose by so-so person.
 * So that any person that comes around will see it."
 *
 * Never: decide a dose. "Next due" is a reminder worked out from "How
 * often"; the nurse and the doctor decide.
 */
import type { DoseGiven, Medication } from './record'

// ===== 1. Hours between doses, from the words in "How often" =====
// null: no fixed time (when needed, once only, or words we do not know).
export function hoursBetween(howOften: string | null): number | null {
  if (!howOften) return null
  const words = howOften.toLowerCase().trim()
  const every = words.match(/every\s+(\d+)\s*hours?/) ?? words.match(/(\d+)\s*hourly/)
  if (every) return Number(every[1]) || null
  if (/when needed|prn|stat|once only/.test(words)) return null
  if (/four times|qds|qid/.test(words)) return 6
  if (/three times|tds|tid/.test(words)) return 8
  if (/twice|bd|bid/.test(words)) return 12
  if (/weekly/.test(words)) return 24 * 7
  if (/once daily|daily|at night|in the morning|nocte|mane/.test(words)) return 24
  return null
}

// ===== 2. The last dose of one medicine =====
// Matched by the medicine's own line; an older dose with no line is matched
// by the same name. given: only doses really given (the default); false:
// also a dose written as not given (request 219c), which still uses up its
// time, so the next one is worked out from it.
export function lastDoseOf(
  medication: Medication,
  doses: DoseGiven[],
  given = true,
): DoseGiven | null {
  const mine = doses
    .filter((dose) => !dose.voided_at)
    .filter((dose) => !given || !dose.not_given_reason)
    .filter((dose) =>
      dose.medication_id != null
        ? dose.medication_id === medication.id
        : dose.medicine.toLowerCase() === medication.medicine.toLowerCase(),
    )
    .sort((a, b) => b.given_at.localeCompare(a.given_at))
  return mine[0] ?? null
}

// ===== 3. When the next dose is due =====
// 'now': no dose yet, give the first one. null: no fixed time.
export function nextDue(medication: Medication, last: DoseGiven | null): Date | 'now' | null {
  const hours = hoursBetween(medication.how_often)
  const onceOnly = /stat|once only/i.test(medication.how_often ?? '')
  // Nothing given yet: the first dose is due, unless it is "when needed".
  if (!last) return hours !== null || onceOnly ? 'now' : null
  // Given already, and no fixed time between doses: nothing is due.
  if (hours === null) return null
  return new Date(new Date(last.given_at).getTime() + hours * 3600 * 1000)
}

// ===== 4. Is a due time past? (with 30 minutes of grace) =====
export function isLate(due: Date | 'now' | null, now: Date = new Date()): boolean {
  if (due === null) return false
  if (due === 'now') return true
  return now.getTime() > due.getTime() + 30 * 60 * 1000
}
