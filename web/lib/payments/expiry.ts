/*
 * lib/payments/expiry.ts: drugs and lab tests not paid within 72 hours
 * expire (request 228a).
 *
 * Why: Anthony, 2026-11-19: "a payment that has not been taken maybe after
 * 24 hours. I want it to expire and clean off by itself... If the drug is
 * already given, show it as a payment that is owed. If it is not given,
 * expire it and grey it out." 72 hours, his choice on 2026-11-20 (it was 24).
 *
 * How: the database decides what expires (expire_unpaid, migration
 * 20261119211756). The lists ask it to run as they load, so what
 * is shown is always up to date, with no separate timer. It runs at most
 * once a minute from one screen, because a page can load several lists,
 * and at the same time as the list, not before it (withExpiry).
 *
 * Never: decide here what expires, or stop a list loading when this fails.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Run the expiry, at most once a minute =====
// The last run, so two lists loading together share it. Answers how many
// expired (0 when the run failed, or was shared and already counted).
let lastRun = 0
let running: Promise<number> = Promise.resolve(0)

export function expireUnpaid(client: SupabaseClient): Promise<number> {
  if (Date.now() - lastRun < 60_000) return running.then(() => 0)
  lastRun = Date.now()
  // A failure (no network, say) only means nothing expired this time.
  running = Promise.resolve(client.rpc('expire_unpaid')).then(
    ({ data }) => (typeof data === 'number' ? data : 0),
    () => 0,
  )
  return running
}

// ===== 1b. Load a list while the expiry runs, not after it =====
// One trip on a poor network instead of two (request 230, 2026-11-20: "The
// app still loads really fast, even with the smallest amount of network").
// Only when something did expire just now is the list loaded once more.
export async function withExpiry<T>(client: SupabaseClient, load: () => Promise<T>): Promise<T> {
  const [expired, first] = await Promise.all([expireUnpaid(client), load()])
  return expired > 0 ? load() : first
}

// ===== 2. The words when the database refuses one that has expired =====
export const EXPIRED_WORDS = 'This has expired. It was not paid within 72 hours.'

export function isExpiredRefusal(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.startsWith('expired'))
}
