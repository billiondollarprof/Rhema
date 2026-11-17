/*
 * lib/time/serverTime.ts: the right time, from the internet, not from the
 * device's own clock.
 *
 * Why: Anthony, 2026-11-17 (request 225): "the moment they save, the time
 * automatically takes the time from the internet, the time of the day...
 * not the time in the system, in case the system is not correct."
 *
 * How:
 *   - A line saved with the network gets its time from the database itself
 *     (the screens send no time, so the database's clock is used).
 *   - For a line saved with no network, and for a time box that starts at
 *     "now", the device's clock is corrected: when the app opens it asks
 *     the hospital's server for the time (/api/time) and keeps the
 *     difference, also on the device for days with no network.
 *
 * Never: trust the device's clock when the server's time is known.
 */

const KEY = 'rhema-clock-offset'
// Milliseconds to add to the device's clock to get the right time.
let offset = (() => {
  try {
    return Number(localStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
})()
let asked = false

// ===== 1. Ask the server once per visit =====
export async function syncClock(): Promise<void> {
  if (asked) return
  asked = true
  try {
    const sent = Date.now()
    const response = await fetch('/api/time', { cache: 'no-store' })
    const { now } = (await response.json()) as { now: number }
    const back = Date.now()
    // Half the round trip is the time the answer took to arrive.
    offset = now + (back - sent) / 2 - back
    localStorage.setItem(KEY, String(Math.round(offset)))
  } catch {
    // No network: the last known difference stays.
    asked = false
  }
}

// ===== 2. Now, corrected =====
export function serverNow(): Date {
  return new Date(Date.now() + offset)
}

// "now" in the form a time box expects (local time, to the minute).
export function inputNow(): string {
  const now = serverNow()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}
