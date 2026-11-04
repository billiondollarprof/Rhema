/*
 * lib/cache/memory.ts: the last thing each screen loaded, kept in memory,
 * so going back to a screen shows it at once while a fresh copy loads.
 *
 * Why: request 145 (Anthony, 2026-11-04): "switching from one of those page
 * to another page, sometimes it's like there's a little bit of delay in
 * loading data." CLAUDE.md 8: moving between screens behaves like a native
 * app, with a cache on the device.
 *
 * Rules:
 *   - Every key starts with the staff id, so one person never sees what
 *     another person loaded on the same device.
 *   - It lives in memory only: closing or reloading the app empties it,
 *     and signing out empties it at once (session.tsx).
 *   - A screen always loads a fresh copy straight after showing this one.
 *
 * Never: keep anything here on disk.
 */

// ===== 1. The store =====
const store = new Map<string, unknown>()

// ===== 2. Keep and read =====
export function remember<T>(staffId: string, key: string, value: T): T {
  store.set(`${staffId}:${key}`, value)
  return value
}

export function recall<T>(staffId: string | undefined, key: string): T | null {
  if (!staffId) return null
  return (store.get(`${staffId}:${key}`) as T | undefined) ?? null
}

// ===== 3. Empty it (sign out) =====
export function forgetAll(staffId?: string) {
  if (!staffId) {
    store.clear()
    return
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(`${staffId}:`)) store.delete(key)
  }
}
