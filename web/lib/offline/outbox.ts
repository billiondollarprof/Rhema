/*
 * lib/offline/outbox.ts: things saved on this device while the network was
 * down, waiting to be sent (request 128, step 3).
 *
 * Why: Anthony, 2026-11-02: "if the network is poor, the system should say
 * so, that patient is registering, and that they can continue doing other
 * things... the system will be saving the patient information in the
 * background... when the network is back, the system just automatically
 * push it to server." And for notes and vital signs: "The thing should
 * show that it has not saved. But let it save."
 *
 * What waits here, as plain text only (never a file or a picture):
 *   register   a new patient from Register patient
 *   record     one medical record entry (a note, a reading, an allergy...)
 * The sender (components/offline/OutboxSender) sends them when it can.
 * The database's double tap guard and a check before each resend make sure
 * nothing is saved twice.
 *
 * Kept per person on this device, and wiped when they sign out.
 *
 * Never: keep anything here after it is sent, or after sign out.
 */

// ===== 1. Shapes =====
export type OutboxTask =
  | {
      id: string
      kind: 'register'
      created: number
      label: string
      values: Record<string, unknown>
      failed?: string
    }
  | {
      id: string
      kind: 'record'
      created: number
      label: string
      patientId: number
      table: string
      values: Record<string, unknown>
      failed?: string
    }

export const OUTBOX_CHANGED = 'rhema-outbox-changed'

function key(staffId: string) {
  return `rhema-outbox-${staffId}`
}

// ===== 2. Read and write, never crashing in a private window =====
export function readOutbox(staffId: string): OutboxTask[] {
  try {
    return JSON.parse(localStorage.getItem(key(staffId)) ?? '[]') as OutboxTask[]
  } catch {
    return []
  }
}

function writeOutbox(staffId: string, tasks: OutboxTask[]) {
  try {
    if (tasks.length) localStorage.setItem(key(staffId), JSON.stringify(tasks))
    else localStorage.removeItem(key(staffId))
  } catch {
    // Storage full or blocked: the task stays only in this page's memory.
  }
  window.dispatchEvent(new Event(OUTBOX_CHANGED))
}

// The two kinds as callers write them, before an id and a time are added.
type NewTask =
  | { kind: 'register'; label: string; values: Record<string, unknown> }
  | {
      kind: 'record'
      label: string
      patientId: number
      table: string
      values: Record<string, unknown>
    }

export function addToOutbox(staffId: string, task: NewTask) {
  const full = { ...task, id: crypto.randomUUID(), created: Date.now() } as OutboxTask
  writeOutbox(staffId, [...readOutbox(staffId), full])
}

export function removeFromOutbox(staffId: string, id: string) {
  writeOutbox(
    staffId,
    readOutbox(staffId).filter((task) => task.id !== id),
  )
}

export function markFailed(staffId: string, id: string, why: string) {
  writeOutbox(
    staffId,
    readOutbox(staffId).map((task) => (task.id === id ? { ...task, failed: why } : task)),
  )
}

// Sign out: nothing of this person's stays on the device.
export function wipeOutbox(staffId: string) {
  try {
    localStorage.removeItem(key(staffId))
  } catch {
    // Nothing to wipe.
  }
}

// ===== 3. Was this a network failure, not a refusal? =====
// supabase-js reports a dropped connection as an error with no database
// code, whose message mentions fetch. A refusal always carries a code.
export function isNetworkFailure(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return !error.code && /fetch|network|load failed/i.test(error.message ?? '')
}
