/*
 * app/patients/_parts/FamilyCard.tsx: the family on a patient's profile
 * (request 128, step 2): the family card number, the other members (tap
 * one to open them), and Add family member.
 *
 * Why: Anthony, 2026-11-02: "Anybody from the family can make the family
 * profile pop up." The family number (FAM-000012) is on the card; each
 * member keeps their own RMC number.
 *
 * The family file (request 228b, 2026-11-20): the family's own name,
 * phone, address and the day it was registered, and Edit family details
 * for the Front Desk ("There should be a way to edit the family address").
 *
 * Never: show anything about a member but name, number and age here.
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
import FamilyDetailsForm, { checkFamily, tidyFamily } from './FamilyDetailsForm'
import {
  familyMembers,
  loadFamily,
  startFamily,
  updateFamily,
  type Family,
  type FamilyDetails,
  type PatientCard,
  type PatientResult,
} from '@/lib/patients/patients'

export default function FamilyCard({
  client,
  patient,
  canAdd,
}: {
  client: SupabaseClient
  patient: PatientResult
  // Adding a member registers a patient: the Front Desk only.
  canAdd: boolean
}) {
  const router = useRouter()
  const [members, setMembers] = useState<PatientCard[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The family's own details, and Edit family details (request 228b).
  const [family, setFamily] = useState<Family | null>(null)
  const [editing, setEditing] = useState<FamilyDetails | null>(null)
  const [editShown, setEditShown] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!patient.family_id) return
    let current = true
    loadFamily(client, patient.family_id).then((found) => {
      if (current) setFamily(found)
    })
    return () => {
      current = false
    }
  }, [client, patient.family_id])

  async function saveFamily() {
    if (!editing || !family) return
    const wrong = checkFamily(editing)
    setEditShown(wrong)
    if (Object.keys(wrong).length > 0) return
    setSaving(true)
    const ready = tidyFamily(editing)
    const failed = await updateFamily(client, family.id, ready)
    setSaving(false)
    if (failed) {
      setProblem(failed)
      return
    }
    setFamily({ ...family, ...ready })
    setEditing(null)
    setProblem(null)
  }

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
      <h3>
        {family?.name ? `${family.name} family` : 'Family'}
        {patient.family ? ` · ${patient.family.family_number}` : ''}
      </h3>
      {/* The family's own details (request 228b). */}
      {family && !editing ? (
        <dl className={styles.facts}>
          <div>
            <dt>Family name</dt>
            <dd>{family.name ?? 'Not given'}</dd>
          </div>
          <div>
            <dt>Family phone</dt>
            <dd>{family.phone ?? 'Not given'}</dd>
          </div>
          <div>
            <dt>Family address</dt>
            <dd>
              {[family.address, family.town, family.lga, family.state].filter(Boolean).join(', ') ||
                'Not given'}
            </dd>
          </div>
          <div>
            <dt>Registered</dt>
            <dd>
              {new Date(family.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </dd>
          </div>
        </dl>
      ) : null}
      {editing ? (
        <>
          <FamilyDetailsForm
            value={editing}
            onChange={(next) => {
              setEditing(next)
              setEditShown({})
            }}
            shown={editShown}
          />
          <div className={styles.buttons}>
            <button
              className={`${styles.button} ${styles.primary}`}
              disabled={saving}
              onClick={saveFamily}
            >
              {saving ? 'Saving…' : 'Save family details'}
            </button>
            <button
              className={styles.button}
              disabled={saving}
              onClick={() => {
                setEditing(null)
                setEditShown({})
                setProblem(null)
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}
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
      {canAdd && !editing ? (
        <div className={styles.buttons}>
          <button
            className={`${styles.button} ${styles.familyButton}`}
            onClick={addMember}
            disabled={busy}
          >
            <Icon name="users" size={16} /> {busy ? 'Starting…' : 'Add family member'}
          </button>
          {/* The Front Desk edits the family's name, phone and address. */}
          {family ? (
            <button
              className={styles.button}
              onClick={() =>
                setEditing({
                  name: family.name ?? '',
                  phone: family.phone,
                  address: family.address,
                  town: family.town,
                  lga: family.lga,
                  state: family.state,
                  country: family.country,
                })
              }
            >
              Edit family details
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
