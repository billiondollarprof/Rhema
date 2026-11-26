/*
 * components/warnings/SameWarning.tsx: "this was already asked for" with
 * two buttons, to go on anyway or to cancel.
 *
 * Why: Anthony, 2026-11-26 (request 251): when the same test or drug is
 * asked for again for the same patient, or about to be paid twice, "the
 * system shows [a] warning and then give them a key to continue anyway or
 * cancel." Used by Request lab, Prescribe, and the Front Desk's Take
 * payment on the Laboratory and Pharmacy cards.
 *
 * Never: decide for the person. Both buttons are always there.
 */
'use client'

import styles from './SameWarning.module.css'

// ===== 1. The warning =====
// words: what is the same and when (lib/orders/duplicates.ts).
// goLabel: "Send anyway" or "Take payment anyway".
export default function SameWarning({
  words,
  goLabel,
  onGo,
  onCancel,
  busy = false,
}: {
  words: string
  goLabel: string
  onGo: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <div className={styles.warning} role="alert">
      <p>{words}</p>
      <div className={styles.buttons}>
        <button type="button" className={styles.go} disabled={busy} onClick={onGo}>
          {busy ? 'Saving…' : goLabel}
        </button>
        <button type="button" className={styles.cancel} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
