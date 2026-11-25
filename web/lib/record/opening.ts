/*
 * lib/record/opening.ts: the words for a save the record rule refused
 * because the record was opened too long ago, and how to tell that refusal
 * apart from others.
 *
 * Why: request 248 (2026-11-25), the matron could not save. A record may
 * only be written within 12 hours of opening it, so a page left open longer
 * is refused. The screen said "try again" (which never works), or "Saved"
 * when nothing was written.
 *
 * Never: claim an old opening for a refusal that is not the record rule's.
 */

// ===== 1. The words =====
export const OLD_OPENING =
  'Not saved: this record was opened more than 12 hours ago. Go back to the patient, open the record again, then save.'

// The screen's notice when the record has stopped updating.
export const OLD_OPENING_SCREEN =
  'This record was opened more than 12 hours ago, so it has stopped updating. Save something, or go back to the patient and open the record again, to see the latest.'

// ===== 2. Is this refusal an old opening? =====
// Only the record rule's own refusal means an old opening. Other rules use
// the same code for other reasons (a signer who is not clinical staff, a
// price), and must keep their own words.
export function isOldOpening(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42501' && (error.message ?? '').includes('row-level security')
}
