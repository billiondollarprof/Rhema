/*
 * record/_parts/Consultation.tsx: the doctor's consultation note.
 *
 * Why: the director, 2026-11-16 (request 217c, Anthony's yes 218b): "there
 * is no proper place where I can write my medical findings... symptoms,
 * examination findings, then diagnosis, then treatment plan... so that when
 * I forward it to the nurses... they will follow the treatment plan."
 *
 * How it goes for the doctor:
 *   1. In a consulting room the note sits open at the top of the record.
 *   2. Four boxes in the order a doctor thinks: Symptoms and history,
 *      Examination findings, Diagnosis, Treatment plan. Under each box are
 *      the common words to tap (lib/record/phrases.ts), the first 8 with
 *      More for the rest; typing still works.
 *   3. Medicines for the chart: choose the medicine, the dose and how often,
 *      once. They go onto the medication chart when the note is saved, so a
 *      nurse never picks them again.
 *   4. Save. Then "Send to the nurses" moves the patient to a nursing room;
 *      the nurses see the treatment plan at the top of the record.
 *
 * The four boxes are the same four the database always had (complaint,
 * findings, assessment, plan), so old notes read with the new names.
 *
 * Who writes: whoever has a consulting room, a doctor, nurse or matron
 * (Anthony, 2026-11-10). Everybody with the record reads. The database
 * decides it again.
 *
 * Never: change a saved note. A wrong one is voided with a reason and
 * written again, so the record shows what was corrected.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import SendToRoom from '../../_parts/SendToRoom'
import MedicinePicker from '@/components/medicines/MedicinePicker'
import OptionSelect from '@/components/options/OptionSelect'
import { medicineWords } from '@/lib/medicines/medicines'
import { addPhrase, NOTE_PARTS, PHRASES } from '@/lib/record/phrases'
import { addLine, when, type MedicalRecord } from '@/lib/record/record'

type Props = {
  client: SupabaseClient
  staffId: string
  patientId: number
  patientName: string
  record: MedicalRecord
  reload: () => void
  canWrite: boolean
}

// A medicine the doctor charts with the note.
type NewMedicine = { name: string; strength: string; dose: string; howOften: string }

const voidedOf = (line: {
  voided_at: string | null
  void_reason: string | null
  voider: { full_name: string } | null
}) => (line.voided_at ? { reason: line.void_reason, by: line.voider?.full_name ?? null } : null)

// ===== 1. The patient's visit now, for Send to the nurses =====
async function openVisitOf(
  client: SupabaseClient,
  patientId: number,
): Promise<{ id: number; room: string } | null> {
  const { data } = await client
    .from('queue_entries')
    .select('id, room:rooms(name)')
    .eq('patient_id', patientId)
    .neq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
  const row = (data as unknown as { id: number; room: { name: string } | null }[] | null)?.[0]
  return row ? { id: row.id, room: row.room?.name ?? '' } : null
}

// ===== 2. The notes, and Write a consultation =====
export default function ConsultationsSection({
  client,
  staffId,
  patientId,
  patientName,
  record,
  reload,
  canWrite,
}: Props) {
  const empty = { title: '', complaint: '', findings: '', assessment: '', plan: '' }
  const [adding, setAdding] = useState(false)
  const [parts, setParts] = useState<Record<string, string>>(empty)
  const [medicines, setMedicines] = useState<NewMedicine[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // The note is saved but some medicines were not: Save then adds only those.
  const [noteSaved, setNoteSaved] = useState(false)
  // The boxes whose tap words show in full (the first 8 show otherwise).
  const [allWords, setAllWords] = useState<string[]>([])
  // After saving: offer Send to the nurses.
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [visit, setVisit] = useState<{ id: number; room: string } | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  useEffect(() => {
    if (!sending) return
    openVisitOf(client, patientId).then(setVisit)
  }, [sending, client, patientId])

  async function save() {
    const values: Record<string, string | null> = {}
    for (const part of NOTE_PARTS) values[part.key] = parts[part.key].trim() || null
    if (Object.values(values).every((v) => v === null)) {
      setProblem('Write at least one part.')
      return
    }
    if (medicines.some((m) => m.name.trim().length < 2)) {
      setProblem('Choose each medicine, or remove the empty line.')
      return
    }
    setBusy(true)
    setProblem(null)
    const result = await addLine(client, 'consultation_notes', {
      patient_id: patientId,
      title: parts.title.trim() || null,
      ...values,
      written_by: staffId,
    })
    if (result) {
      setBusy(false)
      setProblem(result)
      return
    }
    // The medicines, one by one. One that fails stays on the form.
    const left: NewMedicine[] = []
    for (const medicine of medicines) {
      const failed = await addLine(client, 'patient_medications', {
        patient_id: patientId,
        medicine: medicineWords(medicine.name.trim(), medicine.strength.trim()),
        dose: medicine.dose.trim() || null,
        how_often: medicine.howOften.trim() || null,
        added_by: staffId,
      })
      if (failed) left.push(medicine)
    }
    setBusy(false)
    reload()
    if (left.length) {
      // The note is saved; only these medicines are not.
      setParts(empty)
      setMedicines(left)
      setNoteSaved(true)
      setProblem('The note is saved. These medicines were not added; try Save again.')
      return
    }
    setAdding(false)
    setParts(empty)
    setMedicines([])
    setSaved(true)
    setSentTo(null)
  }

  // A medicines-only retry after a failed medicine (the note is already saved).
  const onlyMedicines = noteSaved && medicines.length > 0

  async function saveMedicinesOnly() {
    setBusy(true)
    const left: NewMedicine[] = []
    for (const medicine of medicines) {
      const failed = await addLine(client, 'patient_medications', {
        patient_id: patientId,
        medicine: medicineWords(medicine.name.trim(), medicine.strength.trim()),
        dose: medicine.dose.trim() || null,
        how_often: medicine.howOften.trim() || null,
        added_by: staffId,
      })
      if (failed) left.push(medicine)
    }
    setBusy(false)
    reload()
    setMedicines(left)
    if (left.length) setProblem('These medicines were not added. Check the internet and try again.')
    else {
      setNoteSaved(false)
      setProblem(null)
      setAdding(false)
      setSaved(true)
    }
  }

  const count = record.consultations.filter((c) => !c.voided_at).length

  return (
    <Section title="Consultation notes" count={count} open={canWrite}>
      {/* ===== 3. Write a consultation ===== */}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="consult-title">Title (optional)</label>
            <input
              id="consult-title"
              className={styles.input}
              maxLength={120}
              placeholder="e.g. Review of fever"
              value={parts.title}
              onChange={(e) => setParts({ ...parts, title: e.target.value })}
            />
          </div>
          {NOTE_PARTS.map((part) => (
            <div className={styles.field} key={part.key}>
              <label htmlFor={`consult-${part.key}`}>{part.label}</label>
              <textarea
                id={`consult-${part.key}`}
                className={styles.input}
                placeholder={part.hint}
                maxLength={4000}
                value={parts[part.key]}
                onChange={(e) => setParts({ ...parts, [part.key]: e.target.value })}
              />
              <div className={styles.phrases} aria-label={`Common words for ${part.label}`}>
                {(allWords.includes(part.key)
                  ? PHRASES[part.key]
                  : PHRASES[part.key].slice(0, 8)
                ).map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    className={styles.phrase}
                    onClick={() =>
                      setParts({ ...parts, [part.key]: addPhrase(parts[part.key], phrase) })
                    }
                  >
                    + {phrase}
                  </button>
                ))}
                {PHRASES[part.key].length > 8 && !allWords.includes(part.key) ? (
                  <button
                    type="button"
                    className={`${styles.phrase} ${styles.phraseMore}`}
                    onClick={() => setAllWords([...allWords, part.key])}
                  >
                    More…
                  </button>
                ) : null}
              </div>
            </div>
          ))}

          {/* ===== 4. Medicines for the chart ===== */}
          <div className={styles.chartIntro}>
            <b>Medicines for the chart</b>
            <p className={styles.muted}>
              Chosen once here, they go onto the medication chart for the nurses.
            </p>
          </div>
          {medicines.map((medicine, at) => (
            <div key={at} className={styles.medicineLine}>
              <div className={styles.fields}>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor={`consult-med-${at}`}>Medicine</label>
                  <MedicinePicker
                    client={client}
                    staffId={staffId}
                    id={`consult-med-${at}`}
                    name={medicine.name}
                    strength={medicine.strength}
                    onChange={(name, strength) =>
                      setMedicines(
                        medicines.map((m, i) => (i === at ? { ...m, name, strength } : m)),
                      )
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`consult-dose-${at}`}>Dose</label>
                  <OptionSelect
                    client={client}
                    staffId={staffId}
                    list="dose"
                    id={`consult-dose-${at}`}
                    value={medicine.dose}
                    onChange={(dose) =>
                      setMedicines(medicines.map((m, i) => (i === at ? { ...m, dose } : m)))
                    }
                    placeholder="Choose the dose"
                    otherLabel="Type the dose"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`consult-often-${at}`}>How often</label>
                  <OptionSelect
                    client={client}
                    staffId={staffId}
                    list="frequency"
                    id={`consult-often-${at}`}
                    value={medicine.howOften}
                    onChange={(howOften) =>
                      setMedicines(medicines.map((m, i) => (i === at ? { ...m, howOften } : m)))
                    }
                    placeholder="Choose how often"
                    otherLabel="Type how often"
                  />
                </div>
              </div>
              <button
                type="button"
                className={styles.small}
                onClick={() => setMedicines(medicines.filter((_, i) => i !== at))}
              >
                Remove this medicine
              </button>
            </div>
          ))}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.small}
              onClick={() =>
                setMedicines([...medicines, { name: '', strength: '', dose: '', howOften: '' }])
              }
            >
              + Add a medicine
            </button>
          </div>

          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button
              className={`${styles.small} ${styles.primary}`}
              disabled={busy}
              onClick={onlyMedicines ? saveMedicinesOnly : save}
            >
              {busy ? 'Saving…' : onlyMedicines ? 'Add the medicines' : 'Save consultation'}
            </button>
            <button
              className={styles.small}
              disabled={busy}
              onClick={() => {
                setAdding(false)
                setMedicines([])
                setNoteSaved(false)
                setProblem(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : canWrite ? (
        <div className={styles.actions}>
          <button
            className={`${styles.small} ${styles.primary}`}
            onClick={() => {
              setSaved(false)
              setAdding(true)
            }}
          >
            + Write a consultation
          </button>
        </div>
      ) : null}

      {/* ===== 5. Saved: Send to the nurses ===== */}
      {saved && canWrite ? (
        sending ? (
          <SendToRoom
            client={client}
            staffId={staffId}
            patientId={patientId}
            patientName={patientName}
            openVisit={visit}
            kinds={['nursing', 'matron']}
            onSent={(room) => {
              setSending(false)
              setSaved(false)
              setSentTo(room)
            }}
            onCancel={() => setSending(false)}
          />
        ) : (
          <div className={styles.saveDone}>
            <b>Consultation saved.</b>
            <div className={styles.actions}>
              <button
                className={`${styles.small} ${styles.primary}`}
                onClick={() => setSending(true)}
              >
                Send to the nurses
              </button>
              <button className={styles.small} onClick={() => setSaved(false)}>
                Not now
              </button>
            </div>
          </div>
        )
      ) : null}
      {sentTo ? (
        <p className={styles.muted}>
          Sent to {sentTo}. The nurses there see the treatment plan at the top of the record.
        </p>
      ) : null}

      {/* ===== 6. The notes written, newest first ===== */}
      {record.consultations.length === 0 ? <EmptyLine text="No consultations yet." /> : null}
      {record.consultations.map((line) => (
        <Line
          key={line.id}
          what={
            <b>
              {line.title ? `${line.title} · ` : ''}
              {when(line.created_at)}
            </b>
          }
          meta={`Written by ${line.author?.full_name ?? 'staff'}`}
          voided={voidedOf(line)}
          voidable={
            canWrite
              ? { client, table: 'consultation_notes', id: line.id, staffId, onDone: reload }
              : undefined
          }
        >
          <dl className={styles.consult}>
            {NOTE_PARTS.filter((part) => line[part.key]).map((part) => (
              <div key={part.key}>
                <dt>{part.label}</dt>
                <dd className={styles.note}>{line[part.key]}</dd>
              </div>
            ))}
          </dl>
        </Line>
      ))}
    </Section>
  )
}
