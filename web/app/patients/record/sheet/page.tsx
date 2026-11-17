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
 *   2. Save: the line joins the sheet with the time and the name.
 *   3. Every line follows, newest first, by day, so a reading today sits
 *      above yesterday's and the change shows at a glance.
 *
 * Never: change a saved line (a wrong one is voided on the record page with
 * a reason), or let anybody but clinical staff in.
 */
'use client'

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

// ===== 1. Small helpers =====
// "now" in the form a time box expects, from the internet's time, not the
// device's clock (request 225).
const localNow = inputNow
const dayWords = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const timeWords = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

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
  const empty = { drug: '', dose: '', route: '', medicationId: null as number | null }
  const [line, setLine] = useState(empty)
  // null: the time is when Save is tapped (the database's clock). A value:
  // changed by hand.
  const [time, setTime] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [medicines, setMedicines] = useState(() => knownMedicines(staffId))
  useEffect(() => {
    void loadMedicines(client, staffId).then((fresh) => fresh && setMedicines(fresh))
  }, [client, staffId])

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

  function choose(drug: string) {
    const fromChart = charted.find((m) => m.medicine === drug)
    setLine({
      ...line,
      drug,
      medicationId: fromChart?.id ?? null,
      dose: fromChart?.dose ?? line.dose,
      route: fromChart?.route ?? line.route,
    })
  }

  async function save() {
    if (line.drug.trim().length < 2) {
      setProblem('Choose or type the drug, fluid or event.')
      return
    }
    setBusy(true)
    setProblem(null)
    // Who: the person signed in, always (request 225). When: the database's
    // clock, unless the time was changed by hand.
    const result = await addLine(client, 'medications_given', {
      patient_id: patientId,
      medication_id: line.medicationId,
      medicine: line.drug.trim(),
      dose: line.dose.trim() || null,
      route: line.route.trim() || null,
      ...(time ? { given_at: new Date(time).toISOString() } : {}),
      given_by: staffId,
    })
    setBusy(false)
    if (result) {
      setProblem(result)
      return
    }
    setLine(empty)
    setTime(null)
    reload()
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

      {/* ----- The new line ----- */}
      <div className={`${styles.row} ${styles.drugRow} ${styles.entryRow}`} role="row">
        <div className={styles.cell}>
          <span className={styles.label}>Time</span>
          {time === null ? (
            <button type="button" className={styles.timeNow} onClick={() => setTime(localNow())}>
              Now
            </button>
          ) : (
            <input
              type="datetime-local"
              className={styles.input}
              aria-label="Time"
              max={localNow()}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          )}
        </div>
        <div className={styles.cell}>
          <label className={styles.label} htmlFor="sheet-drug">
            Drug, fluid or event
          </label>
          <SearchSelect
            id="sheet-drug"
            value={line.drug}
            placeholder="Pick or type"
            options={options}
            // Always a search box, so a nurse can type straight away.
            searchFrom={0}
            onChange={choose}
            onOther={(typed) => typed && setLine({ ...line, drug: typed, medicationId: null })}
          />
        </div>
        <div className={styles.cell}>
          <label className={styles.label} htmlFor="sheet-dose">
            Dose
          </label>
          <OptionSelect
            client={client}
            staffId={staffId}
            list="dose"
            id="sheet-dose"
            value={line.dose}
            onChange={(dose) => setLine({ ...line, dose })}
            placeholder="Pick or type"
            otherLabel="Type the dose"
          />
        </div>
        <div className={styles.cell}>
          <label className={styles.label} htmlFor="sheet-route">
            Route
          </label>
          <SearchSelect
            id="sheet-route"
            value={line.route}
            placeholder="IV, IM…"
            options={ROUTES.map((route) => ({ value: route, label: route }))}
            searchFrom={0}
            onChange={(route) => setLine({ ...line, route })}
            onOther={(typed) => typed && setLine({ ...line, route: typed })}
          />
        </div>
        <div className={styles.cell}>
          <span className={styles.label}>Sign</span>
          <span className={styles.me}>{me}</span>
        </div>
      </div>
      <div className={styles.entryFoot}>
        {problem ? <p className={styles.error}>{problem}</p> : <span />}
        <div className={styles.entryButtons}>
          {line.drug || time ? (
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setLine(empty)
                setTime(null)
                setProblem(null)
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
            {busy ? 'Saving…' : 'Save line'}
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
  const KEYS = ['temperature_c', 'pulse', 'breathing_rate', 'systolic', 'diastolic', 'spo2']

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
    if (Object.keys(numbers).length === 0) {
      setProblem('Type at least one reading.')
      return
    }
    setBusy(true)
    setProblem(null)
    // Who and when: the person signed in, and the database's clock (225).
    const result = await addLine(client, 'vital_signs', {
      patient_id: patientId,
      ...numbers,
      recorded_by: staffId,
    })
    setBusy(false)
    if (result) {
      setProblem(result)
      return
    }
    setValues(empty)
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
        <span>Temp °C</span>
        <span>Pulse</span>
        <span>Resp</span>
        <span>BP</span>
        <span>SpO₂ %</span>
        <span>Sign</span>
      </div>

      {/* ----- The new line ----- */}
      <div className={`${styles.row} ${styles.vitalRow} ${styles.entryRow}`} role="row">
        <div className={styles.cell}>
          <span className={styles.label}>Time</span>
          <span className={styles.timeNow}>Now</span>
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
              <span>{vitals.temperature_c !== null ? `${vitals.temperature_c}°C` : ''}</span>
              <span>{vitals.pulse !== null ? `${vitals.pulse} bpm` : ''}</span>
              <span>{vitals.breathing_rate !== null ? `${vitals.breathing_rate}/min` : ''}</span>
              <span>
                {vitals.systolic !== null || vitals.diastolic !== null
                  ? `${vitals.systolic ?? '?'}/${vitals.diastolic ?? '?'}`
                  : ''}
              </span>
              <span>{vitals.spo2 !== null ? `${vitals.spo2}%` : ''}</span>
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
