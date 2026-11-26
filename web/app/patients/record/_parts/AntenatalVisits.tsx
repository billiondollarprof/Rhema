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
 *   3. VisitsPart: the visits, newest first, and Add a visit. Since
 *      2026-11-24 (request 246) every number is picked from a list, the
 *      readings already taken in Vital signs today fill themselves in, and
 *      the drugs come from the medicine list: the ones nurses ticked Given
 *      on the medication chart since the last visit are already chosen.
 *   4. ClientPart: marital status, religion, education, occupation, tribe.
 *   5. HistoryPart: the medical history ticklist and the surgical history.
 *
 * Never: save a visit in another person's name (the database refuses it), or
 * change one after it is saved (a wrong one is voided with a reason).
 */
'use client'

import { serverNow } from '@/lib/time/serverTime'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import { EmptyLine } from './Section'
import styles from './record.module.css'
import OptionSelect from '@/components/options/OptionSelect'
import { addLine, type DoseGiven, type Vitals } from '@/lib/record/record'
import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import MedicinePicker from '@/components/medicines/MedicinePicker'
import { RANGES, VitalPick, type Range } from './Observations'
import {
  DIPSTICK,
  EDUCATION,
  MARITAL,
  OEDEMA,
  POSITIONS,
  PRESENTATIONS,
  RELIGIONS,
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
// Today, by the internet's clock (request 225).
const today = () => serverNow().toISOString().slice(0, 10)
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

// The lists the card's numbers are picked from (request 246, 2026-11-24).
// Fundus: palpable from about 12 weeks, and in centimetres it is close to
// the weeks from 20 weeks on. Foetal heart: 110 to 160 is normal (NICE, and
// the Irish national guideline); the list runs 60 to 200 so a worrying one
// can still be written (60 is the lowest the database takes, request 248).
// "Other" types anything outside a list.
const CARD_RANGES: Record<string, Range> = {
  fundal: { from: 12, to: 42, step: 1, start: '28', decimals: 0 },
  fhr: { from: 60, to: 200, step: 1, start: '140', decimals: 0 },
  hb: { from: 4, to: 18, step: 0.1, start: '11', decimals: 1 },
}

// A box with its label, holding one number list.
function PickBox({
  id,
  label,
  range,
  value,
  onChange,
  invalid = false,
}: {
  id: string
  label: string
  range: Range
  value: string
  onChange: (value: string) => void
  // A value the database would refuse: red (request 252).
  invalid?: boolean
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <VitalPick id={id} range={range} value={value} onChange={onChange} invalid={invalid} />
    </div>
  )
}

// What the database takes for each number on the card (the checks on
// antenatal_visits). A number outside these, or a decimal where it takes a
// whole number, was refused with words that did not say which one
// (request 248, 2026-11-25). Now the form names it before saving.
const LIMITS: [keyof typeof EMPTY, string, number, number, boolean][] = [
  ['fundal', 'Height of fundus', 8, 45, true],
  ['fhr', 'Foetal heart rate', 60, 220, true],
  ['systolic', 'BP top', 40, 300, true],
  ['diastolic', 'BP bottom', 20, 200, true],
  ['pulse', 'Pulse', 20, 260, true],
  ['respiration', 'Respiration', 4, 80, true],
  ['weight', 'Weight', 20, 250, false],
  ['hb', 'Hb', 2, 25, false],
]

// The first number that the database would refuse: its box (shown red,
// request 252) and the words; null if none.
function numberProblem(form: typeof EMPTY): { key: keyof typeof EMPTY; words: string } | null {
  for (const [key, label, min, max, whole] of LIMITS) {
    const typed = form[key].trim()
    if (typed === '') continue
    const value = Number(typed)
    if (Number.isNaN(value) || value < min || value > max) {
      return { key, words: `${label} must be between ${min} and ${max}.` }
    }
    if (whole && !Number.isInteger(value)) return { key, words: `${label} must be a whole number.` }
  }
  return null
}

// The day of a moment, in the hospital's time zone, such as 2026-11-24.
const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: HOSPITAL_TIME_ZONE })

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
  vitals = [],
  doses = [],
}: Props & { visits: Visit[]; vitals?: Vitals[]; doses?: DoseGiven[] }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [drugs, setDrugs] = useState<string[]>([])
  // Where the filled in readings came from, to say so on the form.
  const [fromVitals, setFromVitals] = useState<string | null>(null)
  // The medicine being picked, before it joins the drugs given.
  const [pickName, setPickName] = useState('')
  const [pickStrength, setPickStrength] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  // The box holding a value the database would refuse, shown red (252).
  const [wrongKey, setWrongKey] = useState<keyof typeof EMPTY | null>(null)
  const set = (key: keyof typeof EMPTY) => (value: string) => {
    // Changing the red box takes the red off; it is checked again on Save.
    if (wrongKey === key) setWrongKey(null)
    setForm({ ...form, [key]: value })
  }

  // ===== 3a. Open the form, with what is already known filled in =====
  // Nothing typed twice (request 246): today's vital signs give the BP,
  // pulse, respiration and weight, and the medicines nurses ticked Given on
  // the medication chart since the last visit are already chosen. Every one
  // can still be changed before saving.
  function startVisit() {
    const todayIs = dayOf(serverNow().toISOString())
    // The newest reading of each kind taken today, not voided.
    const todays = vitals
      .filter((row) => !row.voided_at && dayOf(row.recorded_at) === todayIs)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    const newest = <T,>(pick: (row: Vitals) => T | null): string => {
      const found = todays.find((row) => pick(row) !== null && pick(row) !== undefined)
      return found ? String(pick(found)) : ''
    }
    const filled = {
      ...EMPTY,
      systolic: newest((row) => row.systolic),
      diastolic: newest((row) => row.diastolic),
      pulse: newest((row) => row.pulse),
      respiration: newest((row) => row.breathing_rate),
      weight: newest((row) => row.weight_kg),
    }
    setForm(filled)
    setFromVitals(
      todays.length
        ? `Filled in from today's vital signs (${todays[0].signer?.full_name ?? todays[0].recorder?.full_name ?? 'staff'}). Change any that are wrong.`
        : null,
    )
    // Medicines given since the last visit (or in the last 4 weeks).
    const lastVisit = visits.find((visit) => !visit.voided_at)
    const since = lastVisit
      ? new Date(lastVisit.created_at).getTime()
      : serverNow().getTime() - 28 * 24 * 60 * 60 * 1000
    const given: string[] = []
    for (const dose of doses) {
      if (dose.voided_at || dose.not_given_reason) continue
      if (new Date(dose.given_at).getTime() < since) continue
      if (!given.includes(dose.medicine)) given.push(dose.medicine)
    }
    setDrugs(given)
    setPickName('')
    setPickStrength('')
    setProblem(null)
    setWrongKey(null)
    setAdding(true)
  }

  // A medicine picked from the list joins the drugs given.
  function pickMedicine(name: string, strength: string) {
    const words = [name, strength].filter(Boolean).join(' ').trim()
    if (words && !drugs.includes(words)) setDrugs([...drugs, words])
    setPickName('')
    setPickStrength('')
  }

  async function save() {
    // Checked here first, so the words name the reading (request 248).
    const wrong = numberProblem(form)
    setWrongKey(wrong?.key ?? null)
    if (wrong) {
      setProblem(wrong.words)
      return
    }
    const anything =
      Object.entries(form).some(([, value]) => value.trim() !== '') || drugs.length > 0
    if (!anything) {
      setProblem('Fill in at least one reading before saving.')
      return
    }
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
            <PickBox
              id="v-fundal"
              label="Height of fundus (weeks)"
              range={CARD_RANGES.fundal}
              value={form.fundal}
              onChange={set('fundal')}
              invalid={wrongKey === 'fundal'}
            />
            <PickBox
              id="v-fhr"
              label="Foetal heart rate (bpm)"
              range={CARD_RANGES.fhr}
              value={form.fhr}
              onChange={set('fhr')}
              invalid={wrongKey === 'fhr'}
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
          {fromVitals ? <p className={styles.muted}>{fromVitals}</p> : null}
          <div className={styles.fields}>
            <PickBox
              id="v-sys"
              label="BP top"
              range={RANGES.systolic}
              value={form.systolic}
              onChange={set('systolic')}
              invalid={wrongKey === 'systolic'}
            />
            <PickBox
              id="v-dia"
              label="BP bottom"
              range={RANGES.diastolic}
              value={form.diastolic}
              onChange={set('diastolic')}
              invalid={wrongKey === 'diastolic'}
            />
            <PickBox
              id="v-pulse"
              label="Pulse (bpm)"
              range={RANGES.pulse}
              value={form.pulse}
              onChange={set('pulse')}
              invalid={wrongKey === 'pulse'}
            />
            <PickBox
              id="v-resp"
              label="Respiration (/min)"
              range={RANGES.breathing_rate}
              value={form.respiration}
              onChange={set('respiration')}
              invalid={wrongKey === 'respiration'}
            />
            <PickBox
              id="v-weight"
              label="Weight (kg)"
              range={RANGES.weight_kg}
              value={form.weight}
              onChange={set('weight')}
              invalid={wrongKey === 'weight'}
            />
            <PickBox
              id="v-hb"
              label="Hb (g/dL)"
              range={CARD_RANGES.hb}
              value={form.hb}
              onChange={set('hb')}
              invalid={wrongKey === 'hb'}
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
          {/* Drugs given: a drop down of the hospital's medicine list, with
              Other for one that is missing (request 246). The ones chosen
              show under it; tap one to take it off. */}
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label htmlFor="v-drug">Drugs given</label>
            <MedicinePicker
              client={client}
              staffId={staffId}
              id="v-drug"
              name={pickName}
              strength={pickStrength}
              onChange={(name, strength) => {
                // A medicine with several strengths comes first with its name
                // only; the strength is chosen next, then it joins the list.
                if (name && strength) pickMedicine(name, strength)
                else {
                  setPickName(name)
                  setPickStrength(strength)
                }
              }}
              placeholder="Type the first letters"
            />
            {/* A medicine with no strength on the list joins it with a tap. */}
            {pickName && !pickStrength ? (
              <button
                type="button"
                className={styles.small}
                onClick={() => pickMedicine(pickName, '')}
              >
                Add {pickName} without a strength
              </button>
            ) : null}
            {drugs.length ? (
              <div className={styles.chips} role="group" aria-label="Drugs chosen">
                {drugs.map((drug) => (
                  <button
                    key={drug}
                    type="button"
                    className={styles.chip}
                    aria-pressed
                    aria-label={`Remove ${drug}`}
                    onClick={() => setDrugs(drugs.filter((d) => d !== drug))}
                  >
                    {drug} ✕
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>No drugs chosen yet.</p>
            )}
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
          <button className={styles.small} onClick={startVisit}>
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
  const [typingSurgery, setTypingSurgery] = useState(false)

  // One more history line, typed or picked, once only.
  function addHistory(item: string) {
    const words = item.trim().slice(0, 120)
    if (words && !yes.some((had) => had.toLowerCase() === words.toLowerCase())) {
      setYes([...yes, words])
    }
  }

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
      {/* More than 8 choices: a drop down with a search box, and Other to
          type one that is missing (CLAUDE.md "Pick, never type", request
          254). Each one chosen shows under it; tap it to take it off. */}
      <div className={`${styles.field} ${styles.fieldWide}`}>
        <label htmlFor="history-pick">Choose each one she has had. Leave empty for Nil.</label>
        {/* The hospital's list (pick_options, antenatal_history): Other
            types one that is missing, with "Save it to the list for
            everybody", so next time it is one tap (CLAUDE.md, 254). */}
        <OptionSelect
          client={client}
          staffId={staffId}
          list="antenatal_history"
          id="history-pick"
          value=""
          onChange={addHistory}
          placeholder="Choose"
          otherLabel="Type it"
        />
        {yes.length ? (
          <div className={styles.chips} role="group" aria-label="Medical history">
            {yes.map((item) => (
              <button
                key={item}
                type="button"
                className={styles.chip}
                aria-pressed
                aria-label={`Remove ${item}`}
                onClick={() => setYes(yes.filter((had) => had !== item))}
              >
                {item} ✕
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>Nil so far.</p>
        )}
      </div>
      {/* Up to 8 choices: quick buttons, and Other to type one (254). */}
      <Choices
        label="Surgical history (leave empty for Nil)"
        options={[...SURGERIES, ...(surgery && !SURGERIES.includes(surgery) ? [surgery] : [])]}
        value={surgery}
        onChange={(value) => {
          setTypingSurgery(false)
          setSurgery(value)
        }}
      />
      {typingSurgery ? (
        <div className={styles.field}>
          <label htmlFor="surgery-other">Other surgery</label>
          <input
            id="surgery-other"
            className={styles.input}
            autoFocus
            maxLength={120}
            value={surgery}
            onChange={(event) => setSurgery(event.target.value)}
          />
        </div>
      ) : (
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            setSurgery('')
            setTypingSurgery(true)
          }}
        >
          Other surgery
        </button>
      )}
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
