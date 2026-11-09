/*
 * record/_parts/Antenatal.tsx: the antenatal booking and the consent for an
 * operation, inside the medical record (request 170, 2026-11-09).
 *
 * Why: the hospital's antenatal card, which the matron wants in the app:
 * "these information have to be there including the one written at the
 * bottom with pen, for consent." His answers: documented means photos and
 * video; "no signature, you can put a checkbox to serve for the signature,
 * including name and date"; the consent form for "any patient".
 *
 * Sections in this file:
 *   1. Small form helpers.
 *   2. AntenatalSection (antenatal patients): the consent box for photos and
 *      video of the delivery; next of kin details; the totals; the routine
 *      tests; previous pregnancies (and the baby if it died).
 *   3. ConsentSection (every patient): consents saved, and a new one.
 *
 * Never: save a consent without its tick, or change one after it is saved
 * (a wrong one is voided with a reason, and a new one is saved).
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import { addLine, when } from '@/lib/record/record'
import {
  TEST_WORDS,
  loadAntenatal,
  loadConsents,
  saveBooking,
  testWords,
  type Booking,
  type Consent,
  type Pregnancy,
  type AntenatalTest,
} from '@/lib/record/antenatal'
import { onChange } from '@/lib/live/changes'

type Props = { client: SupabaseClient; staffId: string; patientId: number }

const today = () => new Date().toISOString().slice(0, 10)
const dateWords = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-'
const voidedOf = (line: AntenatalTest | Pregnancy | Consent) =>
  line.voided_at ? { reason: line.void_reason, by: line.voider?.full_name ?? null } : null
const numberOrNull = (typed: string) => (typed.trim() === '' ? null : Number(typed))

// ===== 1. Small form helpers =====
function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={styles.input}
        type={type}
        inputMode={type === 'number' ? 'numeric' : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

// ===== 2. The antenatal booking =====
export function AntenatalSection({ client, staffId, patientId }: Props) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAntenatal>> | null>(null)
  const load = useCallback(
    async () => setData(await loadAntenatal(client, patientId)),
    [client, patientId],
  )
  useEffect(() => {
    // First read straight after the screen shows, then again whenever
    // anybody saves something (request 157).
    const first = window.setTimeout(() => void load(), 0)
    const stop = onChange(client, 'records', () => void load())
    return () => {
      window.clearTimeout(first)
      stop()
    }
  }, [client, load])

  if (!data) return null
  const live = (rows: { voided_at: string | null }[]) => rows.filter((row) => !row.voided_at).length
  return (
    <Section title="Antenatal booking" count={live(data.tests) + live(data.pregnancies)} open>
      <DocumentedBox
        client={client}
        staffId={staffId}
        patientId={patientId}
        booking={data.booking}
        onDone={load}
      />
      <BookingForm
        client={client}
        staffId={staffId}
        patientId={patientId}
        booking={data.booking}
        onDone={load}
      />
      <TestsPart
        client={client}
        staffId={staffId}
        patientId={patientId}
        tests={data.tests}
        onDone={load}
      />
      <PregnanciesPart
        client={client}
        staffId={staffId}
        patientId={patientId}
        pregnancies={data.pregnancies}
        onDone={load}
      />
    </Section>
  )
}

type PartProps = Props & { onDone: () => void }

// 2a. "Would you like your delivery to be documented?" (photos and video)
function DocumentedBox({
  client,
  staffId,
  patientId,
  booking,
  onDone,
}: PartProps & { booking: Booking | null }) {
  const [problem, setProblem] = useState<string | null>(null)
  async function answer(yes: boolean) {
    const result = await saveBooking(
      client,
      patientId,
      staffId,
      {
        documented_delivery: yes,
        documented_answered_by: staffId,
        documented_answered_at: new Date().toISOString(),
      },
      booking !== null,
    )
    setProblem(result)
    if (!result) onDone()
  }
  const answered = booking?.documented_delivery
  return (
    <div className={styles.form}>
      <b>Would you like your delivery to be documented (photos and video)?</b>
      <div className={styles.chips} role="group" aria-label="Delivery documented">
        <button
          className={`${styles.chip} ${styles.bigChip}`}
          aria-pressed={answered === true}
          onClick={() => answer(true)}
        >
          Yes
        </button>
        <button
          className={`${styles.chip} ${styles.bigChip}`}
          aria-pressed={answered === false}
          onClick={() => answer(false)}
        >
          No
        </button>
      </div>
      {answered !== null && answered !== undefined && booking ? (
        <small className={styles.muted}>
          Answered {answered ? 'Yes' : 'No'}, recorded by {booking.answerer?.full_name ?? 'staff'},{' '}
          {when(booking.documented_answered_at ?? '')}
        </small>
      ) : (
        <small className={styles.muted}>Not asked yet.</small>
      )}
      {problem ? <p className={styles.error}>{problem}</p> : null}
    </div>
  )
}

// 2b. Next of kin details and the totals
function BookingForm({
  client,
  staffId,
  patientId,
  booking,
  onDone,
}: PartProps & { booking: Booking | null }) {
  const start = (value: string | number | null | undefined) =>
    value === null || value === undefined ? '' : String(value)
  const [values, setValues] = useState({
    kin_occupation: start(booking?.kin_occupation),
    kin_religion: start(booking?.kin_religion),
    kin_education: start(booking?.kin_education),
    kin_age: start(booking?.kin_age),
    kin_tribe: start(booking?.kin_tribe),
    abortions: start(booking?.abortions),
    miscarriages: start(booking?.miscarriages),
    total_pregnancies: start(booking?.total_pregnancies),
    parity: start(booking?.parity),
  })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const set = (key: keyof typeof values) => (value: string) => {
    setSaved(false)
    setValues((now) => ({ ...now, [key]: value }))
  }
  const text = (value: string) => value.trim() || null
  async function save() {
    setBusy(true)
    const result = await saveBooking(
      client,
      patientId,
      staffId,
      {
        kin_occupation: text(values.kin_occupation),
        kin_religion: text(values.kin_religion),
        kin_education: text(values.kin_education),
        kin_age: numberOrNull(values.kin_age),
        kin_tribe: text(values.kin_tribe),
        abortions: numberOrNull(values.abortions),
        miscarriages: numberOrNull(values.miscarriages),
        total_pregnancies: numberOrNull(values.total_pregnancies),
        parity: text(values.parity),
      },
      booking !== null,
    )
    setBusy(false)
    setProblem(result)
    if (!result) {
      setSaved(true)
      onDone()
    }
  }
  return (
    <div className={styles.form}>
      <b>Next of kin, more details</b>
      <div className={styles.fields}>
        <Field
          id="kin-occupation"
          label="Occupation"
          value={values.kin_occupation}
          onChange={set('kin_occupation')}
        />
        <Field
          id="kin-religion"
          label="Religion"
          value={values.kin_religion}
          onChange={set('kin_religion')}
        />
        <Field
          id="kin-education"
          label="Level of education"
          value={values.kin_education}
          onChange={set('kin_education')}
        />
        <Field
          id="kin-age"
          label="Age"
          type="number"
          value={values.kin_age}
          onChange={set('kin_age')}
        />
        <Field id="kin-tribe" label="Tribe" value={values.kin_tribe} onChange={set('kin_tribe')} />
      </div>
      <b>Pregnancies so far</b>
      <div className={styles.fields}>
        <Field
          id="an-abortions"
          label="Number of abortions"
          type="number"
          value={values.abortions}
          onChange={set('abortions')}
        />
        <Field
          id="an-miscarriages"
          label="Number of miscarriages"
          type="number"
          value={values.miscarriages}
          onChange={set('miscarriages')}
        />
        <Field
          id="an-total"
          label="Total number of pregnancies"
          type="number"
          value={values.total_pregnancies}
          onChange={set('total_pregnancies')}
        />
        <Field
          id="an-parity"
          label="Parity"
          placeholder="e.g. Para 1+0"
          value={values.parity}
          onChange={set('parity')}
        />
      </div>
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.actions}>
        <button className={`${styles.small} ${styles.primary}`} disabled={busy} onClick={save}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save details'}
        </button>
      </div>
    </div>
  )
}

// 2c. The routine tests
function TestsPart({
  client,
  staffId,
  patientId,
  tests,
  onDone,
}: PartProps & { tests: AntenatalTest[] }) {
  const [adding, setAdding] = useState(false)
  const [test, setTest] = useState('pcv')
  const [result, setResult] = useState('')
  const [testedOn, setTestedOn] = useState(today())
  const [problem, setProblem] = useState<string | null>(null)
  async function add() {
    if (!result.trim()) {
      setProblem('Type the result.')
      return
    }
    const answer = await addLine(client, 'antenatal_tests', {
      patient_id: patientId,
      test,
      result: result.trim(),
      tested_on: testedOn || null,
      recorded_by: staffId,
    })
    setProblem(answer)
    if (!answer) {
      setAdding(false)
      setResult('')
      onDone()
    }
  }
  return (
    <div className={styles.form}>
      <b>Routine tests</b>
      {tests.length === 0 ? <EmptyLine text="No tests recorded yet." /> : null}
      {tests.map((line) => (
        <Line
          key={line.id}
          what={
            <>
              <b>{testWords(line.test)}</b>: {line.result}
            </>
          }
          meta={`Done ${dateWords(line.tested_on)} · recorded by ${line.recorder?.full_name ?? 'staff'}`}
          voided={voidedOf(line)}
          voidable={{ client, table: 'antenatal_tests', id: line.id, staffId, onDone }}
        />
      ))}
      {adding ? (
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="an-test">Test</label>
            <select
              id="an-test"
              className={styles.input}
              value={test}
              onChange={(event) => setTest(event.target.value)}
            >
              {TEST_WORDS.map(([key, words]) => (
                <option key={key} value={key}>
                  {words}
                </option>
              ))}
            </select>
          </div>
          <Field id="an-result" label="Result" value={result} onChange={setResult} />
          <Field
            id="an-tested-on"
            label="Date done"
            type="date"
            value={testedOn}
            onChange={setTestedOn}
          />
        </div>
      ) : null}
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.actions}>
        {adding ? (
          <>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Save test
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Add a test result
          </button>
        )}
      </div>
    </div>
  )
}

// 2d. Previous pregnancies, and the baby if it died
function PregnanciesPart({
  client,
  staffId,
  patientId,
  pregnancies,
  onDone,
}: PartProps & { pregnancies: Pregnancy[] }) {
  const empty = {
    born_on: '',
    duration: '',
    birth_weight: '',
    delivery_method: '',
    baby_sex: '',
    age_at_death: '',
    cause_of_death: '',
  }
  const [adding, setAdding] = useState(false)
  const [values, setValues] = useState(empty)
  const [died, setDied] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const set = (key: keyof typeof empty) => (value: string) =>
    setValues((now) => ({ ...now, [key]: value }))
  async function add() {
    const answer = await addLine(client, 'previous_pregnancies', {
      patient_id: patientId,
      born_on: values.born_on || null,
      duration: values.duration.trim() || null,
      birth_weight: values.birth_weight.trim() || null,
      delivery_method: values.delivery_method.trim() || null,
      baby_sex: values.baby_sex || null,
      baby_died: died,
      age_at_death: died ? values.age_at_death.trim() || null : null,
      cause_of_death: died ? values.cause_of_death.trim() || null : null,
      recorded_by: staffId,
    })
    setProblem(answer)
    if (!answer) {
      setAdding(false)
      setValues(empty)
      setDied(false)
      onDone()
    }
  }
  return (
    <div className={styles.form}>
      <b>Previous pregnancies</b>
      {pregnancies.length === 0 ? <EmptyLine text="None recorded yet." /> : null}
      {pregnancies.map((line, at) => (
        <Line
          key={line.id}
          what={
            <>
              <b>
                Pregnancy {at + 1}
                {line.born_on ? `, born ${dateWords(line.born_on)}` : ''}
              </b>
              <br />
              <span className={styles.muted}>
                {[
                  line.duration,
                  line.birth_weight,
                  line.delivery_method,
                  line.baby_sex === 'male' ? 'Male' : line.baby_sex === 'female' ? 'Female' : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No details'}
              </span>
              {line.baby_died ? (
                <>
                  <br />
                  <span className={styles.muted}>
                    Baby died{line.age_at_death ? `: ${line.age_at_death}` : ''}
                    {line.cause_of_death ? `, ${line.cause_of_death}` : ''}
                  </span>
                </>
              ) : null}
            </>
          }
          status={
            line.baby_died ? (
              <span className={`${styles.pill} ${styles.grey}`}>Not alive</span>
            ) : null
          }
          meta={`Recorded by ${line.recorder?.full_name ?? 'staff'}, ${when(line.created_at)}`}
          voided={voidedOf(line)}
          voidable={{ client, table: 'previous_pregnancies', id: line.id, staffId, onDone }}
        />
      ))}
      {adding ? (
        <>
          <div className={styles.fields}>
            <Field
              id="pp-born"
              label="Date of birth"
              type="date"
              value={values.born_on}
              onChange={set('born_on')}
            />
            <Field
              id="pp-duration"
              label="Duration of pregnancy"
              placeholder="e.g. Term"
              value={values.duration}
              onChange={set('duration')}
            />
            <Field
              id="pp-weight"
              label="Birth weight"
              placeholder="e.g. 3.2 kg"
              value={values.birth_weight}
              onChange={set('birth_weight')}
            />
            <Field
              id="pp-method"
              label="Method of delivery"
              placeholder="e.g. SVD"
              value={values.delivery_method}
              onChange={set('delivery_method')}
            />
            <div className={styles.field}>
              <label htmlFor="pp-sex">Sex</label>
              <select
                id="pp-sex"
                className={styles.input}
                value={values.baby_sex}
                onChange={(event) => set('baby_sex')(event.target.value)}
              >
                <option value="">Not given</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={died}
              onChange={(event) => setDied(event.target.checked)}
            />
            The baby died
          </label>
          {died ? (
            <div className={styles.fields}>
              <Field
                id="pp-age-death"
                label="Age at death"
                placeholder="e.g. Stillbirth"
                value={values.age_at_death}
                onChange={set('age_at_death')}
              />
              <Field
                id="pp-cause"
                label="Cause of death"
                value={values.cause_of_death}
                onChange={set('cause_of_death')}
              />
            </div>
          ) : null}
        </>
      ) : null}
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.actions}>
        {adding ? (
          <>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Save pregnancy
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Add a previous pregnancy
          </button>
        )}
      </div>
    </div>
  )
}

// ===== 3. Consent for an operation (every patient) =====
export function ConsentSection({ client, staffId, patientId }: Props) {
  const [consents, setConsents] = useState<Consent[] | null>(null)
  const load = useCallback(
    async () => setConsents(await loadConsents(client, patientId)),
    [client, patientId],
  )
  useEffect(() => {
    // First read straight after the screen shows, then again whenever
    // anybody saves something (request 157).
    const first = window.setTimeout(() => void load(), 0)
    const stop = onChange(client, 'records', () => void load())
    return () => {
      window.clearTimeout(first)
      stop()
    }
  }, [client, load])

  const empty = {
    consenting_name: '',
    operation: '',
    relationship: '',
    address: '',
    witness_name: '',
  }
  const [adding, setAdding] = useState(false)
  const [values, setValues] = useState(empty)
  const [ticked, setTicked] = useState(false)
  const [witnessTicked, setWitnessTicked] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const set = (key: keyof typeof empty) => (value: string) =>
    setValues((now) => ({ ...now, [key]: value }))

  async function add() {
    if (values.consenting_name.trim().length < 2 || values.operation.trim().length < 2) {
      setProblem('Type the name of the person giving consent, and the operation.')
      return
    }
    if (!ticked) {
      setProblem('Tick the consent box. It stands for the signature.')
      return
    }
    const witness = values.witness_name.trim()
    if (witness && !witnessTicked) {
      setProblem('Tick the witness box, or leave the witness name empty.')
      return
    }
    const answer = await addLine(client, 'operation_consents', {
      patient_id: patientId,
      consenting_name: values.consenting_name.trim(),
      operation: values.operation.trim(),
      relationship: values.relationship.trim() || null,
      address: values.address.trim() || null,
      consent_ticked: true,
      consented_on: today(),
      witness_name: witness || null,
      witness_ticked: Boolean(witness) && witnessTicked,
      witnessed_on: witness ? today() : null,
      recorded_by: staffId,
    })
    setProblem(answer)
    if (!answer) {
      setAdding(false)
      setValues(empty)
      setTicked(false)
      setWitnessTicked(false)
      void load()
    }
  }

  return (
    <Section
      title="Consent for an operation"
      count={(consents ?? []).filter((one) => !one.voided_at).length}
    >
      {consents && consents.length === 0 ? <EmptyLine text="No consent recorded." /> : null}
      {(consents ?? []).map((line) => (
        <Line
          key={line.id}
          what={
            <>
              <b>{line.operation}</b>
              <br />
              <span className={styles.muted}>
                {line.consenting_name}
                {line.relationship ? ` (${line.relationship})` : ''} gave permission,{' '}
                {dateWords(line.consented_on)}
                {line.witness_name
                  ? ` · witness ${line.witness_name}, ${dateWords(line.witnessed_on)}`
                  : ''}
              </span>
            </>
          }
          status={<span className={`${styles.pill} ${styles.green}`}>Consented</span>}
          meta={`Recorded by ${line.recorder?.full_name ?? 'staff'}, ${when(line.created_at)}`}
          voided={voidedOf(line)}
          voidable={{
            client,
            table: 'operation_consents',
            id: line.id,
            staffId,
            onDone: () => void load(),
          }}
        />
      ))}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.fields}>
            <Field
              id="oc-name"
              label="Name of the person giving consent"
              value={values.consenting_name}
              onChange={set('consenting_name')}
            />
            <Field
              id="oc-operation"
              label="Operation"
              placeholder="e.g. Caesarean section"
              value={values.operation}
              onChange={set('operation')}
            />
            <Field
              id="oc-relationship"
              label="Relationship to patient"
              placeholder="e.g. Self, Husband"
              value={values.relationship}
              onChange={set('relationship')}
            />
            <Field
              id="oc-address"
              label="Address"
              value={values.address}
              onChange={set('address')}
            />
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={ticked}
              onChange={(event) => setTicked(event.target.checked)}
            />
            I give permission for this operation, and leave the extent of the surgery and
            anaesthesia to the discretion of the doctor. (Today, {dateWords(today())})
          </label>
          <div className={styles.fields}>
            <Field
              id="oc-witness"
              label="Witness name (optional)"
              value={values.witness_name}
              onChange={set('witness_name')}
            />
          </div>
          {values.witness_name.trim() ? (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={witnessTicked}
                onChange={(event) => setWitnessTicked(event.target.checked)}
              />
              I witnessed this consent. (Today, {dateWords(today())})
            </label>
          ) : null}
        </div>
      ) : null}
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.actions}>
        {adding ? (
          <>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Save consent
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Record a consent
          </button>
        )}
      </div>
    </Section>
  )
}
