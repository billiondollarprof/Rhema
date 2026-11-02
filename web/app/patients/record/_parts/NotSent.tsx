/*
 * record/_parts/NotSent.tsx: entries for this patient that wait on this
 * device because the network was down (request 128, step 3).
 *
 * Why: Anthony, 2026-11-02: "The thing should show that it has not saved.
 * But let it save." So the record says plainly what has not reached the
 * database yet; it goes by itself when the network is back.
 *
 * Never: hide an entry that has not been sent.
 */
'use client'

import { useEffect, useState } from 'react'
import styles from './record.module.css'
import { OUTBOX_CHANGED, readOutbox, type OutboxTask } from '@/lib/offline/outbox'

export default function NotSent({ staffId, patientId }: { staffId: string; patientId: number }) {
  const [waiting, setWaiting] = useState<OutboxTask[]>([])

  useEffect(() => {
    const show = () =>
      setWaiting(
        readOutbox(staffId).filter(
          (task) => task.kind === 'record' && task.patientId === patientId,
        ),
      )
    show()
    window.addEventListener(OUTBOX_CHANGED, show)
    return () => window.removeEventListener(OUTBOX_CHANGED, show)
  }, [staffId, patientId])

  if (waiting.length === 0) return null
  return (
    <div className={`${styles.banner} ${styles.bannerAmber} ${styles.noPrint}`} role="status">
      Not saved yet: {waiting.map((task) => task.label).join(', ')}. It will save by itself when the
      network is back.
    </div>
  )
}
