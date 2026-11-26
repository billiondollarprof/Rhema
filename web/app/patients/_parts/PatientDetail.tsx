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
 * Take vitals (request 228c, 2026-11-19): the Front Desk takes vital signs
 * here, and they go into the medical record for the doctor and nurses.
 *
 * Drugs to give (request 233, 2026-11-20): the Pharmacy sees this patient's
 * drugs still to give, paid or not, and dispenses them here.
 *
 * Never: show the medical record here. It gets its own page, open only to
 * doctors, nurses and the matron, and every opening is logged. This card
 * only shows the "Medical record" button to staff with that access.
 */
'use client'

import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FamilyCard from './FamilyCard'
import PharmacyMedicines from './PharmacyMedicines'
import PaymentsCard from './PaymentsCard'
import LabCard from '@/components/work/LabCard'
import BillsCard from '@/components/work/BillsCard'
import StayCard from './StayCard'
import { canDischarge, loadStay, type Stay } from '@/lib/stay/stay'
import { loadStatement, type Statement } from '@/lib/bills/bills'
import PharmacyCard from '@/components/work/PharmacyCard'
import type { StaffMember } from '@/lib/auth/session'
import SendToRoom from './SendToRoom'
import TakeVitals from './TakeVitals'
import PersonBadge from '@/components/auth/PersonBadge'
import Icon from '@/components/shell/Icon'
import styles from './patients.module.css'
import { ageFrom } from '@/lib/patients/age'
import StayPill from '@/components/stay/StayPill'
import {
  firstRegisteredWords,
  loadAntenatalDetails,
  sexWords,
  type PatientResult,
} from '@/lib/patients/patients'
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
  // The person signed in, for the Waiting for payment cards (request 227k).
  staff?: StaffMember
  canRegister: boolean
  // The Pharmacy sees the medicines this patient has taken (2026-11-12).
  showMedicines: boolean
  patient: PatientResult
  onChanged: () => void
}

