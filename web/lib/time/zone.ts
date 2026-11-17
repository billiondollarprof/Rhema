/*
 * lib/time/zone.ts: the hospital's own time zone, for every time shown.
 *
 * Why: Anthony, 2026-11-17 (request 226a): the database keeps the exact
 * moment (no time zone, so it is right wherever the server is); "within the
 * app it just uses the Nigeria time on its own. So if we deploy this same
 * for a hospital in India... it still uses server time regardless, and
 * everything is still correct." So every screen shows the hospital's clock,
 * whatever each phone or computer is set to, and a hospital elsewhere sets
 * NEXT_PUBLIC_TIME_ZONE (for example Asia/Kolkata) when it is deployed.
 *
 * Only moments (a dose given, a payment taken) are shown this way. A
 * calendar date with no time (a date of birth, an expiry date) is never
 * moved between time zones, so a birthday can never slip by a day.
 *
 * Never: change what is saved. Saving keeps the exact moment.
 */

export const HOSPITAL_TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || 'Africa/Lagos'

// The day a moment falls on, in the hospital's time zone: "2026-11-17".
export function hospitalDay(moment: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOSPITAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(moment))
}
