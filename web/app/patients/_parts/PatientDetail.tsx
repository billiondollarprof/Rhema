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
 * Visits (requests 140 and 147, 2026-11-04): a patient already in a room
 * can be moved to another one; the Front Desk and admins can mark that
 * the patient has left; and Today lists where the patient has been, from
 * when to when, and how each visit ended.
 *
 * Never: show the medical record here. It gets its own page, open only to
 * doctors, nurses and the matron, and every opening is logged. This card
 * only shows the "Medical record" button to staff with that access.
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FamilyCard from './FamilyCard'
import PaymentsCard from './PaymentsCard'
import SendToRoom from './SendToRoom'
import PersonBadge from '@/components/auth/PersonBadge'
import Icon from '@/components/shell/Icon'
import styles from './patients.module.css'
import { ageFrom } from '@/lib/patients/age'
import { sexWords, type PatientResult } from '@/lib/patients/patients'
import {
  CATEGORY_LABELS,
  FINISH_WORDS,
  STATUS_LABELS,
  markLeft,
  type QueueStatus,
} from '@/lib/queue/queue'

type DetailProps = {
  client: SupabaseClient
  staffId: string
  canMedical: boolean
  canPay: boolean
  canRegister: boolean
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

// "10:42", for the Today list.
function clock(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function PatientDetail({
  client,
  staffId,
  canMedical,
  canPay,
  canRegister,
  patient,
  onChanged,
}: DetailProps) {
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [leaveProblem, setLeaveProblem] = useState<string | null>(null)

  // Has left: ends the visit the patient is in now, with the time.
  async function hasLeft() {
    if (!patient.open_visit) return
    setLeaving(true)
    setLeaveProblem(null)
    const problem = await markLeft(client, patient.open_visit.id)
    setLeaving(false)
    if (problem) setLeaveProblem(problem)
    else {
      setSentTo(null)
      onChanged()
    }
  }

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

      {/* ===== Today: where the patient has been ===== */}
      {patient.today.length ? (
        <div className={styles.factGroup}>
          <h3>Today</h3>
          <ol className={styles.trail}>
            {patient.today.map((visit) => (
              <li key={visit.from}>
                <b>{visit.room}</b>
                <span>
                  {clock(visit.from)}
                  {visit.to ? ` to ${clock(visit.to)}` : ' · here now'}
                  {visit.reason ? ` · ${FINISH_WORDS[visit.reason] ?? ''}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* The family: its number, the other members, Add family member. */}
      <FamilyCard client={client} patient={patient} canAdd={canRegister} />

      {/* Payments and receipts, for the Front Desk and admins. */}
      {canPay ? <PaymentsCard client={client} patientId={patient.id} /> : null}

      {/* ===== 2. What can be done from here ===== */}
      {sending ? (
        <SendToRoom
          client={client}
          staffId={staffId}
          patientId={patient.id}
          patientName={patient.full_name}
          openVisit={patient.open_visit}
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
            onClick={() => {
              setSentTo(null)
              setSending(true)
            }}
          >
            {patient.open_visit ? 'Move to another room' : 'Send to room'}
          </button>
          {patient.open_visit && canPay ? (
            <button className={styles.button} disabled={leaving} onClick={hasLeft}>
              {leaving ? 'Saving…' : 'Has left'}
            </button>
          ) : null}
          {canMedical ? (
            <Link className={styles.button} href={`/patients/record/?p=${patient.id}`}>
              Medical record
            </Link>
          ) : null}
          {canRegister ? (
            <Link className={styles.button} href={`/patients/edit/?p=${patient.id}`}>
              Edit details
            </Link>
          ) : null}
        </div>
      )}
      {leaveProblem ? <p className={styles.error}>{leaveProblem}</p> : null}
    </section>
  )
}