export function lastSeenWords(isoTime: string | null): string {
  if (!isoTime) return 'Not seen yet'
  return new Date(isoTime).toLocaleDateString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// "10:42", for the Today list.
function clock(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PatientDetail({
  client,
  staffId,
  canMedical,
  canPay,
  staff,
  canRegister,
  showMedicines,
  patient,
  onChanged,
}: DetailProps) {
  const [sending, setSending] = useState(false)
  // Take vitals is open (the Front Desk only, request 228c).
  const [takingVitals, setTakingVitals] = useState(false)
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

  // ===== 0a. The stay: Inpatient or Outpatient (request 240, 2026-11-23).
  // The doctor or matron also reads the bill statement, to be offered
  // Discharge once the bill is paid. =====
  const [stay, setStay] = useState<Stay | null | undefined>(undefined)
  const [statement, setStatement] = useState<Statement | null>(null)
  const [stayRound, setStayRound] = useState(0)
  useEffect(() => {
    let current = true
    void loadStay(client, patient.id).then(async (found) => {
      if (!current || found === undefined) return
      setStay(found)
      if (found && staff && canDischarge(staff)) {
        const read = await loadStatement(client, patient.id)
        if (current) setStatement(read)
      } else setStatement(null)
    })
    return () => {
      current = false
    }
  }, [client, patient.id, staff, stayRound])

  // ===== 0. The antenatal card's details, from the antenatal booking
  // (request 227g): read for an antenatal patient only =====
  const [antenatal, setAntenatal] = useState<Partial<PatientResult>>({})
  useEffect(() => {
    if (patient.category !== 'antenatal') return
    let current = true
    void loadAntenatalDetails(client, patient.id).then((found) => {
      if (current) setAntenatal(found)
    })
    return () => {
      current = false
    }
  }, [client, patient.id, patient.category])
  const card = { ...patient, ...antenatal }

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
        // When the patient first registered (request 211): the month from the
        // old file, or the day they were added here.
        ['First registered', firstRegisteredWords(patient)],
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
        // The antenatal card's details of the next of kin (request 227g).
        ...((patient.category === 'antenatal'
          ? [
              ['Occupation', card.next_of_kin_occupation ?? 'Not given'],
              ['Religion', card.next_of_kin_religion ?? 'Not given'],
              ['Level of education', card.next_of_kin_education_level ?? 'Not given'],
              [
                'Age',
                card.next_of_kin_age !== null && card.next_of_kin_age !== undefined
                  ? `${card.next_of_kin_age} years`
                  : 'Not given',
              ],
            ]
          : []) as [string, string][]),
      ],
    },
    // The antenatal card's details of the patient (request 227g).
    ...(patient.category === 'antenatal'
      ? [
          {
            title: 'Antenatal details',
            facts: [
              ['Marital status', card.marital_status ?? 'Not given'],
              ['Religion', card.religion ?? 'Not given'],
              ['Level of education', card.education_level ?? 'Not given'],
              ['Occupation', card.occupation ?? 'Not given'],
            ] as [string, string][],
          },
        ]
      : []),
  ]

  const where = patient.open_visit
    ? `${STATUS_LABELS[patient.open_visit.status as QueueStatus] ?? patient.open_visit.status} · ${patient.open_visit.room}`
    : null

  return (
    <section className={styles.card} aria-label="Patient">
      <div className={styles.head}>
        <PersonBadge name={patient.full_name} />
        <div className={styles.headName}>
          <h2>
            {patient.full_name}
            <StayPill client={client} patientId={patient.id} />
          </h2>
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

      {/* The Pharmacy: what this patient has taken, current, suspended or stopped. */}
      {showMedicines ? (
        <PharmacyMedicines client={client} staffId={staffId} patientId={patient.id} />
      ) : null}

      {/* Waiting for payment (request 227k): every drug and lab test of this
          patient not paid yet, sent to the Front Desk or not. Hidden when
          nothing is waiting. */}
      {canPay && staff ? (
        <>
          <PharmacyCard client={client} staff={staff} patientId={patient.id} />
          <LabCard client={client} staff={staff} patientId={patient.id} />
        </>
      ) : null}

      {/* Bills from a doctor or the matron (request 235, part 3): every
          member of staff sees them ("let everyone see the bill"); the Front
          Desk takes payment here. Hidden when there is none. */}
      {staff ? <BillsCard client={client} staff={staff} patientId={patient.id} /> : null}

      {/* Drugs to give (request 233, 2026-11-20): the Pharmacy finds a
          patient's drugs, paid or not, even one sent to the Front Desk only,
          and dispenses them here. */}
      {!canPay && staff?.role === 'pharmacy' ? (
        <PharmacyCard client={client} staff={staff} patientId={patient.id} />
      ) : null}

      {/* Inpatient or Outpatient, Admit and Discharge (request 240). */}
      {staff ? (
        <StayCard
          client={client}
          staff={staff}
          patientId={patient.id}
          stay={stay}
          statement={statement}
          onChanged={() => setStayRound((n) => n + 1)}
        />
      ) : null}

      {/* The family: its number, the other members, Add family member. */}
      <FamilyCard client={client} patient={patient} canAdd={canRegister} />

      {/* Payments and receipts, for the Front Desk and admins. */}
      {canPay ? (
        <PaymentsCard
          client={client}
          patientId={patient.id}
          staffId={staffId}
          category={patient.category}
          inpatient={Boolean(stay)}
        />
      ) : null}

      {/* ===== 2. What can be done from here ===== */}
      {takingVitals ? (
        <TakeVitals
          client={client}
          staffId={staffId}
          patientId={patient.id}
          patientName={patient.full_name}
          onClose={() => setTakingVitals(false)}
        />
      ) : sending ? (
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
          {/* The Front Desk takes vital signs for the medical record (request 228c). */}
          {canRegister ? (
            <button
              className={styles.button}
              onClick={() => {
                setSentTo(null)
                setTakingVitals(true)
              }}
            >
              Take vitals
            </button>
          ) : null}
        </div>
      )}
      {leaveProblem ? <p className={styles.error}>{leaveProblem}</p> : null}
    </section>
  )
}
