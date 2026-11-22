/*
 * lib/record/vitals.ts: blood glucose, pain score and BMI, in words, for every
 * screen that shows vital signs (request 235).
 *
 * Why: the director's voice note, 2026-11-21: blood glucose "especially for
 * emergency patient... fasting or random... And the result." Anthony: "offer
 * both [units]... we always use the UK standard", so mmol/L comes first; a
 * reading in either unit is shown in both, so nobody converts by hand.
 *
 * Never: show a glucose without fasting or random, or without its unit.
 */

// ===== 1. Glucose =====
export type GlucoseUnit = 'mmol/L' | 'mg/dL'
export type GlucoseWhen = 'fasting' | 'random'

// The UK standard first (mmol/L), then the one many glucometers in Nigeria
// show (mg/dL).
export const GLUCOSE_UNITS: GlucoseUnit[] = ['mmol/L', 'mg/dL']
export const GLUCOSE_WHEN: [GlucoseWhen, string][] = [
  ['fasting', 'Fasting'],
  ['random', 'Random'],
]

// 1 mmol/L of glucose is 18 mg/dL.
const MG_PER_MMOL = 18

// "Fasting glucose 5.4 mmol/L (97 mg/dL)".
export function glucoseWords(
  value: number | null,
  unit: GlucoseUnit | null,
  when: GlucoseWhen | null,
): string | null {
  if (value === null || !unit || !when) return null
  const other =
    unit === 'mmol/L'
      ? `${Math.round(value * MG_PER_MMOL)} mg/dL`
      : `${(value / MG_PER_MMOL).toFixed(1)} mmol/L`
  const kind = when === 'fasting' ? 'Fasting' : 'Random'
  return `${kind} glucose ${value} ${unit} (${other})`
}

// ===== 2. BMI, worked out from the weight and the height =====
// kg divided by the height in metres, squared. Null when either is missing.
export function bmiOf(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null
  // Worked out in whole numbers first (kg x 100,000 / cm squared gives BMI x
  // 10), so 80 kg at 160 cm is exactly 31.25 and rounds to 31.3, not 31.2.
  return Math.round((weightKg * 100000) / (heightCm * heightCm)) / 10
}

// "BMI 24.2 (healthy)", using the usual adult bands.
export function bmiWords(bmi: number | null): string | null {
  if (bmi === null) return null
  const band = bmi < 18.5 ? 'underweight' : bmi < 25 ? 'healthy' : bmi < 30 ? 'overweight' : 'obese'
  return `BMI ${bmi} (${band})`
}

// ===== 3. "Other" vital signs: the numbers typed before (request 236) =====
// Anthony, 2026-11-22: once a sign has been added, "the system can populate
// it with number[s] people can pick from while still keeping the 'other'
// button". The system cannot guess sensible numbers for a sign it has never
// seen, so the list is made of the numbers this person typed before for that
// sign, on this device: bare numbers only, never a patient, at most 30.
const NUMBERS_KEY = (staffId: string) => `rhema-vital-numbers-${staffId}`

function readNumbers(staffId: string): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(NUMBERS_KEY(staffId)) ?? '{}') as Record<
      string,
      string[]
    >
  } catch {
    return {}
  }
}

export function usedNumbers(staffId: string, measureId: number): string[] {
  return readNumbers(staffId)[String(measureId)] ?? []
}

export function rememberNumber(staffId: string, measureId: number, value: number) {
  const all = readNumbers(staffId)
  const key = String(measureId)
  const next = [...new Set([...(all[key] ?? []), String(value)])]
    .sort((a, b) => Number(a) - Number(b))
    .slice(-30)
  try {
    localStorage.setItem(NUMBERS_KEY(staffId), JSON.stringify({ ...all, [key]: next }))
  } catch {
    // No storage: the box stays a plain number box.
  }
}
