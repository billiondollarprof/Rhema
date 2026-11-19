/*
 * lib/payments/expiry.ts: drugs and lab tests not paid within 24 hours
 * expire (request 228a).
 *
 * Why: Anthony, 2026-11-19: "a payment that has not been taken maybe after
 * 24 hours. I want it to expire and clean off by itself... If the drug is
 * already given, show it as a payment that is owed. If it is not given,
 * expire it and grey it out."
 *
 * How: the database decides what expires (expire_unpaid, migration
 * 20261119211756). The lists ask it to run just before they load, so what
 * is shown is always up to date, with no separate timer. It runs at most
 * once a minute from one screen, because a page can load several lists.
 *
 * Never: decide here what expires, or stop a list loading when this fails.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Run the expiry, at most once a minute =====
// The last run, so two lists loading together wait for the same one.
let lastRun = 0
let running: Promise<void> = Promise.resolve()

export function expireUnpaid(client: SupabaseClient): Promise<void> {
  if (Date.now() - lastRun < 60_000) return running
  lastRun = Date.now()
  // A failure (no network, say) only means nothing expired this time.
  running = Promise.resolve(client.rpc('expire_unpaid')).then(
    () => undefined,
    () => undefined,
  )
  return running
}

// ===== 2. The words when the database refuses one that has expired =====
export const EXPIRED_WORDS = 'This has expired. It was not paid within 24 hours.'

export function isExpiredRefusal(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.startsWith('expired'))
}
