/*
 * components/work/PharmacyCard.tsx: the Pharmacy card, on Home and inside a
 * notice on Notifications (requests 123 and 148). A
 * different list for each person:
 *   Front Desk, Admin   drugs waiting for payment: a price for each drug,
 *                       the app adds them up, then the mode, Record payment.
 *                       The same drug on another prescription of the
 *                       patient in the last 24 hours: a warning first, with
 *                       Take payment anyway or Cancel (request 251).
 *   Pharmacy            prescriptions to dispense: the drugs, how to take
 *                       them, who prescribed; Dispensed.
 * Doctors see nothing here: their prescriptions are in the patient's record.
 *
 * Why: Anthony, 2026-10-31: "do pharmacy with drug payments now." "Let the
 * app always work out the total." "It's a hospital, so the doctor
 * prescribes."
 *
 * Never: show the medical record here. Name, number, the drugs and the note
 * from the doctor only.
 */
'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import PriceForm from './PriceForm'
import SameWarning from '@/components/warnings/SameWarning'
import { elsewhereWords, sameDrugsElsewhere, type Earlier } from '@/lib/orders/duplicates'
import styles from './work.module.css'
import type { StaffMember } from '@/lib/auth/session'
import { recall, remember } from '@/lib/cache/memory'
import { waitedSince } from '@/lib/patients/age'
import {
  dispense,
  itemWords,
  listAwaitingDispense,
  listAwaitingPayment,
  listToGive,
  payPrescription,
  type Prescription,
} from '@/lib/pharmacy/pharmacy'
import { onChange } from '@/lib/live/changes'
import { takesPayments } from '@/lib/auth/roles'
import StayPill from '@/components/stay/StayPill'
import {
  loadMedicines,
  medicineWords,
  stockWords,
  type MedicineLine,
} from '@/lib/medicines/medicines'

type View = 'pay' | 'dispense'

// ===== 1. Which list this person sees =====
function viewFor(staff: StaffMember): View | null {
  // The Front Desk, or an admin who does not work with patients (request 213e).
  if (takesPayments(staff)) return 'pay'
  if (staff.role === 'pharmacy') return 'dispense'
  return null
}

const TITLES: Record<View, [string, string]> = {
  pay: ['Drugs to pay for', 'No drugs waiting for payment.'],
  dispense: ['Prescriptions to dispense', 'No prescriptions waiting.'],
}
// On one patient's page, for the Pharmacy (request 233).
const TO_GIVE: [string, string] = ['Drugs to give', 'Nothing to give.']

