/*
 * lib/record/doses.ts: how many doses a chart medicine is, from how often
 * and for how many days.
 *
 * Why: Anthony, 2026-11-23 (request 240, his yes to the chart the Epic and
 * Bahmni way): the doctor charts how often and for how many days; the system
 * works out the doses ("twice a day for 3 days is 6 doses"), the nurse sees
 * "Dose 2 of 6", and the bill counts doses given × the price of a dose.
 *
 * The number is only a suggestion on the screen: the doctor can change it.
 *
 * Never: guess a number for "When needed" or words it does not know.
 */
import type { DoseGiven, Medication } from './record'

// ===== 1. Doses in one day, for the words on the hospital's list =====
const PER_DAY: Record<string, number> = {
  'once daily': 1,
  'twice daily': 2,
  'three times daily': 3,
  'four times daily': 4,
  'at night': 1,
  'in the morning': 1,
  'every 4 hours': 6,
  'every 6 hours': 4,
  'every 8 hours': 3,
  'every 12 hours': 2,
}

// ===== 2. Doses in the whole course =====
// null: not known (When needed, or words typed with Other), so the doctor
// types the number.
export function courseDoses(howOften: string | null, days: number | null): number | null {
  const words = (howOften ?? '').trim().toLowerCase()
  if (words === 'once only (stat)') return 1
  if (!days || days < 1) return null
  if (words === 'once weekly') return Math.ceil(days / 7)
  const perDay = PER_DAY[words]
  return perDay ? perDay * days : null
}

// ===== 3. "Dose 2 of 6", or "Dose 2" when the course has no number =====
export function doseWords(given: number, doses: number | null): string {
  return doses ? `${given} of ${doses} doses given` : `${given} doses given`
}

// ===== 4. Doses of this medicine given so far (not given ones do not count) =====
export function givenCount(medication: Pick<Medication, 'id'>, doses: DoseGiven[]): number {
  return doses.filter(
    (dose) => dose.medication_id === medication.id && !dose.voided_at && !dose.not_given_reason,
  ).length
}
