/*
 * app/patients/_parts/FamilyCard.tsx: the family on a patient's profile
 * (request 128, step 2): the family card number, the other members (tap
 * one to open them), and Add family member.
 *
 * Why: Anthony, 2026-11-02: "Anybody from the family can make the family
 * profile pop up." The family number (FAM-000012) is on the card; each
 * member keeps their own RMC number.
 *
 * Never: show anything but name, number and age here.
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './patients.module.css'
import PersonBadge from '@/components/auth/PersonBadge'
import Icon from '@/components/shell/Icon'
import { ageFrom } from '@/lib/patients/age'
import {
  familyMembers,
  startFamily,
  type PatientCard,
  type PatientResult,
} from '@/lib/patients/patients'

export default function FamilyCard({
  client,
  patient,
}: {
  client: SupabaseClient
  patient: PatientResult
}) {
  const router = useRouter()
  const [members, setMembers] = useState<PatientCard[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!patient.family_id) return
    let current = true
    familyMembers(client, patient.family_id).then((found) => {
      if (current) setMembers(found.filter((member) => member.id !== patient.id))
    })
    return () => {
      current = false
    }
  }, [client, patient.family_id, patient.id])

  // Only for a family patient, or one already in a family.
  if (patient.category !== 'family' && !patient.family_id) return null

  async function addMember() {
    setBusy(true)
    setProblem(null)
    const family = await startFamily(client, patient.id)
    setBusy(false)
    if (!family) setProblem('The family could not be started. Check the network and try again.')
    else router.push(`/patients/register/?family=${family}`)
  }

  return (
    <div className={styles.factGroup}>
      <h3>Family{patient.family ? ` · ${patient.family.family_number}` : ''}</h3>
      {members.length > 0 ? (
        <ul className={styles.familyList}>
          {members.map((member) => (
            <li key={member.id}>
              <Link href={`/patients/?p=${member.id}`}>
                <PersonBadge name={member.full_name} />
                <span>
                  <b>{member.full_name}</b>
                  <small>
                    {member.patient_number} · {ageFrom(member.date_of_birth)}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.buttons}>
        <button
          className={`${styles.button} ${styles.familyButton}`}
          onClick={addMember}
          disabled={busy}
        >
          <Icon name="users" size={16} /> {busy ? 'Starting…' : 'Add family member'}
        </button>
      </div>
    </div>
  )
}
