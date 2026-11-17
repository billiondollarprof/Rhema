/*
 * app/patients/record/sheet/page.tsx: the ward's two sheets, full page: the
 * treatment sheet and the vital signs sheet (?p=12&s=drugs or &s=vitals).
 *
 * Why: Anthony, 2026-11-17 (request 224), from the ward's own paper sheets:
 * nurses want "their own... in form of a spreadsheet", free to type or to
 * pick. The treatment sheet has Time, Drug or fluid, Dose, Route and Sign,
 * with the ward's events (Blood connected...) shown in red as on paper. The
 * vital signs sheet has Time, Temp, Pulse, Resp, BP, SpO2 and Sign. "The
 * time... automatically updates": a line's time is when it is saved, unless
 * the nurse changes it. "The nurse can enter their name from a picker that
 * contains only nurses."
 *
 * How it goes:
 *   1. The top line is empty, ready to fill in. Pick or type each box.
 *   2. Save: the line goes into the sheet with the time and the name.
 *   3. The sheet lists every line, newest first, by day.
 *
 * The person signed in is still recorded as the one who typed it; the
 * name picked is the nurse who did it (signed_by). The database checks both.
 *
 * Never: change a saved line (a wrong one is voided on the record page with
 * a reason), or let anybody but clinical staff in.
 */
'use client'

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
import {
  knownSigners,
  loadSigners,
  nurseOptions,
  ROUTES,
  WARD_EVENTS,
  type Signer,
} from '@/lib/record/signers'

