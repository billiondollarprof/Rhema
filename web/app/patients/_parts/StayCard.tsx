/*
 * app/patients/_parts/StayCard.tsx: Inpatient or Outpatient, on the
 * patient's page, with Admit and Discharge.
 *
 * Why: Anthony, 2026-11-23 (requests 240 and 242): "a patient can be marked
 * inpatient or outpatient"; Admit by "the doctor, the matron, the front
 * desk"; once the bill is paid "the system can ask the doctor to discharge
 * this patient... once discharge is clicked the person [goes] to
 * outpatient".
 *
 * Every member of staff sees whether the patient is in. Admit asks once;
 * Discharge asks once. When the stay's bill is paid and nothing is owed,
 * the doctor or matron sees "The bill is paid. Discharge?".
 *
 * Never: decide access here. The database refuses anybody else.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './patients.module.css'
import type { StaffMember } from '@/lib/auth/session'
import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import { admit, canAdmit, canDischarge, discharge, type Stay } from '@/lib/stay/stay'
import type { Statement } from '@/lib/bills/bills'

const since = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function StayCard({
  client,
  staff,
  patientId,
  stay,
  statement,
  onChanged,
}: {
  client: SupabaseClient
  staff: StaffMember
  patientId: number
  // undefined while loading; null for an outpatient.
  stay: Stay | null | undefined
  // The stay's bill statement, when this person may see it.
  statement: Statement | null
  onChanged: () => void
}) {
  const [asking, setAsking] = useState<'admit' | 'discharge' | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  if (stay === undefined) return null

  async function go(step: 'admit' | 'discharge') {
    setBusy(true)
    const failed =
      step === 'admit' ? await admit(client, patientId) : await discharge(client, patientId)
    setBusy(false)
    setProblem(failed)
    setAsking(null)
    if (!failed) onChanged()
  }

  // The bill is paid and nothing is owed: offer Discharge first.
  // (A bill the deposits already cover counts as paid.)
  const settled =
    Boolean(statement?.admitted) &&
    (statement?.bills ?? []).length > 0 &&
    (statement?.balance ?? 1) <= 0

  return (
    <div className={styles.factGroup}>
      <h3>Stay</h3>
      <p>
        {stay ? (
          <>
            <span className={`${styles.tag} ${styles.tagBusy}`}>Inpatient</span> since{' '}
            {since(stay.admitted_at)}
            {stay.admitter ? `, admitted by ${stay.admitter.full_name}` : ''}
          </>
        ) : (
          <span className={styles.tag}>Outpatient</span>
        )}
      </p>

      {settled && canDischarge(staff) && asking === null ? (
        <p className={styles.ok}>
          <b>The bill is paid. Discharge this patient?</b>
        </p>
      ) : null}

      {asking ? (
        <div className={styles.dispenseRow}>
          <b>{asking === 'admit' ? 'Admit this patient?' : 'Discharge this patient?'}</b>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() => setAsking(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            disabled={busy}
            onClick={() => go(asking)}
          >
            {busy ? 'Saving…' : asking === 'admit' ? 'Yes, admit' : 'Yes, discharge'}
          </button>
        </div>
      ) : (
        <div className={styles.dispenseRow}>
          {!stay && canAdmit(staff) ? (
            <button type="button" className={styles.button} onClick={() => setAsking('admit')}>
              Admit
            </button>
          ) : null}
          {stay && canDischarge(staff) ? (
            <button
              type="button"
              className={settled ? `${styles.button} ${styles.primary}` : styles.button}
              onClick={() => setAsking('discharge')}
            >
              Discharge
            </button>
          ) : null}
        </div>
      )}
      {problem ? <p className={styles.muted}>{problem}</p> : null}
    </div>
  )
}
