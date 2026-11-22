/*
 * app/patients/record/sheet/page.tsx: the ward's two sheets, full page: the
 * treatment sheet and the vital signs sheet (?p=12&s=drugs or &s=vitals).
 *
 * Why: Anthony, 2026-11-17 (request 224), from the ward's own paper sheets:
 * nurses want "their own... in form of a spreadsheet", free to type or to
 * pick. The treatment sheet has Time, Drug or fluid, Dose, Route and Sign,
 * with the ward's events (Blood connected...) shown in red as on paper. The
 * vital signs sheet has Time, Temp, Pulse, Resp, BP, SpO2 and Sign. A
 * line's time is when it is saved, by the database's clock (request 225:
 * the internet's time, not the device's), unless the nurse changes it. Sign
 * is the person signed in, with their room: nobody picks a name (request
 * 225: "the system keeps the audit trail for who did what").
 *
 * How it goes:
 *   1. Under the headings, the new line is empty, ready to fill in. Pick or
 *      type each box.
 *   2. Save: the line joins the sheet with the time and the name. On the
 *      treatment sheet, "+ Add another row" adds rows, saved together
 *      (request 227b); unsaved rows are kept 30 minutes (227j).
 *   3. Every line follows, newest first, by day, so a reading today sits
 *      above yesterday's and the change shows at a glance.
 *
 * Never: change a saved line (a wrong one is voided on the record page with
 * a reason), or let anybody but clinical staff in.
 */
'use client'

import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import { inputNow } from '@/lib/time/serverTime'
import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './sheet.module.css'
import { useRecord } from '../_parts/useRecord'
import AppShell from '@/components/shell/AppShell'
import OptionSelect from '@/components/options/OptionSelect'
import SearchSelect, { type SelectOption } from '@/components/options/SearchSelect'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'
import {
  groupMedicines,
  knownMedicines,
  loadMedicines,
  medicineWords,
} from '@/lib/medicines/medicines'
import { addLine, type MedicalRecord } from '@/lib/record/record'
import { ROUTES, WARD_EVENTS } from '@/lib/record/signers'
import { useDraft } from '@/lib/drafts/drafts'
import DraftBack from '@/components/drafts/DraftBack'

// ===== 1. Small helpers =====
// "now" in the form a time box expects, from the internet's time, not the
// device's clock (request 225).
const localNow = inputNow
const dayWords = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
const timeWords = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  })

// Lines grouped by day, newest day first.
function byDay<T>(lines: T[], when: (line: T) => string): [string, T[]][] {
  const days = new Map<string, T[]>()
  for (const line of lines) {
    const day = dayWords(when(line))
    days.set(day, [...(days.get(day) ?? []), line])
  }
  return [...days.entries()]
}

// ===== 2. The page =====
function Sheet() {
  const auth = useAuth()
  useRightPage(auth.status, '/patients/record/sheet/')
  const params = useSearchParams()
  const id = Number(params.get('p')) || null
  const tab = params.get('s') === 'vitals' ? 'vitals' : 'drugs'
  const { client, staff } = auth
  const allowed = Boolean(staff?.can_medical)
  const { patient, record, savedAt, refused, reload } = useRecord(
    client,
    staff?.id ?? null,
    id,
    allowed,
  )
  if (auth.status !== 'ready' || !client || !staff) return null
  // Who signs every line: the person signed in, with their room (225).
  const me = staff.room ? `${staff.full_name} · ${staff.room.name}` : staff.full_name

  return (
    <AppShell>
      <div className={styles.page}>
        {/* ----- The patient, the two sheets, back to the record ----- */}
        <div className={styles.head}>
          <div>
            <h2>{tab === 'vitals' ? 'Vital signs sheet' : 'Treatment sheet'}</h2>
            {patient ? (
              <small>
                {patient.full_name} · {patient.patient_number}
              </small>
            ) : null}
          </div>
          <Link className={styles.button} href={`/patients/record/?p=${id}`}>
            Back to the record
          </Link>
        </div>
        <div className={styles.tabs} role="tablist">
          <Link
            role="tab"
            aria-selected={tab === 'drugs'}
            href={`/patients/record/sheet/?p=${id}&s=drugs`}
            replace
          >
            Treatment
          </Link>
          <Link
            role="tab"
            aria-selected={tab === 'vitals'}
            href={`/patients/record/sheet/?p=${id}&s=vitals`}
            replace
          >
            Vital signs
          </Link>
        </div>
        {savedAt ? (
          <p className={styles.offline}>
            No network. This is the copy kept on this device at{' '}
            {timeWords(new Date(savedAt).toISOString())}.
          </p>
        ) : null}

        {!allowed ? <p className={styles.muted}>Only clinical staff open the sheets.</p> : null}
        {refused ? (
          <p className={styles.muted}>This record could not be opened. Try again.</p>
        ) : null}
        {allowed && !record && !refused ? (
          <p className={styles.muted}>Opening the record…</p>
        ) : null}

        {record && id && tab === 'drugs' ? (
          <TreatmentSheet
            client={client}
            staffId={staff.id}
            patientId={id}
            record={record}
            me={me}
            reload={reload}
          />
        ) : null}
        {record && id && tab === 'vitals' ? (
          <VitalsSheet
            client={client}
            staffId={staff.id}
            patientId={id}
            record={record}
            me={me}
            reload={reload}
          />
        ) : null}
      </div>
    </AppShell>
  )
}

