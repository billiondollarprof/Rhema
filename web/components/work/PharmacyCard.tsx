/*
 * components/work/PharmacyCard.tsx: the Pharmacy card, on Home and inside a
 * notice on Notifications (requests 123 and 148). A
 * different list for each person:
 *   Front Desk, Admin   drugs waiting for payment: a price for each drug,
 *                       the app adds them up, then the mode, Record payment.
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
import styles from './work.module.css'
import type { StaffMember } from '@/lib/auth/session'
import { recall, remember } from '@/lib/cache/memory'
import { waitedSince } from '@/lib/patients/age'
import {
  dispense,
  itemWords,
  listAwaitingDispense,
  listAwaitingPayment,
  payPrescription,
  type Prescription,
} from '@/lib/pharmacy/pharmacy'
import { onChange } from '@/lib/live/changes'

type View = 'pay' | 'dispense'

// ===== 1. Which list this person sees =====
function viewFor(staff: StaffMember): View | null {
  if (staff.role === 'front_desk' || staff.role === 'admin') return 'pay'
  if (staff.role === 'pharmacy') return 'dispense'
  return null
}

const TITLES: Record<View, [string, string]> = {
  pay: ['Drugs to pay for', 'No drugs waiting for payment.'],
  dispense: ['Prescriptions to dispense', 'No prescriptions waiting.'],
}

// ===== 2. The card =====
export default function PharmacyCard({
  client,
  staff,
  bare = false,
}: {
  client: SupabaseClient
  staff: StaffMember
  // Inside a notice: no frame and no heading, the notice is the heading.
  bare?: boolean
}) {
  const view = viewFor(staff)
  // The last list shown, at once, while a fresh one loads (request 145).
  const [list, setList] = useState<Prescription[] | null>(() =>
    recall(staff.id, `pharmacy-${view}`),
  )

  // The patient just paid for, to offer their receipt.
  const [paidFor, setPaidFor] = useState<number | null>(null)
  const load = useCallback(async () => {
    const keep = (found: Prescription[]) => setList(remember(staff.id, `pharmacy-${view}`, found))
    if (view === 'pay') keep(await listAwaitingPayment(client))
    else if (view === 'dispense') keep(await listAwaitingDispense(client))
  }, [client, staff.id, view])

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
  const [title, empty] = TITLES[view]

  return (
    <div className={bare ? styles.bare : styles.card} id={bare ? undefined : 'pharmacy'}>
      {bare ? null : (
        <h3>
          {title}
          {list && list.length ? <span className={styles.count}>{list.length}</span> : null}
        </h3>
      )}
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
          <small>
            {prescription.patient?.patient_number} · by{' '}
            {prescription.prescriber?.full_name ?? 'the doctor'} ·{' '}
            {waitedSince(prescription.prescribed_at)} ago
          </small>
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
        {view === 'pay' && !paying ? (
          <button className={`${styles.button} ${styles.primary}`} onClick={() => setPaying(true)}>
            Take payment
          </button>
        ) : null}
        {view === 'dispense' && prescription.status === 'awaiting_payment' ? (
          <span className={styles.muted}>Waiting for payment</span>
        ) : null}
        {view === 'dispense' && prescription.status !== 'awaiting_payment' ? (
          <button className={`${styles.button} ${styles.primary}`} onClick={done} disabled={busy}>
            {busy ? 'Saving…' : 'Dispensed'}
          </button>
        ) : null}
      </div>

      {paying ? (
        <PriceForm
          formId={`rx-${prescription.id}`}
          labels={labels}
          save={(lines, mode) => payPrescription(client, prescription.id, lines, mode)}
          onCancel={() => setPaying(false)}
          onDone={() => onPaid(prescription.patient_id)}
        />
      ) : null}
    </div>
  )
}