// ===== 2. The card =====
export default function PharmacyCard({
  client,
  staff,
  bare = false,
  patientId,
}: {
  client: SupabaseClient
  staff: StaffMember
  // Inside a notice: no frame and no heading, the notice is the heading.
  bare?: boolean
  // On a patient's details page: only that patient's. The Front Desk sees
  // what to take payment for (request 227k); the Pharmacy sees the drugs to
  // give, paid or not (request 233).
  patientId?: number
}) {
  const view = patientId
    ? takesPayments(staff)
      ? 'pay'
      : staff.role === 'pharmacy'
        ? 'dispense'
        : null
    : viewFor(staff)
  // The last list shown, at once, while a fresh one loads (request 145).
  const [list, setList] = useState<Prescription[] | null>(() =>
    recall(staff.id, patientId ? `pharmacy-pay-${patientId}` : `pharmacy-${view}`),
  )

  // The patient just paid for, to offer their receipt.
  const [paidFor, setPaidFor] = useState<number | null>(null)
  const load = useCallback(async () => {
    const keep = (found: Prescription[]) =>
      setList(
        remember(staff.id, patientId ? `pharmacy-pay-${patientId}` : `pharmacy-${view}`, found),
      )
    if (view === 'pay') keep(await listAwaitingPayment(client, patientId))
    else if (view === 'dispense' && patientId) keep(await listToGive(client, patientId))
    else if (view === 'dispense') keep(await listAwaitingDispense(client))
  }, [client, staff.id, view, patientId])

  // Load now, then every 30 seconds, like the rest of Home.
  useEffect(() => {
    if (!view) return
    let current = true
    const run = () => {
      if (current) load()
    }
    const first = window.setTimeout(run, 0)
    const timer = window.setInterval(run, 30000)
    // Something saved anywhere: fetch at once (request 157).
    const stopListening = client ? onChange(client, 'records', run) : () => {}
    return () => {
      stopListening()
      current = false
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [view, load])

  if (!view) return null
  // On a patient's page, nothing unpaid: no card at all (request 227k).
  if (patientId && list && list.length === 0) return null
  const [title, empty] = patientId && view === 'dispense' ? TO_GIVE : TITLES[view]

  return (
    <div
      className={
        bare ? styles.bare : patientId ? `${styles.bare} ${styles.inPatient}` : styles.card
      }
      id={bare || patientId ? undefined : 'pharmacy'}
    >
      {bare ? null : (
        <h3>
          {title}
          {list && list.length ? <span className={styles.count}>{list.length}</span> : null}
        </h3>
      )}
      {/* Medicines running low, for the Pharmacy (request 214). */}
      {view === 'dispense' && !patientId ? <RunningLow client={client} staffId={staff.id} /> : null}
      {list === null ? <p className={styles.muted}>Loading…</p> : null}
      {list && list.length === 0 ? <p className={styles.muted}>{empty}</p> : null}
      {/* Straight after a payment: its receipt, one tap away (request 123). */}
      {paidFor ? (
        <div className={styles.paidBar}>
          <span>Payment saved.</span>
          <Link className={styles.button} href={`/payments/receipt/?latest=${paidFor}`}>
            Print receipt
          </Link>
        </div>
      ) : null}
      <div className={styles.queue}>
        {(list ?? []).map((prescription) => (
          <Entry
            key={prescription.id}
            client={client}
            view={view}
            prescription={prescription}
            onDone={load}
            onPaid={(patientId) => {
              setPaidFor(patientId)
              void load()
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ===== 3. One prescription =====
function Entry({
  client,
  view,
  prescription,
  onDone,
  onPaid,
}: {
  client: SupabaseClient
  view: View
  prescription: Prescription
  onDone: () => void
  onPaid: (patientId: number) => void
}) {
  const [paying, setPaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The same drug on another prescription of this patient (request 251).
  const [same, setSame] = useState<Earlier[] | null>(null)
  const [checking, setChecking] = useState(false)

  // Take payment: first look for the same drug on another prescription in
  // the last 24 hours; if there is one, warn before the price form opens.
  async function askToPay() {
    setChecking(true)
    const earlier = await sameDrugsElsewhere(
      client,
      prescription.patient_id,
      prescription.id,
      prescription.items.map((item) => ({ drug: item.drug, strength: item.strength })),
    )
    setChecking(false)
    if (earlier.length > 0) setSame(earlier)
    else setPaying(true)
  }

  async function done() {
    setBusy(true)
    setError(null)
    const problem = await dispense(client, prescription.id)
    setBusy(false)
    if (problem) setError(problem)
    else onDone()
  }

  // The name the Front Desk prices: the drug and its strength.
  const labels = prescription.items.map((item) =>
    [item.drug, item.strength].filter(Boolean).join(' '),
  )

  return (
    <div className={styles.entry}>
      <div className={styles.entryTop}>
        <div>
          <b>{prescription.patient?.full_name ?? 'Patient'}</b>
          <StayPill client={client} patientId={prescription.patient_id} />
          <small>
            {prescription.patient?.patient_number} · by{' '}
            {prescription.prescriber?.full_name ?? 'the doctor'} ·{' '}
            {waitedSince(prescription.prescribed_at)} ago
          </small>
          {/* Sent straight to the Pharmacy: say so, so nobody waits for it
              to be released (request 227k). */}
          {view === 'pay' && prescription.status === 'dispensed' ? (
            <small className={styles.note}>Owed: already given, not paid yet.</small>
          ) : null}
          {view === 'pay' && prescription.status === 'awaiting_dispense' ? (
            <small className={styles.note}>Sent straight to the Pharmacy. Not paid yet.</small>
          ) : null}
        </div>
      </div>
      <ul className={styles.drugs}>
        {prescription.items.map((item, at) => (
          <li key={item.id ?? at}>
            {view === 'dispense' ? itemWords(item) : labels[at]}
            {view === 'dispense' && item.note ? <small> ({item.note})</small> : null}
          </li>
        ))}
      </ul>
      {view === 'dispense' && prescription.note ? (
        <small className={styles.note}>Note: {prescription.note}</small>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.entryButtons}>
        {view === 'pay' && !paying && !same ? (
          <button
            className={`${styles.button} ${styles.primary}`}
            disabled={checking}
            onClick={() => void askToPay()}
          >
            {checking ? 'Checking…' : 'Take payment'}
          </button>
        ) : null}
        {/* Not paid yet: it can still be given (request 232, 2026-11-20:
            "so that there will be no obstruction as to payment"). The Front
            Desk keeps it as owed until the money is taken. */}
        {view === 'dispense' && prescription.status === 'awaiting_payment' ? (
          <span className={styles.waitingPay}>Not paid yet</span>
        ) : null}
        {view === 'dispense' ? (
          <button className={`${styles.button} ${styles.primary}`} onClick={done} disabled={busy}>
            {busy ? 'Saving…' : 'Dispensed'}
          </button>
        ) : null}
      </div>

      {same ? (
        <SameWarning
          words={elsewhereWords(same)}
          goLabel="Take payment anyway"
          onGo={() => {
            setSame(null)
            setPaying(true)
          }}
          onCancel={() => setSame(null)}
        />
      ) : null}
      {paying ? (
        <PriceForm
          formId={`rx-${prescription.id}`}
          labels={labels}
          // The doctor's prices filled in (request 235); the Front Desk may
          // change them (request 239).
          prices={prescription.items.map((item) => (item.price ? Number(item.price) : undefined))}
          fromDoctor={prescription.items.map((item) => Boolean(item.price))}
          save={(lines, mode) => payPrescription(client, prescription.id, lines, mode)}
          onCancel={() => setPaying(false)}
          onDone={() => onPaid(prescription.patient_id)}
        />
      ) : null}
    </div>
  )
}

// ===== Running low (request 214, 2026-11-16) =====
// Counted medicines at or below the level the Pharmacy set, or at 0. Shown
// until the Pharmacy restocks. Lines nobody counts never show here.
function RunningLow({ client, staffId }: { client: SupabaseClient; staffId: string }) {
  const [low, setLow] = useState<MedicineLine[]>([])
  useEffect(() => {
    let current = true
    loadMedicines(client, staffId).then((lines) => {
      if (!current || !lines) return
      setLow(
        lines.filter(
          (line) =>
            line.status === 'standard' &&
            line.is_active &&
            line.in_stock !== null &&
            Number(line.in_stock) <= Math.max(0, Number(line.low_level ?? 0)),
        ),
      )
    })
    return () => {
      current = false
    }
  }, [client, staffId])

  if (low.length === 0) return null
  return (
    <div className={styles.runningLow}>
      <b>Running low ({low.length})</b>
      <ul>
        {low.map((line) => (
          <li key={line.id}>
            {medicineWords(line.name, line.strength)}: {stockWords(line)}
          </li>
        ))}
      </ul>
      <Link className={styles.button} href="/pharmacy/list/">
        Restock in the Medicine list
      </Link>
    </div>
  )
}
