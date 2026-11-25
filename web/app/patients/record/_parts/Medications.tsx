/*
 * record/_parts/Medications.tsx: current medications and doses given.
 *
 * Why: the hospital's note ("EMR where the records of their medications
 * they're currently taking is; this is for the nursing station") and
 * Anthony, 2026-10-29: a medicine is active (green), suspended (orange) or
 * stopped (red); every change says who, when and why; each dose given has
 * the exact time and the nurse who gave it.
 *
 * Sections in this file:
 *   1. Medications: the list, Add a medicine, and per medicine: Give dose,
 *      Suspend, Resume, Stop, Void. Adding asks for how many days; the
 *      doses work out from how often (the doctor can change them), and a
 *      doctor, the matron or anybody in a consulting room types the price
 *      of one dose, for the bill (request 240, 2026-11-23). The price fills
 *      in from the drug's standard price; a new one is offered as the
 *      standard after adding (request 247: "the system should be
 *      learning").
 *   2. Doses given: newest first, and Add a dose not on the list.
 *
 * Never: change a medicine's status without a reason, or record a dose in
 * another person's name (the database refuses both).
 */
'use client'

import { inputNow } from '@/lib/time/serverTime'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import MedicinePicker from '@/components/medicines/MedicinePicker'
import OptionSelect from '@/components/options/OptionSelect'
import SearchSelect from '@/components/options/SearchSelect'
import { ROUTES } from '@/lib/record/signers'
import { medicineWords } from '@/lib/medicines/medicines'
import { useAuth } from '@/lib/auth/session'
import { setsPrices } from '@/lib/auth/roles'
import { courseDoses, doseWords, givenCount } from '@/lib/record/doses'
import { loadPrices, priceOf, readAmount, type Price } from '@/lib/prices/prices'
import MakeStandard, { type Candidate } from '@/components/orders/MakeStandard'
import { naira } from '@/lib/lab/lab'
import ReasonForm from './ReasonForm'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import {
  MEDICATION_STATUS,
  addLine,
  changeMedicationStatus,
  editMedication,
  when,
  type MedicalRecord,
  type Medication,
  type MedicationStatus,
} from '@/lib/record/record'

type Props = {
  client: SupabaseClient
  staffId: string
  patientId: number
  record: MedicalRecord
  reload: () => void
}

// "now" in the form a time box expects, from the internet's time, not the
// device's clock (request 225).
const localNow = inputNow