// ===== 1. Small helpers =====
// "now" in the form a time box expects (local time, to the minute).
function localNow() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}
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
  const [signers, setSigners] = useState<Signer[]>(() => (staff ? knownSigners(staff.id) : []))
  useEffect(() => {
    if (client && staff) void loadSigners(client, staff.id).then(setSigners)
  }, [client, staff])

  if (auth.status !== 'ready' || !client || !staff) return null

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
            signers={signers}
            reload={reload}
          />
        ) : null}
        {record && id && tab === 'vitals' ? (
          <VitalsSheet
            client={client}
            staffId={staff.id}
            patientId={id}
            record={record}
            signers={signers}
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
  signers: Signer[]
  reload: () => void
}

// The signer list, with the person signed in first when they are a nurse.
function useSignerList(signers: Signer[], staffId: string) {
  return useMemo(() => {
    const list = nurseOptions(signers)
    const me = list.find((option) => option.value === staffId)
    return me ? [me, ...list.filter((option) => option !== me)] : list
  }, [signers, staffId])
}

// ===== 3. The treatment sheet =====
function TreatmentSheet({ client, staffId, patientId, record, signers, reload }: SheetProps) {
  const nurses = useSignerList(signers, staffId)
  const empty = { drug: '', dose: '', route: '', signer: '', medicationId: null as number | null }
  const [line, setLine] = useState(empty)
  // null: the time is now, when Save is tapped. A value: changed by hand.
  const [time, setTime] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [medicines, setMedicines] = useState(() => knownMedicines(staffId))
  useEffect(() => {
    void loadMedicines(client, staffId).then((fresh) => fresh && setMedicines(fresh))
  }, [client, staffId])
  const signer = line.signer || (nurses.some((n) => n.value === staffId) ? staffId : '')

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
    if (!signer) {
      setProblem('Choose the nurse who gave it.')
      return
    }
    setBusy(true)
    setProblem(null)
    const result = await addLine(client, 'medications_given', {
      patient_id: patientId,
      medication_id: line.medicationId,
      medicine: line.drug.trim(),
      dose: line.dose.trim() || null,
      route: line.route.trim() || null,
      given_at: time ? new Date(time).toISOString() : new Date().toISOString(),
      given_by: staffId,
      signed_by: signer,
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
    <>
      {/* ----- The empty line to fill in ----- */}
      <section className={styles.entry} aria-label="New line">
        <div className={styles.entryGrid}>
          <div className={styles.cell}>
            <span className={styles.label}>Time</span>
            {time === null ? (
              <button type="button" className={styles.timeNow} onClick={() => setTime(localNow())}>
                Now (tap to change)
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
          <div className={`${styles.cell} ${styles.wide}`}>
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
              placeholder="IV, IM, Oral…"
              options={ROUTES.map((route) => ({ value: route, label: route }))}
              searchFrom={0}
              onChange={(route) => setLine({ ...line, route })}
              onOther={(typed) => typed && setLine({ ...line, route: typed })}
            />
          </div>
          <div className={styles.cell}>
            <label className={styles.label} htmlFor="sheet-signer">
              Sign
            </label>
            <SearchSelect
              id="sheet-signer"
              value={signer}
              placeholder="Choose the nurse"
              options={nurses}
              onChange={(value) => setLine({ ...line, signer: value })}
            />
          </div>
        </div>
        {problem ? <p className={styles.error}>{problem}</p> : null}
        <div className={styles.entryButtons}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            disabled={busy}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save line'}
          </button>
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
        </div>
      </section>

      {/* ----- The sheet ----- */}
      {lines.length === 0 ? <p className={styles.muted}>Nothing written yet.</p> : null}
      {byDay(lines, (dose) => dose.given_at).map(([day, rows]) => (
        <section key={day} className={styles.table} aria-label={day}>
          <h3>{day}</h3>
          <div className={`${styles.row} ${styles.drugRow} ${styles.headRow}`} role="row">
            <span>Time</span>
            <span>Drug, fluid or event</span>
            <span>Dose</span>
            <span>Route</span>
            <span>Sign</span>
          </div>
          {rows.map((dose) => {
            const event = WARD_EVENTS.includes(dose.medicine)
            const signed = dose.signer?.full_name ?? dose.giver?.full_name ?? 'Staff'
            const typedBy =
              dose.signer && dose.giver && dose.signer.full_name !== dose.giver.full_name
                ? dose.giver.full_name
                : null
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
                <span>
                  {signed}
                  {typedBy ? <small> (typed by {typedBy})</small> : null}
                </span>
              </div>
            )
          })}
        </section>
      ))}
    </>
  )
}

// ===== 4. The vital signs sheet =====
const VITAL_BOXES = [
  ['temperature_c', 'Temp °C', '36.5'],
  ['pulse', 'Pulse', '88'],
  ['breathing_rate', 'Resp', '20'],
  ['systolic', 'BP top', '120'],
  ['diastolic', 'BP bottom', '80'],
  ['spo2', 'SpO₂ %', '98'],
] as const

function VitalsSheet({ client, staffId, patientId, record, signers, reload }: SheetProps) {
  const nurses = useSignerList(signers, staffId)
  const empty: Record<string, string> = {}
  const [values, setValues] = useState(empty)
  const [chosenSigner, setChosenSigner] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const signer = chosenSigner || (nurses.some((n) => n.value === staffId) ? staffId : '')

  async function save() {
    const numbers: Record<string, number> = {}
    for (const [key] of VITAL_BOXES) {
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
    if (!signer) {
      setProblem('Choose the nurse who took them.')
      return
    }
    setBusy(true)
    setProblem(null)
    const result = await addLine(client, 'vital_signs', {
      patient_id: patientId,
      ...numbers,
      recorded_by: staffId,
      signed_by: signer,
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

  return (
    <>
      <section className={styles.entry} aria-label="New readings">
        <div className={styles.entryGrid}>
          <div className={styles.cell}>
            <span className={styles.label}>Time</span>
            <span className={styles.timeNow}>Now</span>
          </div>
          {VITAL_BOXES.map(([key, label, example]) => (
            <div key={key} className={styles.cell}>
              <label className={styles.label} htmlFor={`vital-${key}`}>
                {label}
              </label>
              <input
                id={`vital-${key}`}
                className={styles.input}
                inputMode="decimal"
                placeholder={`e.g. ${example}`}
                value={values[key] ?? ''}
                onChange={(event) =>
                  setValues({ ...values, [key]: event.target.value.replace(/[^\d.,]/g, '') })
                }
              />
            </div>
          ))}
          <div className={styles.cell}>
            <label className={styles.label} htmlFor="vital-signer">
              Sign
            </label>
            <SearchSelect
              id="vital-signer"
              value={signer}
              placeholder="Choose the nurse"
              options={nurses}
              onChange={setChosenSigner}
            />
          </div>
        </div>
        {problem ? <p className={styles.error}>{problem}</p> : null}
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
      </section>

      {rows.length === 0 ? <p className={styles.muted}>No readings yet.</p> : null}
      {byDay(rows, (vitals) => vitals.recorded_at).map(([day, dayRows]) => (
        <section key={day} className={styles.table} aria-label={day}>
          <h3>{day}</h3>
          <div className={`${styles.row} ${styles.vitalRow} ${styles.headRow}`} role="row">
            <span>Time</span>
            <span>Temp</span>
            <span>Pulse</span>
            <span>Resp</span>
            <span>BP</span>
            <span>SpO₂</span>
            <span>Sign</span>
          </div>
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
        </section>
      ))}
    </>
  )
}

export default function SheetPage() {
  return (
    <Suspense fallback={null}>
      <Sheet />
    </Suspense>
  )
}
