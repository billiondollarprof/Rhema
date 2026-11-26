/*
 * components/stay/StayPill.tsx: the small "In" or "Out" pill a patient
 * carries on every line: Find patient, the queue, the lab, the pharmacy,
 * bills, the patient's page and the record.
 *
 * Why: Anthony, 2026-11-26 (request 258): "a green pill, and put in on it.
 * Then for the other one, put an orange pill... and put out on it...
 * something really small that will not clutter the card... the patient
 * always carries that logo, even when they appear on the doctor's patient
 * queue or anything."
 *
 * How: one shared read of who is admitted now (lib/stay, loadInPatients),
 * kept on this device for the session, read again when anything is saved
 * (lib/live/changes). Every pill on the screen uses the same answer.
 *
 * Never: show a pill before the answer is known (a wrong "Out" on an
 * inpatient is worse than none).
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './StayPill.module.css'
import { loadInPatients } from '@/lib/stay/stay'
import { onChange } from '@/lib/live/changes'

// ===== 1. One answer for the whole screen =====
let inPatients: Set<number> | null = null
let lastRead = 0
let reading: Promise<void> | null = null
const listeners = new Set<() => void>()

function readAgain(client: SupabaseClient) {
  if (reading) return reading
  reading = loadInPatients(client).then((found) => {
    reading = null
    lastRead = Date.now()
    if (found) {
      inPatients = found
      for (const listener of listeners) listener()
    }
  })
  return reading
}

// The admitted patients, kept fresh: read when first needed, again after
// 30 seconds, and whenever something is saved anywhere.
export function useInPatients(client: SupabaseClient | null): Set<number> | null {
  const [found, setFound] = useState<Set<number> | null>(inPatients)
  useEffect(() => {
    if (!client) return
    const heard = () => setFound(inPatients)
    listeners.add(heard)
    if (!inPatients || Date.now() - lastRead > 30000) void readAgain(client)
    const stop = onChange(client, 'records', () => void readAgain(client))
    return () => {
      listeners.delete(heard)
      stop()
    }
  }, [client])
  return found
}

// ===== 2. The pill =====
// patientId: whose pill. Nothing shows until the answer is known.
export default function StayPill({
  client,
  patientId,
}: {
  client: SupabaseClient | null
  patientId: number | null | undefined
}) {
  const found = useInPatients(client)
  if (!found || !patientId) return null
  const inside = found.has(patientId)
  return (
    <span
      className={inside ? styles.in : styles.out}
      title={inside ? 'Inpatient (admitted)' : 'Outpatient'}
      aria-label={inside ? 'Inpatient' : 'Outpatient'}
    >
      {inside ? 'In' : 'Out'}
    </span>
  )
}
