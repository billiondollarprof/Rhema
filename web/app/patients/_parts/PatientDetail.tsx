/*
 * app/patients/_parts/PatientDetail.tsx: one patient's registration card,
 * with Edit and Send to room.
 *
 * Why: the demo's patient detail. It shows the number, age (worked out
 * from the date of birth), category, where the patient is now, when they
 * were last seen, contact and next of kin.
 *
 * Never: show the medical record here. It gets its own page, open only to
 * doctors, nurses and the matron, and every opening is logged.
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import SendToRoom from './SendToRoom'
import PersonBadge from '@/components/auth/PersonBadge'
import styles from './patients.module.css'
import { ageFrom } from '@/lib/patients/age'
import type { PatientResult } from '@/lib/patients/patients'
import { CATEGORY_LABELS, STATUS_LABELS, type QueueStatus } from '@/lib/queue/queue'

type DetailProps = {
  client: SupabaseClient
  staffId: string
  patient: PatientResult
  onChanged: () => void
}

export function lastSeenWords(isoTime: string | null): string {
  if (!isoTime) return 'Not seen yet'
  return new Date(isoTime).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PatientDetail({ client, staffId, patient, onChanged }: DetailProps) {
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  // ===== 1. The facts, in the order the front desk asks for them =====
  const facts: [string, string][] = [
    ['Patient number', patient.patient_number],
    ['Age', ageFrom(patient.date_of_birth)],
    ['Date of birth', new Date(`${patient.date_of_birth}T00:00:00`).toLocaleDateString('en-GB')],
    ['Sex', patient.sex === 'female' ? 'Female' : 'Male'],
    ['Category', CATEGORY_LABELS[patient.category] ?? patient.category],
    ['Last seen', lastSeenWords(patient.last_seen)],
    ['Phone / WhatsApp', patient.phone ?? 'Not given'],
    ['Email', patient.email ?? 'Not given'],
    [
      'Address',
      [patient.address, patient.town, patient.lga, patient.state].filter(Boolean).join(', ') ||
        'Not given',
    ],
    ['Next of kin', patient.next_of_kin_name ?? 'Not given'],
    ['Relationship', patient.next_of_kin_relationship ?? 'Not given'],
    ['Next of kin phone', patient.next_of_kin_phone ?? 'Not given'],
  ]

  const where = patient.open_visit
    ? `${STATUS_LABELS[patient.open_visit.status as QueueStatus] ?? patient.open_visit.status} · ${patient.open_visit.room}`
    : null

  return (
    <section className={styles.card} aria-label="Patient">
      <div className={styles.head}>
        <PersonBadge name={patient.full_name} />
        <h2>{patient.full_name}</h2>
        {where ? <span className={`${styles.tag} ${styles.tagBusy}`}>{where}</span> : null}
      </div>

      {sentTo ? (
        <div className={styles.ok}>
          <b>Sent to {sentTo}</b>
        </div>
      ) : null}

      <dl className={styles.facts}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {/* ===== 2. What can be done from here ===== */}
      {sending ? (
        <SendToRoom
          client={client}
          staffId={staffId}
          patientId={patient.id}
          patientName={patient.full_name}
          onCancel={() => setSending(false)}
          onSent={(room) => {
            setSending(false)
            setSentTo(room)
            onChanged()
          }}
        />
      ) : (
        <div className={styles.buttons}>
          <button
            className={`${styles.button} ${styles.primary}`}
            disabled={Boolean(patient.open_visit)}
            onClick={() => {
              setSentTo(null)
              setSending(true)
            }}
          >
            Send to room
          </button>
          <Link className={styles.button} href={`/patients/edit/?p=${patient.id}`}>
            Edit details
          </Link>
        </div>
      )}
      {patient.open_visit && !sending ? (
        <p className={styles.muted}>
          This patient is already in a room. They can be sent again once that visit is finished.
        </p>
      ) : null}
    </section>
  )
}
