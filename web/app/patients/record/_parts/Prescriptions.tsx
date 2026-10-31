/*
 * record/_parts/Prescriptions.tsx: the prescriptions in the patient's
 * record, newest first, with where each one is now (request 123).
 *
 * Why: the doctor sees at a glance what was prescribed, whether it was
 * paid, and when it was dispensed. Once dispensed, the drugs also appear in
 * Current medications (the database adds them).
 *
 * Never: let this list change anything. Prescribing happens on its own
 * screen; paying and dispensing happen on Home.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import {
  STATUS_WORDS,
  itemWords,
  loadPatientPrescriptions,
  type Prescription,
} from '@/lib/pharmacy/pharmacy'
import { when } from '@/lib/record/record'

export default function PrescriptionsSection({
  client,
  patientId,
}: {
  client: SupabaseClient
  patientId: number
}) {
  const [list, setList] = useState<Prescription[] | null>(null)

  useEffect(() => {
    let current = true
    loadPatientPrescriptions(client, patientId).then((found) => {
      if (current) setList(found)
    })
    return () => {
      current = false
    }
  }, [client, patientId])

  // Open by itself while a prescription is still on its way.
  const waiting = Boolean(
    list?.some((one) => one.status !== 'dispensed' && one.status !== 'voided'),
  )

  return (
    <Section
      key={waiting ? 'open' : 'shut'}
      title="Prescriptions"
      count={list?.length}
      open={waiting}
    >
      {list === null ? <EmptyLine text="Loading…" /> : null}
      {list && list.length === 0 ? <EmptyLine text="No prescriptions yet." /> : null}
      {(list ?? []).map((prescription) => (
        <Line
          key={prescription.id}
          what={<b>{prescription.items.map((item) => item.drug).join(', ')}</b>}
          status={
            <span
              className={`${styles.pill} ${prescription.status === 'dispensed' ? styles.green : styles.orange}`}
            >
              {STATUS_WORDS[prescription.status]}
            </span>
          }
          meta={`By ${prescription.prescriber?.full_name ?? 'the doctor'} · ${when(prescription.prescribed_at)}${
            prescription.dispensed_at ? ` · dispensed ${when(prescription.dispensed_at)}` : ''
          }`}
          voided={null}
        >
          {prescription.items.map((item, at) => (
            <p key={item.id ?? at} className={styles.resultText}>
              {itemWords(item)}
              {item.note ? ` (${item.note})` : ''}
            </p>
          ))}
        </Line>
      ))}
    </Section>
  )
}
