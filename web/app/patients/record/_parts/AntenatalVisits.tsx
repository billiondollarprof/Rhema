/*
 * record/_parts/AntenatalVisits.tsx: the antenatal card's visit table, the
 * woman's own details, her histories, and the due date from the last period.
 *
 * Why: Anthony, 2026-11-16, with photos of the card from the midwife
 * (Consultant Room 2): "they do palpation... height of fundus... we need to
 * add columns for the palpation... check if we already have those data." And:
 * "limit the typing to the bare minimum." So almost everything is picked:
 * presentation, position, urine, oedema, the routine drugs, the return visit.
 *
 * Sections in this file:
 *   1. Small helpers (choice buttons, the due date).
 *   2. DueDate: the expected date of delivery and today's weeks, from the
 *      last menstrual period (Naegele: 280 days).
 *   3. VisitsPart: the visits, newest first, and Add a visit.
 *   4. ClientPart: marital status, religion, education, occupation, tribe.
 *   5. HistoryPart: the medical history ticklist and the surgical history.
 *
 * Never: save a visit in another person's name (the database refuses it), or
 * change one after it is saved (a wrong one is voided with a reason).
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import { EmptyLine } from './Section'
import styles from './record.module.css'
import OptionSelect from '@/components/options/OptionSelect'
import { addLine } from '@/lib/record/record'
import {
  DIPSTICK,
  EDUCATION,
  HISTORY,
  MARITAL,
  OEDEMA,
  POSITIONS,
  PRESENTATIONS,
  RELIGIONS,
  ROUTINE_DRUGS,
  SURGERIES,
  saveBooking,
  type Booking,
  type Visit,
} from '@/lib/record/antenatal'

type Props = { client: SupabaseClient; staffId: string; patientId: number; onDone: () => void }

const dateWords = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-'
const today = () => new Date().toISOString().slice(0, 10)
const inDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
const numberOrNull = (typed: string) => (typed.trim() === '' ? null : Number(typed))

// ===== 1. Small helpers =====
// A row of buttons to pick one (tap the chosen one again to clear it).
function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className={`${styles.field} ${styles.fieldWide}`}>
      <span>{label}</span>
      <div className={styles.chips} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.chip}
            aria-pressed={value === option}
            onClick={() => onChange(value === option ? '' : option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumberBox({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={styles.input}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ''))}
      />
    </div>
  )
}

// ===== 2. The due date, from the last menstrual period =====
export function DueDate({ lmp }: { lmp: string | null }) {
  // Read once, when the screen opens.
  const [now] = useState(() => Date.now())
  if (!lmp) {
    return (
      <p className={styles.muted}>
        Add the last period (first day) in Blood group and profile to see the due date.
      </p>
    )
  }
  const start = new Date(lmp)
  const due = new Date(start)
  due.setDate(due.getDate() + 280)
  const days = Math.floor((now - start.getTime()) / (24 * 60 * 60 * 1000))
  const weeks = Math.floor(days / 7)
  return (
    <p>
      <b>Expected date of delivery: {dateWords(due.toISOString())}</b>
      <br />
      <span className={styles.muted}>
        {days >= 0 && days <= 300
          ? `Today she is ${weeks} weeks ${days % 7} days.`
          : 'Check the last period date.'}
      </span>
    </p>
  )
}

// ===== 3. The visits =====
const visitWords = (visit: Visit) =>
  [
    visit.fundal_height !== null ? `Fundus ${visit.fundal_height} weeks` : '',
    [visit.presentation, visit.position].filter(Boolean).join(' '),
    visit.foetal_heart !== null ? `FHR ${visit.foetal_heart}` : '',
    visit.systolic !== null && visit.diastolic !== null
      ? `BP ${visit.systolic}/${visit.diastolic}`
      : '',
    visit.pulse !== null ? `Pulse ${visit.pulse}` : '',
    visit.respiration !== null ? `Resp ${visit.respiration}` : '',
    visit.weight_kg !== null ? `${visit.weight_kg} kg` : '',
    visit.hb !== null ? `Hb ${visit.hb}` : '',
    visit.urine_protein || visit.urine_sugar
      ? `Urine: protein ${visit.urine_protein ?? '-'}, sugar ${visit.urine_sugar ?? '-'}`
      : '',
    visit.oedema ? `Oedema ${visit.oedema}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

const EMPTY = {
  fundal: '',
  presentation: '',
  position: '',
  fhr: '',
  protein: '',
  sugar: '',
  systolic: '',
  diastolic: '',
  pulse: '',
  respiration: '',
  weight: '',
  hb: '',
  oedema: '',
  remark: '',
  returnOn: '',
}

export function VisitsPart({
  client,
  staffId,
  patientId,
  onDone,
  visits,
}: Props & { visits: Visit[] }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [drugs, setDrugs] = useState<string[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm({ ...form, [key]: value })

  async function save() {
    const result = await addLine(client, 'antenatal_visits', {
      patient_id: patientId,
      visit_on: today(),
      fundal_height: numberOrNull(form.fundal),
      presentation: form.presentation || null,
      position: form.position || null,
      foetal_heart: numberOrNull(form.fhr),
      urine_protein: form.protein || null,
      urine_sugar: form.sugar || null,
      systolic: numberOrNull(form.systolic),
      diastolic: numberOrNull(form.diastolic),
      pulse: numberOrNull(form.pulse),
      respiration: numberOrNull(form.respiration),
      weight_kg: numberOrNull(form.weight),
      hb: numberOrNull(form.hb),
      oedema: form.oedema || null,
      drugs_given: drugs,
      remark: form.remark.trim() || null,
      return_on: form.returnOn || null,
      recorded_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setAdding(false)
      setForm(EMPTY)
      setDrugs([])
      setProblem(null)
      onDone()
    }
  }

  return (
    <div className={styles.form}>
      <b>Visits</b>
      {visits.length === 0 ? <EmptyLine text="No visits recorded yet." /> : null}
      {visits.map((visit) => (
        <Line
          key={visit.id}
          what={<b>{dateWords(visit.visit_on)}</b>}
          meta={`Examined by ${visit.recorder?.full_name ?? 'staff'}${visit.return_on ? ` · Return ${dateWords(visit.return_on)}` : ''}`}
          voided={
            visit.voided_at
              ? { reason: visit.void_reason, by: visit.voider?.full_name ?? null }
              : null
          }
          voidable={{ client, table: 'antenatal_visits', id: visit.id, staffId, onDone }}
        >
          <p className={styles.note}>
            {visitWords(visit) || 'No readings'}
            {visit.drugs_given.length ? (
              <>
                <br />
                Drugs given: {visit.drugs_given.join(', ')}
              </>
            ) : null}
            {visit.remark ? (
              <>
                <br />
                Remark: {visit.remark}
              </>
            ) : null}
          </p>
        </Line>
      ))}
      {adding ? (
        <div className={styles.form}>
          <b>Palpation</b>
          <div className={styles.fields}>
            <NumberBox
              id="v-fundal"
              label="Height of fundus (weeks)"
              value={form.fundal}
              onChange={set('fundal')}
              placeholder="e.g. 28"
            />
            <NumberBox
              id="v-fhr"
              label="Foetal heart rate (bpm)"
              value={form.fhr}
              onChange={set('fhr')}
              placeholder="e.g. 140"
            />
            <Choices
              label="Presentation"
              options={PRESENTATIONS}
              value={form.presentation}
              onChange={set('presentation')}
            />
            <Choices
              label="Position"
              options={POSITIONS}
              value={form.position}
              onChange={set('position')}
            />
          </div>
          <b>Readings</b>
          <div className={styles.fields}>
            <NumberBox
              id="v-sys"
              label="BP top"
              value={form.systolic}
              onChange={set('systolic')}
              placeholder="e.g. 110"
            />
            <NumberBox
              id="v-dia"
              label="BP bottom"
              value={form.diastolic}
              onChange={set('diastolic')}
              placeholder="e.g. 70"
            />
            <NumberBox
              id="v-pulse"
              label="Pulse (bpm)"
              value={form.pulse}
              onChange={set('pulse')}
              placeholder="e.g. 88"
            />
            <NumberBox
              id="v-resp"
              label="Respiration (/min)"
              value={form.respiration}
              onChange={set('respiration')}
              placeholder="e.g. 20"
            />
            <NumberBox
              id="v-weight"
              label="Weight (kg)"
              value={form.weight}
              onChange={set('weight')}
              placeholder="e.g. 70"
            />
            <NumberBox
              id="v-hb"
              label="Hb (g/dL)"
              value={form.hb}
              onChange={set('hb')}
              placeholder="e.g. 11.5"
            />
            <Choices
              label="Urine protein"
              options={DIPSTICK}
              value={form.protein}
              onChange={set('protein')}
            />
            <Choices
              label="Urine sugar"
              options={DIPSTICK}
              value={form.sugar}
              onChange={set('sugar')}
            />
            <Choices label="Oedema" options={OEDEMA} value={form.oedema} onChange={set('oedema')} />
          </div>
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <span>Drugs given</span>
            <div className={styles.chips} role="group" aria-label="Drugs given">
              {ROUTINE_DRUGS.map((drug) => (
                <button
                  key={drug}
                  type="button"
                  className={styles.chip}
                  aria-pressed={drugs.includes(drug)}
                  onClick={() =>
                    setDrugs(
                      drugs.includes(drug) ? drugs.filter((d) => d !== drug) : [...drugs, drug],
                    )
                  }
                >
                  {drug}
                </button>
              ))}
            </div>
          </div>
          <Choices
            label="Remark"
            options={['Well', 'Refer to the doctor', 'Admit']}
            value={form.remark}
            onChange={set('remark')}
          />
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <span>Comes back</span>
            <div className={styles.chips} role="group" aria-label="Comes back">
              {[
                ['In 1 week', 7],
                ['In 2 weeks', 14],
                ['In 4 weeks', 28],
              ].map(([words, days]) => (
                <button
                  key={words}
                  type="button"
                  className={styles.chip}
                  aria-pressed={form.returnOn === inDays(days as number)}
                  onClick={() => set('returnOn')(inDays(days as number))}
                >
                  {words}
                </button>
              ))}
              <input
                aria-label="Return date"
                className={styles.input}
                type="date"
                min={today()}
                value={form.returnOn}
                onChange={(event) => set('returnOn')(event.target.value)}
              />
            </div>
          </div>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={save}>
              Save visit
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Add a visit
          </button>
        </div>
      )}
    </div>
  )
}

// ===== 4. The woman herself =====
export function ClientPart({
  client,
  staffId,
  patientId,
  onDone,
  booking,
}: Props & { booking: Booking | null }) {
  const [editing, setEditing] = useState(false)
  const [marital, setMarital] = useState(booking?.client_marital_status ?? '')
  const [religion, setReligion] = useState(booking?.client_religion ?? '')
  const [education, setEducation] = useState(booking?.client_education ?? '')
  const [occupation, setOccupation] = useState(booking?.client_occupation ?? '')
  const [tribe, setTribe] = useState(booking?.client_tribe ?? '')
  const [problem, setProblem] = useState<string | null>(null)

  async function save() {
    const result = await saveBooking(
      client,
      patientId,
      staffId,
      {
        client_marital_status: marital || null,
        client_religion: religion || null,
        client_education: education || null,
        client_occupation: occupation || null,
        client_tribe: tribe || null,
      },
      Boolean(booking),
    )
    if (result) setProblem(result)
    else {
      setEditing(false)
      setProblem(null)
      onDone()
    }
  }

  if (!editing) {
    const facts = [
      booking?.client_marital_status,
      booking?.client_religion,
      booking?.client_education,
      booking?.client_occupation,
      booking?.client_tribe,
    ].filter(Boolean)
    return (
      <div className={styles.form}>
        <b>About her</b>
        <p className={styles.muted}>{facts.length ? facts.join(' · ') : 'Not filled in yet.'}</p>
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setEditing(true)}>
            {facts.length ? 'Edit' : 'Fill in'}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className={styles.form}>
      <b>About her</b>
      <Choices label="Marital status" options={MARITAL} value={marital} onChange={setMarital} />
      <Choices label="Religion" options={RELIGIONS} value={religion} onChange={setReligion} />
      <Choices
        label="Level of education"
        options={EDUCATION}
        value={education}
        onChange={setEducation}
      />
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="client-occupation">Occupation</label>
          <OptionSelect
            client={client}
            staffId={staffId}
            list="occupation"
            id="client-occupation"
            value={occupation}
            onChange={setOccupation}
            placeholder="Choose the occupation"
            otherLabel="Type the occupation"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="client-tribe">Tribe</label>
          <OptionSelect
            client={client}
            staffId={staffId}
            list="tribe"
            id="client-tribe"
            value={tribe}
            onChange={setTribe}
            placeholder="Choose the tribe"
            otherLabel="Type the tribe"
          />
        </div>
      </div>
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
  )
}

// ===== 5. Medical and surgical history =====
export function HistoryPart({
  client,
  staffId,
  patientId,
  onDone,
  booking,
}: Props & { booking: Booking | null }) {
  const [editing, setEditing] = useState(false)
  const [yes, setYes] = useState<string[]>(booking?.history_yes ?? [])
  const [surgery, setSurgery] = useState(booking?.surgery_type ?? '')
  const [reason, setReason] = useState(booking?.surgery_reason ?? '')
  const [problem, setProblem] = useState<string | null>(null)

  async function save() {
    const result = await saveBooking(
      client,
      patientId,
      staffId,
      {
        history_asked: true,
        history_yes: yes,
        surgery_type: surgery || null,
        surgery_reason: reason.trim() || null,
      },
      Boolean(booking),
    )
    if (result) setProblem(result)
    else {
      setEditing(false)
      setProblem(null)
      onDone()
    }
  }

  if (!editing) {
    return (
      <div className={styles.form}>
        <b>Medical and surgical history</b>
        <p className={styles.muted}>
          {!booking?.history_asked
            ? 'Not asked yet.'
            : booking.history_yes.length
              ? `Medical: ${booking.history_yes.join(', ')}`
              : 'Medical: Nil'}
          {booking?.surgery_type ? (
            <>
              <br />
              Surgical: {booking.surgery_type}
              {booking.surgery_reason ? ` (${booking.surgery_reason})` : ''}
            </>
          ) : booking?.history_asked ? (
            <>
              <br />
              Surgical: Nil
            </>
          ) : null}
        </p>
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setEditing(true)}>
            {booking?.history_asked ? 'Edit' : 'Ask now'}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className={styles.form}>
      <b>Medical history</b>
      <p className={styles.muted}>Tap each one she has had. Leave them all for Nil.</p>
      <div className={styles.chips} role="group" aria-label="Medical history">
        {HISTORY.map((item) => (
          <button
            key={item}
            type="button"
            className={styles.chip}
            aria-pressed={yes.includes(item)}
            onClick={() =>
              setYes(yes.includes(item) ? yes.filter((y) => y !== item) : [...yes, item])
            }
          >
            {item}
          </button>
        ))}
      </div>
      <Choices
        label="Surgical history (leave empty for Nil)"
        options={SURGERIES}
        value={surgery}
        onChange={setSurgery}
      />
      {surgery ? (
        <div className={styles.field}>
          <label htmlFor="surgery-reason">Reason (optional)</label>
          <input
            id="surgery-reason"
            className={styles.input}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      ) : null}
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
  )
}