// ===== 1. Medications =====
// bare: shown inside the medication chart, opened in place by "Add,
// suspend or stop a medicine" (Anthony, 2026-11-17, request 221a: "why
// doesn't it open the charts?"), so no card of its own.
export function MedicationsSection({
  client,
  staffId,
  patientId,
  record,
  reload,
  bare = false,
}: Props & { bare?: boolean }) {
  const [adding, setAdding] = useState(false)
  // The medicine and its strength come from the picker.
  const [medicine, setMedicine] = useState('')
  const [strength, setStrength] = useState('')
  const [dose, setDose] = useState('')
  const [howOften, setHowOften] = useState('')
  // IV, IM, Oral... (request 224).
  const [route, setRoute] = useState('')
  // The course and its price (request 240). Doses: typed, else worked out.
  const [days, setDays] = useState('')
  const [typedDoses, setTypedDoses] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  // The price box was typed in: a medicine chosen after does not refill it.
  const [priceTyped, setPriceTyped] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const { staff } = useAuth()
  const prices = staff ? setsPrices(staff) : false
  // The standard prices, read when the form opens (request 247), and the
  // price to offer as standard after adding.
  const [list, setList] = useState<Price[]>([])
  const [toStandard, setToStandard] = useState<Candidate[]>([])
  useEffect(() => {
    if (!adding || !prices) return
    let current = true
    void loadPrices(client).then((found) => {
      if (current && found) setList(found)
    })
    return () => {
      current = false
    }
  }, [adding, prices, client])
  const workedOut = courseDoses(howOften, Number(days) || null)
  const doses = typedDoses ?? (workedOut ? String(workedOut) : '')

  // Active first, then suspended, then stopped, voided last.
  const order: Record<MedicationStatus, number> = { active: 0, suspended: 1, stopped: 2 }
  const sorted = [...record.medications].sort(
    (a, b) =>
      Number(Boolean(a.voided_at)) - Number(Boolean(b.voided_at)) ||
      order[a.status] - order[b.status],
  )
  const live = record.medications.filter((m) => !m.voided_at && m.status !== 'stopped').length

  async function add() {
    if (medicine.trim().length < 2) {
      setProblem('Choose the medicine.')
      return
    }
    const dosePrice = price.trim() ? readAmount(price) : null
    if (price.trim() && dosePrice === null) {
      setProblem('Type the price of one dose in naira, like 2,500, or leave it empty.')
      return
    }
    const result = await addLine(client, 'patient_medications', {
      patient_id: patientId,
      medicine: medicineWords(medicine.trim(), strength.trim()),
      dose: dose.trim() || null,
      route: route.trim() || null,
      how_often: howOften.trim() || null,
      days: Number(days) || null,
      doses: Number(doses) || null,
      ...(prices && dosePrice ? { dose_price: dosePrice } : {}),
      added_by: staffId,
    })
    if (result) setProblem(result)
    else {
      // A price new, or not the standard: offer it as the standard (247).
      const name = medicineWords(medicine.trim(), strength.trim())
      const now = priceOf(list, 'drug', name)
      setToStandard(
        prices && dosePrice && dosePrice !== now
          ? [{ kind: 'drug', item: name, amount: dosePrice, now }]
          : [],
      )
      setPriceTyped(false)
      setAdding(false)
      setMedicine('')
      setStrength('')
      setDose('')
      setRoute('')
      setHowOften('')
      setDays('')
      setTypedDoses(null)
      setPrice('')
      setProblem(null)
      reload()
    }
  }

  const body = (
    <>
      {sorted.length === 0 ? <EmptyLine text="No medicines recorded." /> : null}
      {sorted.map((medication) => (
        <MedicationLine
          key={medication.id}
          medication={medication}
          lastChange={record.statusChanges.find((change) => change.medication_id === medication.id)}
          given={givenCount(medication, record.doses)}
          client={client}
          staffId={staffId}
          patientId={patientId}
          reload={reload}
          canGive={!bare}
        />
      ))}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.fields}>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="med-name">Medicine</label>
              <MedicinePicker
                client={client}
                staffId={staffId}
                id="med-name"
                name={medicine}
                strength={strength}
                onChange={(name, picked) => {
                  setMedicine(name)
                  setStrength(picked)
                  // The drug's standard price fills in, unless one was typed.
                  const known = priceOf(list, 'drug', medicineWords(name, picked))
                  if (!priceTyped) setPrice(known ? String(known) : '')
                }}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="med-dose">Dose</label>
              <OptionSelect
                client={client}
                staffId={staffId}
                list="dose"
                id="med-dose"
                value={dose}
                onChange={setDose}
                placeholder="Choose the dose"
                otherLabel="Type the dose"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="med-route">Route</label>
              <SearchSelect
                id="med-route"
                value={route}
                placeholder="IV, IM, Oral…"
                options={ROUTES.map((one) => ({ value: one, label: one }))}
                onChange={setRoute}
                onOther={(typed) => typed && setRoute(typed)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="med-often">How often</label>
              <OptionSelect
                client={client}
                staffId={staffId}
                list="frequency"
                id="med-often"
                value={howOften}
                onChange={setHowOften}
                placeholder="Choose how often"
                otherLabel="Type how often"
              />
            </div>
            {/* The course (request 240): days, then the doses worked out. */}
            <div className={styles.field}>
              <label htmlFor="med-days">For how many days</label>
              <input
                id="med-days"
                className={styles.input}
                inputMode="numeric"
                placeholder="e.g. 5"
                value={days}
                onChange={(event) => setDays(event.target.value.replace(/\D/g, '').slice(0, 3))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="med-doses">Doses in all</label>
              <input
                id="med-doses"
                className={styles.input}
                inputMode="numeric"
                placeholder="e.g. 10"
                value={doses}
                onChange={(event) =>
                  setTypedDoses(event.target.value.replace(/\D/g, '').slice(0, 4))
                }
              />
            </div>
            {prices ? (
              <div className={styles.field}>
                <label htmlFor="med-price">Price of one dose ₦ (optional)</label>
                <input
                  id="med-price"
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="e.g. 2,500"
                  value={price}
                  onChange={(event) => {
                    setPriceTyped(true)
                    setPrice(event.target.value.replace(/[^\d.,\s]/g, ''))
                  }}
                />
              </div>
            ) : null}
          </div>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Add medicine
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          {/* After adding: "Make these the standard prices?" (request 247). */}
          {toStandard.length ? <MakeStandard client={client} candidates={toStandard} /> : null}
          <button
            className={styles.small}
            onClick={() => {
              setToStandard([])
              setAdding(true)
            }}
          >
            + Add a medicine
          </button>
        </div>
      )}
    </>
  )
  return bare ? (
    <div id="record-medications" className={styles.manage}>
      {body}
    </div>
  ) : (
    <Section title="Current medications" count={live} open id="record-medications">
      {body}
    </Section>
  )
}

