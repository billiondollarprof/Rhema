/*
 * components/drafts/DraftBack.tsx: the line shown when an unsaved draft has
 * come back, with its two choices.
 *
 * Why: Anthony, 2026-11-19 (request 227j): the draft comes back "with a
 * discard draft button, or... continue to your consultation notes or
 * continue to your nursing notes... If the person discard draft, it deletes
 * everything... When the person click continue, then they go and continue."
 *
 * Never: delete a draft without the person tapping Discard.
 */
'use client'

import styles from './draftBack.module.css'
import { draftWords } from '@/lib/drafts/drafts'
import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'

export default function DraftBack({
  savedAt,
  what,
  onContinue,
  onDiscard,
}: {
  savedAt: number
  // What the draft is, for the Continue button: "consultation note".
  what: string
  onContinue: () => void
  onDiscard: () => void
}) {
  return (
    <div className={styles.box} role="status">
      <p>{draftWords(savedAt, HOSPITAL_TIME_ZONE)}</p>
      <div className={styles.buttons}>
        <button type="button" className={styles.continue} onClick={onContinue}>
          Continue your {what}
        </button>
        <button type="button" className={styles.discard} onClick={onDiscard}>
          Discard draft
        </button>
      </div>
    </div>
  )
}
