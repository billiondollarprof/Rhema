/*
 * app/patients/record/consult/page.tsx: the consultation on its own full
 * page (?p=12).
 *
 * Why: the director, through Anthony, 2026-11-17 (request 224): "when he
 * clicks consultation... open a complete full page with the different
 * categories like history and symptoms... listed like a spreadsheet... he
 * can decide to use the picker... or type by hand... so he can type in his
 * notes and also see what he's typing." Seen by is the person signed in,
 * with their room (request 225: the system knows who is logged in; nobody
 * picks a name).
 *
 * The note itself is the same as on the record page (_parts/Consultation),
 * shown full page: Seen by, the four parts as rows that grow as you type,
 * medicines for the chart with their route, Save, then Send to the nurses
 * or Request lab. Earlier consultations are listed under it.
 *
 * Never: let anybody without a consulting room write (the database decides
 * it again), or show the record before it is opened.
 */
'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from '../../_parts/patients.module.css'
import ConsultationsSection from '../_parts/Consultation'
import { useRecord } from '../_parts/useRecord'
import AppShell from '@/components/shell/AppShell'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'
import { actsAsDoctor } from '@/lib/auth/roles'
import { OLD_OPENING_SCREEN } from '@/lib/record/opening'

function Consult() {
  const auth = useAuth()
  useRightPage(auth.status, '/patients/record/consult/')
  const id = Number(useSearchParams().get('p')) || null
  const { client, staff } = auth
  const allowed = Boolean(staff?.can_medical)
  const { patient, record, savedAt, refused, stale, reload } = useRecord(
    client,
    staff?.id ?? null,
    id,
    allowed,
  )

  if (auth.status !== 'ready' || !client || !staff) return null
  const canWrite = staff.room?.kind === 'consultation'

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.head}>
          <div>
            <h2>Consultation</h2>
            {patient ? (
              <p className={styles.muted}>
                {patient.full_name} · {patient.patient_number}
              </p>
            ) : null}
          </div>
          <Link className={styles.button} href={`/patients/record/?p=${id}`}>
            Back to the record
          </Link>
        </div>
        {stale ? <p className={styles.muted}>{OLD_OPENING_SCREEN}</p> : null}
        {savedAt ? (
          <p className={styles.muted}>No network: showing the copy kept on this device.</p>
        ) : null}
        {!allowed ? <p className={styles.muted}>Only clinical staff open records.</p> : null}
        {refused ? (
          <p className={styles.muted}>This record could not be opened. Try again.</p>
        ) : null}
        {allowed && !record && !refused ? (
          <p className={styles.muted}>Opening the record…</p>
        ) : null}
        {!canWrite && record ? (
          <p className={styles.muted}>Consultations are written from a consulting room.</p>
        ) : null}
        {record && id && patient ? (
          <ConsultationsSection
            client={client}
            staffId={staff.id}
            patientId={id}
            patientName={patient.full_name}
            record={record}
            reload={reload}
            canWrite={canWrite}
            me={staff.room ? `${staff.full_name} · ${staff.room.name}` : staff.full_name}
            canPrescribe={actsAsDoctor(staff)}
            canRequestLab={staff.can_medical}
            fullPage
          />
        ) : null}
      </div>
    </AppShell>
  )
}

export default function ConsultPage() {
  return (
    <Suspense fallback={null}>
      <Consult />
    </Suspense>
  )
}