function MedicationLine({
  medication,
  lastChange,
  client,
  staffId,
  patientId,
  reload,
  canGive = true,
  given = 0,
}: {
  medication: Medication
  // Doses of it given so far (request 240), for "2 of 6 doses given".
  given?: number
  lastChange: MedicalRecord['statusChanges'][number] | undefined
  client: SupabaseClient
  staffId: string
  patientId: number
  reload: () => void
  // false inside the chart, where Given on each row records the dose, so a
  // dose is never offered two ways in one place (request 221).
  canGive?: boolean
}) {
  const [changing, setChanging] = useState<MedicationStatus | null>(null)
  const [giving, setGiving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(medication.medicine)
  const [newDose, setNewDose] = useState(medication.dose ?? '')
  const [newOften, setNewOften] = useState(medication.how_often ?? '')
  const [dose, setDose] = useState(medication.dose ?? '')
  const [givenAt, setGivenAt] = useState(localNow())
  const [problem, setProblem] = useState<string | null>(null)
  const status = MEDICATION_STATUS[medication.status]

  async function give() {
    const result = await addLine(client, 'medications_given', {
      patient_id: patientId,
      medication_id: medication.id,
      medicine: medication.medicine,
      dose: dose.trim() || null,
      given_at: new Date(givenAt).toISOString(),
      given_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setGiving(false)
      setProblem(null)
      reload()
    }
  }

  async function saveEdit() {
    if (newName.trim().length < 2) {
      setProblem('Type the medicine.')
      return
    }
    const result = await editMedication(client, medication.id, {
      medicine: newName.trim(),
      dose: newDose.trim() || null,
      how_often: newOften.trim() || null,
    })
    if (result) setProblem(result)
    else {
      setEditing(false)
      setProblem(null)
      reload()
    }
  }

  const changeWords =
    lastChange && lastChange.old_status
      ? ` · ${MEDICATION_STATUS[lastChange.new_status].label} by ${lastChange.changer?.full_name ?? 'staff'}, ${when(lastChange.changed_at)}${lastChange.reason ? `: ${lastChange.reason}` : ''}`
      : ''

  return (
    <Line
      what={
        <>
          <b>{medication.medicine}</b>
          <br />
          <span className={styles.muted}>
            {[medication.dose, medication.route, medication.how_often]
              .filter(Boolean)
              .join(' · ') || 'No dose written'}
          </span>
          {medication.doses || medication.dose_price ? (
            <>
              <br />
              <span className={styles.muted}>
                {[
                  medication.doses ? doseWords(given, medication.doses) : null,
                  medication.dose_price ? `${naira(Number(medication.dose_price))} a dose` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </>
          ) : null}
        </>
      }
      status={<span className={`${styles.pill} ${styles[status.colour]}`}>{status.label}</span>}
      meta={`Added by ${medication.author?.full_name ?? 'staff'}, ${when(medication.created_at)}${changeWords}`}
      voided={
        medication.voided_at
          ? { reason: medication.void_reason, by: medication.voider?.full_name ?? null }
          : null
      }
      voidable={{
        client,
        table: 'patient_medications',
        id: medication.id,
        staffId,
        onDone: reload,
      }}
      actions={
        <>
          {medication.status === 'active' && canGive ? (
            <button className={`${styles.small} ${styles.primary}`} onClick={() => setGiving(true)}>
              Give dose
            </button>
          ) : null}
          {medication.status === 'active' ? (
            <button className={styles.small} onClick={() => setChanging('suspended')}>
              Suspend
            </button>
          ) : null}
          {medication.status === 'suspended' ? (
            <button className={styles.small} onClick={() => setChanging('active')}>
              Resume
            </button>
          ) : null}
          {medication.status !== 'stopped' ? (
            <button
              className={styles.small}
              onClick={() => {
                setProblem(null)
                setEditing(true)
              }}
            >
              Edit
            </button>
          ) : null}
          {medication.status !== 'stopped' ? (
            <button className={styles.small} onClick={() => setChanging('stopped')}>
              Stop
            </button>
          ) : null}
        </>
      }
      form={
        changing || giving || editing ? (
          <>
            {editing ? (
              <div className={styles.form}>
                <div className={styles.fields}>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor={`edit-name-${medication.id}`}>Medicine</label>
                    <input
                      id={`edit-name-${medication.id}`}
                      className={styles.input}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`edit-dose-${medication.id}`}>Dose</label>
                    <OptionSelect
                      client={client}
                      staffId={staffId}
                      list="dose"
                      id={`edit-dose-${medication.id}`}
                      value={newDose}
                      onChange={setNewDose}
                      placeholder="Choose the dose"
                      otherLabel="Type the dose"
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`edit-often-${medication.id}`}>How often</label>
                    <OptionSelect
                      client={client}
                      staffId={staffId}
                      list="frequency"
                      id={`edit-often-${medication.id}`}
                      value={newOften}
                      onChange={setNewOften}
                      placeholder="Choose how often"
                      otherLabel="Type how often"
                    />
                  </div>
                </div>
                {problem ? <p className={styles.error}>{problem}</p> : null}
                <div className={styles.actions}>
                  <button className={`${styles.small} ${styles.primary}`} onClick={saveEdit}>
                    Save changes
                  </button>
                  <button className={styles.small} onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            {changing ? (
              <ReasonForm
                question={
                  changing === 'suspended'
                    ? `Why suspend ${medication.medicine}?`
                    : changing === 'stopped'
                      ? `Why stop ${medication.medicine}? Stopping is final.`
                      : `Why resume ${medication.medicine}?`
                }
                choices={
                  changing === 'active'
                    ? ['Doctor said to resume', 'Condition improved']
                    : // Completed first (the director, 2026-11-22, request 237:
                      // "When the treatment is completed, you stop it").
                      [
                        'Completed',
                        'Doctor said so',
                        'Side effects',
                        'Not needed now',
                        'Patient refused',
                      ]
                }
                confirmLabel={
                  changing === 'suspended' ? 'Suspend' : changing === 'stopped' ? 'Stop' : 'Resume'
                }
                onCancel={() => setChanging(null)}
                onConfirm={async (reason) => {
                  const result = await changeMedicationStatus(
                    client,
                    medication.id,
                    changing,
                    reason,
                  )
                  if (!result) {
                    setChanging(null)
                    reload()
                  }
                  return result
                }}
              />
            ) : null}
            {giving ? (
              <div className={styles.form}>
                <div className={styles.fields}>
                  <div className={styles.field}>
                    <label htmlFor={`dose-${medication.id}`}>Dose given</label>
                    <OptionSelect
                      client={client}
                      staffId={staffId}
                      list="dose"
                      id={`dose-${medication.id}`}
                      value={dose}
                      onChange={setDose}
                      placeholder="Choose the dose"
                      otherLabel="Type the dose"
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor={`time-${medication.id}`}>Time given</label>
                    <input
                      id={`time-${medication.id}`}
                      className={styles.input}
                      type="datetime-local"
                      max={localNow()}
                      value={givenAt}
                      onChange={(e) => setGivenAt(e.target.value)}
                    />
                  </div>
                </div>
                {problem ? <p className={styles.error}>{problem}</p> : null}
                <div className={styles.actions}>
                  <button className={`${styles.small} ${styles.primary}`} onClick={give}>
                    Record dose
                  </button>
                  <button className={styles.small} onClick={() => setGiving(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null
      }
    />
  )
}

// ===== 2. Doses given =====
// bare: shown inside the medication chart, opened in place by "Correct or
// add a dose" (request 221a).
export function DosesSection({
  client,
  staffId,
  patientId,
  record,
  reload,
  bare = false,
}: Props & { bare?: boolean }) {
  const [adding, setAdding] = useState(false)
  const [medicine, setMedicine] = useState('')
  const [strength, setStrength] = useState('')
  const [dose, setDose] = useState('')
  const [givenAt, setGivenAt] = useState(localNow())
  const [problem, setProblem] = useState<string | null>(null)

  async function add() {
    if (medicine.trim().length < 2) {
      setProblem('Choose the medicine.')
      return
    }
    const result = await addLine(client, 'medications_given', {
      patient_id: patientId,
      medicine: medicineWords(medicine.trim(), strength.trim()),
      dose: dose.trim() || null,
      given_at: new Date(givenAt).toISOString(),
      given_by: staffId,
    })
    if (result) setProblem(result)
    else {
      setAdding(false)
      setMedicine('')
      setStrength('')
      setDose('')
      setProblem(null)
      reload()
    }
  }

  const body = (
    <>
      {record.doses.length === 0 ? <EmptyLine text="No doses recorded yet." /> : null}
      {record.doses.map((given) => (
        <Line
          key={given.id}
          what={<b>{[given.medicine, given.dose].filter(Boolean).join(' · ')}</b>}
          status={<span className={`${styles.pill} ${styles.grey}`}>{when(given.given_at)}</span>}
          meta={
            given.not_given_reason
              ? `Not given: ${given.not_given_reason}. Written by ${given.giver?.full_name ?? 'staff'}`
              : `Given by ${given.giver?.full_name ?? 'staff'}`
          }
          voided={
            given.voided_at
              ? { reason: given.void_reason, by: given.voider?.full_name ?? null }
              : null
          }
          voidable={{ client, table: 'medications_given', id: given.id, staffId, onDone: reload }}
        />
      ))}
      {adding ? (
        <div className={styles.form}>
          <div className={styles.fields}>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="given-name">Medicine</label>
              <MedicinePicker
                client={client}
                staffId={staffId}
                id="given-name"
                name={medicine}
                strength={strength}
                onChange={(name, picked) => {
                  setMedicine(name)
                  setStrength(picked)
                }}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="given-dose">Dose</label>
              <OptionSelect
                client={client}
                staffId={staffId}
                list="dose"
                id="given-dose"
                value={dose}
                onChange={setDose}
                placeholder="Choose the dose"
                otherLabel="Type the dose"
              />
            </div>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="given-time">Time given</label>
              <input
                id="given-time"
                className={styles.input}
                type="datetime-local"
                max={localNow()}
                value={givenAt}
                onChange={(e) => setGivenAt(e.target.value)}
              />
            </div>
          </div>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.actions}>
            <button className={`${styles.small} ${styles.primary}`} onClick={add}>
              Record dose
            </button>
            <button className={styles.small} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.small} onClick={() => setAdding(true)}>
            + Record a dose not on the list
          </button>
        </div>
      )}
    </>
  )
  return bare ? (
    <div id="record-doses" className={styles.manage}>
      {body}
    </div>
  ) : (
    <Section
      title="Doses given"
      count={record.doses.filter((d) => !d.voided_at).length}
      open
      id="record-doses"
    >
      {body}
    </Section>
  )
}