type SheetProps = {
  client: SupabaseClient
  staffId: string
  patientId: number
  record: MedicalRecord
  // Who signs: the person signed in, and their room (request 225).
  me: string
  reload: () => void
}

// ===== 3. The treatment sheet =====
// One table, like the ward's paper sheet: the headings, the new line to fill
// in, then every line written, newest first, by day (request 225: "as time
// goes on... they are supposed to add").
function TreatmentSheet({ client, staffId, patientId, record, me, reload }: SheetProps) {
  // One entry row; "+ Add another row" adds more, saved together (request
  // 227b, 2026-11-18: "a place where they can add plus to add another row").
  // time null: the time is when Save is tapped (the database's clock). A
  // value: changed by hand.
  type Entry = {
    key: number
    drug: string
    dose: string
    route: string
    medicationId: number | null
    time: string | null
  }
  const blank = (key: number): Entry => ({
    key,
    drug: '',
    dose: '',
    route: '',
    medicationId: null,
    time: null,
  })
  const [entries, setEntries] = useState<Entry[]>([blank(0)])
  const [nextKey, setNextKey] = useState(1)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [medicines, setMedicines] = useState(() => knownMedicines(staffId))
  useEffect(() => {
    void loadMedicines(client, staffId).then((fresh) => fresh && setMedicines(fresh))
  }, [client, staffId])

  // Unsaved rows, kept 30 minutes on this device (request 227j).
  const draft = useDraft({
    staffId,
    name: `sheet-drugs-${patientId}`,
    value: entries,
    isEmpty: (rows) => rows.every((row) => !row.drug.trim() && !row.time),
    restore: (rows) => {
      if (!rows.length) return
      setEntries(rows)
      setNextKey(Math.max(...rows.map((row) => row.key)) + 1)
    },
  })

  // On the chart first, then the ward's events, then the medicine list.
  const charted = record.medications.filter((m) => !m.voided_at && m.status === 'active')
  const options = useMemo<SelectOption[]>(() => {
    const chart = charted.map((m) => ({
      value: m.medicine,
      label: m.medicine,
      group: 'On the chart',
      note: [m.dose, m.route].filter(Boolean).join(' · ') || undefined,
    }))
    const events = WARD_EVENTS.map((event) => ({
      value: event,
      label: event,
      group: 'Ward events',
    }))
    const list = groupMedicines(medicines.filter((m) => m.kind === 'medicine')).flatMap((name) =>
      name.strengths.map((one) => {
        const words = medicineWords(name.name, one.strength ?? '')
        return { value: words, label: words, group: 'Medicine list' }
      }),
    )
    return [...chart, ...events, ...list]
  }, [charted, medicines])

  // Change one row, by its key.
  function change(key: number, part: Partial<Entry>) {
    setEntries((rows) => rows.map((row) => (row.key === key ? { ...row, ...part } : row)))
  }

  function choose(row: Entry, drug: string) {
    const fromChart = charted.find((m) => m.medicine === drug)
    change(row.key, {
      drug,
      medicationId: fromChart?.id ?? null,
      dose: fromChart?.dose ?? row.dose,
      route: fromChart?.route ?? row.route,
    })
  }

  // Save every filled row, top to bottom. A row that fails stays, so
  // nothing typed is lost; the saved ones go.
  async function save() {
    const filled = entries.filter((row) => row.drug.trim() || row.dose.trim() || row.time)
    if (filled.length === 0 || filled.some((row) => row.drug.trim().length < 2)) {
      setProblem('Choose or type the drug, fluid or event on each row.')
      return
    }
    setBusy(true)
    setProblem(null)
    const left: Entry[] = []
    let failure: string | null = null
    for (const row of filled) {
      // Who: the person signed in, always (request 225). When: the
      // database's clock, unless the time was changed by hand.
      const result = await addLine(client, 'medications_given', {
        patient_id: patientId,
        medication_id: row.medicationId,
        medicine: row.drug.trim(),
        dose: row.dose.trim() || null,
        route: row.route.trim() || null,
        ...(row.time ? { given_at: new Date(row.time).toISOString() } : {}),
        given_by: staffId,
      })
      if (result) {
        left.push(row)
        failure = result
      }
    }
    setBusy(false)
    reload()
    if (left.length) {
      setEntries(left)
      setProblem(failure)
      return
    }
    setEntries([blank(nextKey)])
    setNextKey(nextKey + 1)
    draft.clear()
  }

  const lines = record.doses.filter((dose) => !dose.voided_at)

  return (
    <section className={styles.table} aria-label="Treatment sheet">
      <div className={`${styles.row} ${styles.drugRow} ${styles.headRow}`} role="row">
        <span>Time</span>
        <span>Drug, fluid or event</span>
        <span>Dose</span>
        <span>Route</span>
        <span>Sign</span>
      </div>

      {/* ----- The new rows ----- */}
      {draft.restoredAt ? (
        <DraftBack
          savedAt={draft.restoredAt}
          what="treatment sheet"
          onContinue={draft.keep}
          onDiscard={() => {
            setEntries([blank(nextKey)])
            setNextKey(nextKey + 1)
            draft.clear()
          }}
        />
      ) : null}
      {entries.map((row, at) => (
        <div
          key={row.key}
          className={`${styles.row} ${styles.drugRow} ${styles.entryRow}`}
          role="row"
        >
          <div className={styles.cell}>
            <span className={styles.label}>Time</span>
            {row.time === null ? (
              <button
                type="button"
                className={styles.timeNow}
                onClick={() => change(row.key, { time: localNow() })}
              >
                Now
              </button>
            ) : (
              <input
                type="datetime-local"
                className={styles.input}
                aria-label={`Time, row ${at + 1}`}
                max={localNow()}
                value={row.time}
                onChange={(event) => change(row.key, { time: event.target.value })}
              />
            )}
          </div>
          <div className={styles.cell}>
            <label className={styles.label} htmlFor={`sheet-drug-${row.key}`}>
              Drug, fluid or event
            </label>
            <SearchSelect
              id={`sheet-drug-${row.key}`}
              value={row.drug}
              placeholder="Pick or type"
              options={options}
              // Always a search box, so a nurse can type straight away.
              searchFrom={0}
              onChange={(drug) => choose(row, drug)}
              onOther={(typed) => typed && change(row.key, { drug: typed, medicationId: null })}
            />
          </div>
          <div className={styles.cell}>
            <label className={styles.label} htmlFor={`sheet-dose-${row.key}`}>
              Dose
            </label>
            <OptionSelect
              client={client}
              staffId={staffId}
              list="dose"
              id={`sheet-dose-${row.key}`}
              value={row.dose}
              onChange={(dose) => change(row.key, { dose })}
              placeholder="Pick or type"
              otherLabel="Type the dose"
            />
          </div>
          <div className={styles.cell}>
            <label className={styles.label} htmlFor={`sheet-route-${row.key}`}>
              Route
            </label>
            <SearchSelect
              id={`sheet-route-${row.key}`}
              value={row.route}
              placeholder="IV, IM…"
              options={ROUTES.map((route) => ({ value: route, label: route }))}
              searchFrom={0}
              onChange={(route) => change(row.key, { route })}
              onOther={(typed) => typed && change(row.key, { route: typed })}
            />
          </div>
          <div className={styles.cell}>
            <span className={styles.label}>Sign</span>
            <span className={styles.me}>{me}</span>
            {entries.length > 1 ? (
              <button
                type="button"
                className={`${styles.button} ${styles.removeRow}`}
                onClick={() => setEntries(entries.filter((one) => one.key !== row.key))}
              >
                Remove row
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <div className={styles.entryFoot}>
        {problem ? <p className={styles.error}>{problem}</p> : <span />}
        <div className={styles.entryButtons}>
          <button
            type="button"
            className={styles.button}
            disabled={entries.length >= 20}
            onClick={() => {
              setEntries([...entries, blank(nextKey)])
              setNextKey(nextKey + 1)
            }}
          >
            + Add another row
          </button>
          {entries.some((row) => row.drug || row.time || row.dose) ? (
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setEntries([blank(nextKey)])
                setNextKey(nextKey + 1)
                setProblem(null)
                draft.clear()
              }}
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            disabled={busy}
            onClick={save}
          >
            {busy ? 'Saving…' : entries.length > 1 ? `Save ${entries.length} lines` : 'Save line'}
          </button>
        </div>
      </div>

      {/* ----- Every line written, newest first, by day ----- */}
      {lines.length === 0 ? <p className={styles.none}>Nothing written yet.</p> : null}
      {byDay(lines, (dose) => dose.given_at).map(([day, rows]) => (
        <div key={day} role="rowgroup">
          <div className={styles.dayRow}>{day}</div>
          {rows.map((dose) => {
            const event = WARD_EVENTS.includes(dose.medicine)
            return (
              <div key={dose.id} className={`${styles.row} ${styles.drugRow}`} role="row">
                <span className={styles.time}>{timeWords(dose.given_at)}</span>
                <span className={event ? styles.event : styles.strong}>{dose.medicine}</span>
                <span className={dose.not_given_reason ? styles.event : undefined}>
                  {dose.not_given_reason
                    ? `Not given: ${dose.not_given_reason}`
                    : (dose.dose ?? '')}
                </span>
                <span>{dose.route ?? ''}</span>
                <span>{dose.signer?.full_name ?? dose.giver?.full_name ?? 'Staff'}</span>
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}

// ===== 4. The vital signs sheet =====
// The same: headings, the new line, then every reading, newest first, so a
// change from yesterday to today shows at a glance.
function VitalsSheet({ client, staffId, patientId, record, me, reload }: SheetProps) {
  const empty: Record<string, string> = {}
  const [values, setValues] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const KEYS = [
    'temperature_c',
    'pulse',
    'breathing_rate',
    'systolic',
    'diastolic',
    'spo2',
    'pain_score',
  ]
  // Unsaved readings, kept 30 minutes on this device (request 227j).
  const draft = useDraft({
    staffId,
    name: `sheet-vitals-${patientId}`,
    value: values,
    isEmpty: (typed) => Object.values(typed).every((one) => !String(one).trim()),
    restore: setValues,
  })

  async function save() {
    const numbers: Record<string, number> = {}
    for (const key of KEYS) {
      const typed = (values[key] ?? '').trim()
      if (!typed) continue
      const number = Number(typed.replace(',', '.'))
      if (Number.isNaN(number)) {
        setProblem('Type numbers only, like 36.5.')
        return
      }
      numbers[key] = number
    }
    // Blood glucose (request 235): the number, fasting or random, the unit.
    const sugar = (values.glucose ?? '').trim()
    const glucose: Record<string, string | number> = {}
    if (sugar) {
      const number = Number(sugar.replace(',', '.'))
      if (Number.isNaN(number)) {
        setProblem('Type numbers only, like 5.4.')
        return
      }
      if (!values.glucose_when) {
        setProblem('Choose fasting or random for the blood glucose.')
        return
      }
      glucose.blood_glucose = number
      glucose.glucose_when = values.glucose_when
      glucose.glucose_unit = values.glucose_unit || 'mmol/L'
    }
    if (Object.keys(numbers).length === 0 && !sugar) {
      setProblem('Type at least one reading.')
      return
    }
    setBusy(true)
    setProblem(null)
    // Who and when: the person signed in, and the database's clock (225).
    const result = await addLine(client, 'vital_signs', {
      patient_id: patientId,
      ...numbers,
      ...glucose,
      recorded_by: staffId,
    })
    setBusy(false)
    if (result) {
      setProblem(result)
      return
    }
    setValues(empty)
    draft.clear()
    reload()
  }

  const rows = record.vitals.filter((vitals) => !vitals.voided_at)
  // example: shown greyed as "e.g. 36.5"; words (Top, Bottom) as they are.
  const box = (key: string, label: string, example: string) => (
    <input
      id={`vital-${key}`}
      aria-label={label}
      className={styles.input}
      inputMode="decimal"
      placeholder={/\d/.test(example) ? `e.g. ${example}` : example}
      value={values[key] ?? ''}
      onChange={(event) =>
        setValues({ ...values, [key]: event.target.value.replace(/[^\d.,]/g, '') })
      }
    />
  )
  const cell = (key: string, label: string, example: string) => (
    <div className={styles.cell}>
      <span className={styles.label}>{label}</span>
      {box(key, label, example)}
    </div>
  )

  return (
    <section className={styles.table} aria-label="Vital signs sheet">
      <div className={`${styles.row} ${styles.vitalRow} ${styles.headRow}`} role="row">
        <span>Time</span>
        <span>Glucose</span>
        <span>Temp °C</span>
        <span>Pulse</span>
        <span>Resp</span>
        <span>BP</span>
        <span>SpO₂ %</span>
        <span>Pain</span>
        <span>Sign</span>
      </div>

      {/* ----- The new line ----- */}
      <div className={`${styles.row} ${styles.vitalRow} ${styles.entryRow}`} role="row">
        <div className={styles.cell}>
          <span className={styles.label}>Time</span>
          <span className={styles.timeNow}>Now</span>
        </div>
        {/* Blood glucose first (request 235): the number, then fasting or
            random and the unit (mmol/L, the UK one, unless changed). */}
        <div className={styles.cell}>
          <span className={styles.label}>Glucose</span>
          {box('glucose', 'Blood glucose', '5.4')}
          <div className={styles.glucosePicks}>
            <select
              aria-label="Fasting or random"
              className={styles.input}
              value={values.glucose_when ?? ''}
              onChange={(event) => setValues({ ...values, glucose_when: event.target.value })}
            >
              <option value="">Choose</option>
              <option value="fasting">Fasting</option>
              <option value="random">Random</option>
            </select>
            <select
              aria-label="Glucose unit"
              className={styles.input}
              value={values.glucose_unit || 'mmol/L'}
              onChange={(event) => setValues({ ...values, glucose_unit: event.target.value })}
            >
              <option value="mmol/L">mmol/L</option>
              <option value="mg/dL">mg/dL</option>
            </select>
          </div>
        </div>
        {cell('temperature_c', 'Temp °C', '36.5')}
        {cell('pulse', 'Pulse', '88')}
        {cell('breathing_rate', 'Resp', '20')}
        <div className={styles.cell}>
          <span className={styles.label}>BP</span>
          <div className={styles.bp}>
            {box('systolic', 'BP top', 'Top')}
            <span aria-hidden="true">/</span>
            {box('diastolic', 'BP bottom', 'Bottom')}
          </div>
        </div>
        {cell('spo2', 'SpO₂ %', '98')}
        {cell('pain_score', 'Pain (0 to 10)', '0')}
        <div className={styles.cell}>
          <span className={styles.label}>Sign</span>
          <span className={styles.me}>{me}</span>
        </div>
      </div>
      <div className={styles.entryFoot}>
        {problem ? <p className={styles.error}>{problem}</p> : <span />}
        <div className={styles.entryButtons}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            disabled={busy}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save readings'}
          </button>
        </div>
      </div>

      {/* ----- Every reading, newest first, by day ----- */}
      {rows.length === 0 ? <p className={styles.none}>No readings yet.</p> : null}
      {byDay(rows, (vitals) => vitals.recorded_at).map(([day, dayRows]) => (
        <div key={day} role="rowgroup">
          <div className={styles.dayRow}>{day}</div>
          {dayRows.map((vitals) => (
            <div key={vitals.id} className={`${styles.row} ${styles.vitalRow}`} role="row">
              <span className={styles.time}>{timeWords(vitals.recorded_at)}</span>
              {/* The number and unit, then Fasting or Random under it (235). */}
              <span className={styles.glucose}>
                {vitals.blood_glucose !== null && vitals.blood_glucose !== undefined ? (
                  <>
                    {vitals.blood_glucose} {vitals.glucose_unit ?? ''}
                    <small>{vitals.glucose_when === 'fasting' ? 'Fasting' : 'Random'}</small>
                  </>
                ) : (
                  ''
                )}
              </span>
              <span>{vitals.temperature_c !== null ? `${vitals.temperature_c}°C` : ''}</span>
              <span>{vitals.pulse !== null ? `${vitals.pulse} bpm` : ''}</span>
              <span>{vitals.breathing_rate !== null ? `${vitals.breathing_rate}/min` : ''}</span>
              <span>
                {vitals.systolic !== null || vitals.diastolic !== null
                  ? `${vitals.systolic ?? '?'}/${vitals.diastolic ?? '?'}`
                  : ''}
              </span>
              <span>{vitals.spo2 !== null ? `${vitals.spo2}%` : ''}</span>
              <span>
                {vitals.pain_score !== null && vitals.pain_score !== undefined
                  ? `${vitals.pain_score}/10`
                  : ''}
              </span>
              <span>{vitals.signer?.full_name ?? vitals.recorder?.full_name ?? 'Staff'}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

export default function SheetPage() {
  return (
    <Suspense fallback={null}>
      <Sheet />
    </Suspense>
  )
}
