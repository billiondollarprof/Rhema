/*
 * record/_parts/Background.tsx: the facts about a patient that change
 * slowly: allergies, conditions, blood group and genotype, and for a woman
 * the pregnancy facts.
 *
 * Why: the demo's "Medical history" tab. These are the things a nurse or
 * doctor checks before giving anything, so they sit beside the medicines.
 *
 * Sections in this file:
 *   1. Allergies: the list, and Add an allergy (with "severe").
 *   2. Conditions: the list, Mark resolved or Active again, Add a condition.
 *   3. Profile: blood group, genotype, "no known allergies", and for a
 *      female patient the last period, gravida and para.
 *
 * Never: tick "no known allergies" while an allergy is on the list. The
 * box is hidden then, so the record cannot say both.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import {
  addLine,
  saveProfile,
  setConditionStatus,
  when,
  type MedicalRecord,
} from '@/lib/record/record'

type Props = {
  client: SupabaseClient
  staffId: string
  patientId: number
  record: MedicalRecord
  reload: () => void
}

const voidedOf = (line: {
  voided_at: string | null
  void_reason: string | null
  voider: { full_name: string } | null
}) => (line.voided_at ? { reason: line.void_reason, by: line.voider?.full_name ?? null } : null)

// ===== 1. Allergies =====
export function AllergiesSection({ client, staffId, patientId, record, reload }: Props) {
  const [adding, setAdding] = useState(false)
  const [allergen, setAllergen] = useState('')
  const [reaction, setReaction] = useState('')
  const [severe, setSevere] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function add() {
    if (allergen.trim().length < 2) {
      setProblem('Type what the patient is allergic to.')
      return
    }
    const result = await addLine(client, 'allergies', {
      patient_id: patientId,
      allergen: allergen.trim(),
      reaction: reaction.trim() || null,
      severe,
      recorded_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setAdding(false)
      setAllergen('')
      setReaction('')
      setSevere(false)
      setProblem(null)
      reload()
    }
  }

  return (
    <Section title="Allergies" count={record.allergies.filter((a) => !a.voided_at).length} open>
      {record.allergies.length === 0 ? <EmptyLine text="No allergies recorded." /> : null}
      {record.allergies.map((line) => (
        <Line
          key={line.id}
          what={
            <>
              <b>{line.allergen}</b>
              {line.reaction ? (
                <>
                  <br />
                  <span className={styles.muted}>{line.reaction}</span>
                </>
              ) : null}
            </>
          }
          status={
            line.severe ? <span className={`${styles.pill} ${styles.red}`}>Severe</span> : null
          }
          meta={`Recorded by ${line.recorder?.full_name ?? 'staff'}, ${when(line.created_at)}`}
          voided={voidedOf(line)}
          voidable={{ client, table: 'allergies', id: line.id, staffId, onDone: reload }}
        />
      ))}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="allergy-name">Allergic to</label>
              <input
                id="allergy-name"
                className={styles.input}
                placeholder="e.g. Penicillin"
                value={allergen}
                onChange={(e) => setAllergen(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="allergy-reaction">Reaction</label>
              <input
                id="allergy-reaction"
                className={styles.input}
                placeholder="e.g. Rash"
                value={reaction}
                onChange={(e) => setReaction(e.target.value)}
              />
            </div>
          </div>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={severe} onChange={(e) => setSevere(e.target.checked)} />
            Severe reaction
          </label>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Add allergy
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Add an allergy
          </button>
        </div>
      )}
    </Section>
  )
}

// ===== 2. Conditions =====
export function ConditionsSection({ client, staffId, patientId, record, reload }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  async function add() {
    if (name.trim().length < 2) {
      setProblem('Type the condition.')
      return
    }
    const result = await addLine(client, 'conditions', {
      patient_id: patientId,
      name: name.trim(),
      recorded_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setAdding(false)
      setName('')
      setProblem(null)
      reload()
    }
  }

  async function flip(id: number, status: 'active' | 'resolved') {
    const result = await setConditionStatus(client, id, status)
    if (result) setProblem(result)
    else reload()
  }

  // Active first, then resolved, voided last.
  const rank = (c: MedicalRecord['conditions'][number]) =>
    c.voided_at ? 2 : c.status === 'active' ? 0 : 1
  const sorted = [...record.conditions].sort((a, b) => rank(a) - rank(b))

  return (
    <Section
      title="Conditions"
      count={record.conditions.filter((c) => !c.voided_at && c.status === 'active').length}
    >
      {sorted.length === 0 ? <EmptyLine text="No conditions recorded." /> : null}
      {sorted.map((line) => (
        <Line
          key={line.id}
          what={<b>{line.name}</b>}
          status={
            line.status === 'active' ? (
              <span className={`${styles.pill} ${styles.orange}`}>Active</span>
            ) : (
              <span className={`${styles.pill} ${styles.green}`}>Resolved</span>
            )
          }
          meta={`Recorded by ${line.recorder?.full_name ?? 'staff'}, ${when(line.created_at)}`}
          voided={voidedOf(line)}
          voidable={{ client, table: 'conditions', id: line.id, staffId, onDone: reload }}
          actions={
            <button
              className={styles.small}
              onClick={() => flip(line.id, line.status === 'active' ? 'resolved' : 'active')}
            >
              {line.status === 'active' ? 'Mark resolved' : 'Active again'}
            </button>
          }
        />
      ))}
      {!adding && problem ? <p className={styles.error}>{problem}</p> : null}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="condition-name">Condition</label>
            <input
              id="condition-name"
              className={styles.input}
              placeholder="e.g. Hypertension"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Add condition
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Add a condition
          </button>
        </div>
      )}
    </Section>
  )
}

// ===== 3. Profile =====
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENOTYPES = ['AA', 'AS', 'SS', 'AC', 'SC', 'CC']

export function ProfileSection({
  client,
  staffId,
  patientId,
  record,
  reload,
  female,
}: Props & { female: boolean }) {
  const saved = record.profile
  const hasAllergy = record.allergies.some((a) => !a.voided_at)
  const [editing, setEditing] = useState(false)
  const [bloodGroup, setBloodGroup] = useState(saved?.blood_group ?? '')
  const [genotype, setGenotype] = useState(saved?.genotype ?? '')
  const [noAllergies, setNoAllergies] = useState(saved?.no_known_allergies ?? false)
  const [lmp, setLmp] = useState(saved?.last_menstrual_period ?? '')
  const [gravida, setGravida] = useState(saved?.gravida?.toString() ?? '')
  const [para, setPara] = useState(saved?.para?.toString() ?? '')
  const [problem, setProblem] = useState<string | null>(null)

  async function save() {
    const result = await saveProfile(
      client,
      {
        blood_group: bloodGroup || null,
        genotype: genotype || null,
        no_known_allergies: hasAllergy ? false : noAllergies,
        last_menstrual_period: female && lmp ? lmp : null,
        gravida: female && gravida !== '' ? Number(gravida) : null,
        para: female && para !== '' ? Number(para) : null,
      },
      patientId,
      staffId,
      Boolean(saved),
    )
    if (result) setProblem(result)
    else {
      setEditing(false)
      setProblem(null)
      reload()
    }
  }

  const facts: [string, string][] = [
    ['Blood group', saved?.blood_group ?? 'Not recorded'],
    ['Genotype', saved?.genotype ?? 'Not recorded'],
  ]
  if (female) {
    facts.push(
      [
        'Last period',
        saved?.last_menstrual_period
          ? new Date(`${saved.last_menstrual_period}T00:00:00`).toLocaleDateString('en-GB')
          : 'Not recorded',
      ],
      [
        'Gravida / para',
        saved?.gravida !== null && saved?.gravida !== undefined
          ? `G${saved.gravida} P${saved.para ?? 0}`
          : 'Not recorded',
      ],
    )
  }

  return (
    <Section title="Blood group and profile" open>
      <dl className={styles.readings}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {editing ? (
        <div className={styles.form}>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="blood-group">Blood group</label>
              <select
                id="blood-group"
                className={styles.input}
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
              >
                <option value="">Not recorded</option>
                {BLOOD_GROUPS.map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="genotype">Genotype</label>
              <select
                id="genotype"
                className={styles.input}
                value={genotype}
                onChange={(e) => setGenotype(e.target.value)}
              >
                <option value="">Not recorded</option>
                {GENOTYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            {female ? (
              <>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="lmp">Last period (first day)</label>
                  <input
                    id="lmp"
                    className={styles.input}
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={lmp}
                    onChange={(e) => setLmp(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="gravida">Gravida (pregnancies)</label>
                  <input
                    id="gravida"
                    className={styles.input}
                    inputMode="numeric"
                    value={gravida}
                    onChange={(e) => setGravida(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="para">Para (births)</label>
                  <input
                    id="para"
                    className={styles.input}
                    inputMode="numeric"
                    value={para}
                    onChange={(e) => setPara(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </>
            ) : null}
          </div>
          {hasAllergy ? null : (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={noAllergies}
                onChange={(e) => setNoAllergies(e.target.checked)}
              />
              No known allergies (asked and confirmed)
            </label>
          )}
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={save}>
              Save
            </button>
            <button className={styles.small} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}
    </Section>
  )
}
