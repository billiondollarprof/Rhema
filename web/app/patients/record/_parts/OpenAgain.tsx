/*
 * record/_parts/OpenAgain.tsx: the notice at the top of a record that was
 * opened more than 12 hours ago, with "Open the record again".
 *
 * Why: a record may be written only within 12 hours of opening it, so the
 * opening is always in the activity log. Anthony, 2026-11-26 (request 252):
 * "We want to only do the things that will keep the data trustworthy... if
 * it is to only redirect the page, the staff to go over it again." So when
 * the screen is past 12 hours (it stops updating), or a save is refused for
 * it, this shows, the page goes to the top, and the button opens the record
 * again: a fresh opening in the log, the latest from the database, and the
 * person enters what was not saved again themselves.
 *
 * Never: save anything by itself, or open the record without a tap.
 */
'use client'

import { useEffect, useState } from 'react'
import styles from './record.module.css'
import { OLD_OPENING_EVENT } from '@/lib/record/record'
import { OLD_OPENING_SCREEN } from '@/lib/record/opening'

// ===== 1. The notice =====
// stale: the screen found the 12 hours are over when reading again.
export default function OpenAgain({ stale }: { stale: boolean }) {
  // A save refused for an old opening (announced by lib/record/record.ts).
  const [refused, setRefused] = useState(false)

  // ===== 2. Hear a refused save, and go to the top where this shows =====
  useEffect(() => {
    function heard() {
      setRefused(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener(OLD_OPENING_EVENT, heard)
    return () => window.removeEventListener(OLD_OPENING_EVENT, heard)
  }, [])

  if (!stale && !refused) return null
  // ===== 3. The words and the button =====
  // Reloading the page opens the record again the normal way.
  return (
    <div className={`${styles.banner} ${styles.bannerAmber} ${styles.openAgain}`} role="alert">
      <span>{OLD_OPENING_SCREEN}</span>
      <button
        type="button"
        className={`${styles.small} ${styles.primary}`}
        onClick={() => window.location.reload()}
      >
        Open the record again
      </button>
    </div>
  )
}
