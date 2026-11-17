/*
 * lib/notifications/seen.ts: what this person has already seen, so the red
 * bubble stops counting it.
 *
 * Why: Anthony, 2026-11-17 (request 222): "Once a person has seen a
 * message, let the bubble disappear. The only thing that the bubble
 * doesn't disappear... is when a doctor or any nurse or lab or pharmacy
 * requested for something, a request or a sent to room... That one stays
 * until the person acts on it."
 *
 * So an announcement, a lab result ready, or a prescription dispensed is
 * "seen" the moment its notice is unfolded in Notifications. Messages are
 * marked read in the database instead (the sender's ticks need it). Work
 * waiting (payments, tests, dispensing, patients sent to a room) is never
 * put here: it counts until it is done.
 *
 * Kept on this device only, as the notice keys (for example
 * "announcement-12" or "lab-40"), never a name or anything about a patient.
 * If the device's storage is not available, it is kept until the page
 * reloads.
 *
 * Never: hide work waiting, or keep anything but these keys.
 */

// ===== 1. Read and write the list, safely =====
const memory = new Map<string, Set<string>>()
const storageKey = (staffId: string) => `rhema-seen-${staffId}`

export function seenKeys(staffId: string): Set<string> {
  const kept = memory.get(staffId)
  if (kept) return kept
  let found = new Set<string>()
  try {
    const raw = window.localStorage.getItem(storageKey(staffId))
    if (raw) found = new Set(JSON.parse(raw) as string[])
  } catch {
    // No storage on this device: start empty.
  }
  memory.set(staffId, found)
  return found
}

export function markSeen(staffId: string, keys: string[]) {
  const all = seenKeys(staffId)
  let changed = false
  for (const key of keys) {
    if (!all.has(key)) {
      all.add(key)
      changed = true
    }
  }
  if (!changed) return
  try {
    // The newest 500 are plenty; old keys belong to things long gone.
    window.localStorage.setItem(storageKey(staffId), JSON.stringify([...all].slice(-500)))
  } catch {
    // Kept in memory only.
  }
  // The bubble counts again at once.
  window.dispatchEvent(new Event('rhema-seen'))
}

// ===== 2. The bubble: work waiting, and what has not been seen yet =====
// An info notice counts only its items not seen; work always counts in full.
export function bubbleOf(
  notices: { info?: boolean; count: number; items: { key: string }[] }[],
  seen: Set<string>,
): number {
  return notices.reduce(
    (sum, notice) =>
      sum +
      (notice.info ? notice.items.filter((item) => !seen.has(item.key)).length : notice.count),
    0,
  )
}
