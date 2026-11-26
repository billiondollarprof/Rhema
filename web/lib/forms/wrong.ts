/*
 * lib/forms/wrong.ts: is what was typed in a number box wrong?
 *
 * Why: Anthony, 2026-11-26 (request 252): when somebody types a wrong
 * value, "the system should show them, tell them it's wrong so they can
 * type the right thing... in other places where wrong values are entered."
 * Each screen marks such a box aria-invalid (red, app/globals.css) and says
 * in words what to type. Amounts in naira use amountWrong in lib/prices.
 *
 * Never: call an empty box wrong. Empty is not filled in yet.
 */

// ===== 1. A whole number from min to max =====
// "3" and "12" are right; "2.5", "-1", "abc" and a number past max are wrong.
export function countWrong(typed: string | undefined | null, min = 0, max = 100000): boolean {
  if (!typed || typed.trim() === '') return false
  const value = Number(typed.trim())
  return !Number.isInteger(value) || value < min || value > max
}

// ===== 2. A quantity, whole or not, from min up =====
// For stock counted in litres or tablets: "2.5" is right; "1.2.3", "abc"
// and a number under min are wrong.
export function quantityWrong(typed: string | undefined | null, min = 0): boolean {
  if (!typed || typed.trim() === '') return false
  const value = Number(typed.trim())
  return Number.isNaN(value) || value < min
}
