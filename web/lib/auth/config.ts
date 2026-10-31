/*
 * lib/auth/config.ts: the settings sign in needs, in one place.
 *
 * Why: the app is built as plain files, so the Supabase address and its
 * publishable key are baked in at build time. The deploy workflow fetches
 * them for the right project (testing or live) and passes them in. The
 * publishable key is meant to be public: every browser that opens the app
 * gets it. What protects the data is RLS in the database, not this key.
 *
 * Never: put the secret (service role) key here. Anything in this file ends
 * up in every visitor's browser.
 */

// ===== 1. Which Supabase project this build talks to =====
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''

// A build made without them (for example in CI) still runs, and the sign
// in screen says sign in is not set up, instead of crashing.
export const isConfigured = SUPABASE_URL !== '' && SUPABASE_KEY !== ''

// ===== 2. Time limits (decided by Anthony, 2026-10-28) =====
// No use for 1 hour: the screen locks and asks for the PIN. It was 10
// minutes until 2026-10-31, when Anthony moved it to 1 hour so a slow
// network does not lock people out while a page is loading.
export const LOCK_AFTER_MS = 60 * 60 * 1000
// No use for 24 hours: that person is signed out of this device and must
// use an email code again.
export const EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000

// ===== 3. PIN and code rules =====
export const PIN_LENGTH = 4
// Must match "Email OTP length" in Supabase (set by hand, checked by
// ops/supabase_check.py on every run).
export const CODE_LENGTH = 6
