/*
 * app/patients/_parts/PatientDetail.tsx: one patient's registration card,
 * with Edit and Send to room.
 *
 * Why: the demo's patient detail. It shows the number, age (worked out
 * from the date of birth), category, where the patient is now, when they
 * were last seen, contact and next of kin.
 *
 * The facts are in three small groups (the patient, how to reach them,
 * next of kin), so on a wide screen they line up in tidy rows.
 *
 * Never: show the medical record here. It gets its own page, open only to
 * doctors, nurses and the matron, and every opening is logged. This card
 * only shows the "Medical record" button to staff with that access.
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import SendToRoom from './SendToRoom'
import PersonBadge from '@/components/auth/PersonBadge'
import Icon from '@/components/shell/Icon'
import styles from './patients.module.css'
import { ageFrom } from '@/lib/patients/age'
import { sexWords, type PatientResult } from '@/lib/patients/patients'
import { CATEGORY_LABELS, STATUS_LABELS, type QueueStatus } from '@/lib/queue/queue'

type DetailProps = {
  client: SupabaseClient
  staffId: string
  canMedical: boolean
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

export default function PatientDetail({
  client,
  staffId,
  canMedical,
  patient,
  onChanged,
}: DetailProps) {
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  // ===== 1. The facts, in the order the front desk asks for them =====
  const groups: { title: string; facts: [string, string][] }[] = [
    {
      title: 'Patient',
      facts: [
        ['Patient number', patient.patient_number],
        ['Age', ageFrom(patient.date_of_birth)],
        [
          'Date of birth',
          patient.date_of_birth
            ? new Date(`${patient.date_of_birth}T00:00:00`).toLocaleDateString('en-GB')
            : 'Not recorded',
        ],
        ['Sex', sexWords(patient.sex)],
        ['Category', CATEGORY_LABELS[patient.category] ?? patient.category],
        ['Last seen', lastSeenWords(patient.last_seen)],
      ],
    },
    {
      title: 'Contact',
      facts: [
        ['Phone / WhatsApp', patient.phone ?? 'Not given'],
        ['Email', patient.email ?? 'Not given'],
        [
          'Address',
          [patient.address, patient.town, patient.lga, patient.state].filter(Boolean).join(', ') ||
            'Not given',
        ],
      ],
    },
    {
      title: 'Next of kin',
      facts: [
        ['Name', patient.next_of_kin_name ?? 'Not given'],
        ['Relationship', patient.next_of_kin_relationship ?? 'Not given'],
        ['Phone', patient.next_of_kin_phone ?? 'Not given'],
      ],
    },
  ]

  const where = patient.open_visit
    ? `${STATUS_LABELS[patient.open_visit.status as QueueStatus] ?? patient.open_visit.status} · ${patient.open_visit.room}`
    : null

  return (
    <section className={styles.card} aria-label="Patient">
      <div className={styles.head}>
        <PersonBadge name={patient.full_name} />
        <div className={styles.headName}>
          <h2>{patient.full_name}</h2>
          {patient.from_old_file ? (
            <span className={styles.oldFileMark}>
              <Icon name="file" size={13} /> From old file
            </span>
          ) : null}
        </div>
        {where ? <span className={`${styles.tag} ${styles.tagBusy}`}>{where}</span> : null}
      </div>

      {sentTo ? (
        <div className={styles.ok}>
          <b>Sent to {sentTo}</b>
        </div>
      ) : null}

      {groups.map((group) => (
        <div key={group.title} className={styles.factGroup}>
          <h3>{group.title}</h3>
          <dl className={styles.facts}>
            {group.facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

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
          {canMedical ? (
            <Link className={styles.button} href={`/patients/record/?p=${patient.id}`}>
              Medical record
            </Link>
          ) : null}
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
