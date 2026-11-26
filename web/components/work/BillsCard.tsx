/*
 * components/work/BillsCard.tsx: bills from a doctor or the matron
 * (procedures, operations, bed fee and the rest).
 *
 * Where it shows:
 *   Home, Front Desk      "Bills to pay": every bill not paid yet, with Take
 *                         payment. Hidden when there is none.
 *   A patient's page      that patient's bills, for every member of staff
 *                         (Anthony, 2026-11-22: "let everyone see the
 *                         bill"): Not paid yet or Paid. The Front Desk takes
 *                         payment here too; the person who made a bill can
 *                         cancel it before it is paid.
 *
 * Why: the director's voice note and Anthony, 2026-11-21 and 22 (request
 * 235, part 3). A bill never expires.
 *
 * Each line's amount is the doctor's, filled in. The Front Desk can change
 * it before taking payment (request 239, 2026-11-22: "A set price only acts
 * as a suggestion"). The bill itself stays as the doctor wrote it.
 *
 * An inpatient's bill (request 240, 2026-11-23): Take payment first reads
 * the stay's statement and asks for the Balance (the stay's bills less the
 * deposits and payments since admission), which the Front Desk can still
 * change. When the deposits already cover it, it says so.
 *
 * Never: take payment from anybody but the Front Desk (the database checks).
 */
'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import PriceForm from './PriceForm'
import styles from './work.module.css'
import type { StaffMember } from '@/lib/auth/session'
import { takesPayments } from '@/lib/auth/roles'
import { recall, remember } from '@/lib/cache/memory'
import { onChange } from '@/lib/live/changes'
import { waitedSince } from '@/lib/patients/age'
import { naira } from '@/lib/lab/lab'
import StayPill from '@/components/stay/StayPill'
import {
  billTotal,
  listBills,
  loadStatement,
  payBill,
  voidBill,
  type Bill,
  type Statement,
} from '@/lib/bills/bills'

// ===== 1. The card =====
export default function BillsCard({
  client,
  staff,
  patientId,
}: {
  client: SupabaseClient
  staff: StaffMember
  // On a patient's page: that patient's bills, for everybody.
  patientId?: number
}) {
  const canPay = takesPayments(staff)
  // Home is for the Front Desk only.
  const shown = Boolean(patientId) || canPay
  const memoryKey = patientId ? `bills-${patientId}` : 'bills-to-pay'
  // The last list shown, at once, while a fresh one loads.
  const [bills, setBills] = useState<Bill[] | null>(() => recall(staff.id, memoryKey))
  const [paidFor, setPaidFor] = useState<number | null>(null)

  const load = useCallback(async () => {
    const found = await listBills(client, patientId ? { patientId } : { toPay: true })
    // No network: what is showing stays.
    if (found) setBills(remember(staff.id, memoryKey, found))
  }, [client, staff.id, patientId, memoryKey])

  // Load now, then every 30 seconds, and at once when anything is saved.
  useEffect(() => {
    if (!shown) return
    let current = true
    const run = () => {
      if (current) void load()
    }
    const first = window.setTimeout(run, 0)
    const timer = window.setInterval(run, 30000)
    const stopListening = onChange(client, 'records', run)
    return () => {
      stopListening()
      current = false
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [shown, load, client])

  // Nothing to show: no card at all, so the page stays quiet.
  if (!shown || !bills || (bills.length === 0 && !paidFor)) return null

  return (
    <div className={patientId ? `${styles.bare} ${styles.inPatient}` : styles.card} id="bills">
      <h3>
        {patientId ? 'Bills' : 'Bills to pay'}
        {!patientId && bills.length ? <span className={styles.count}>{bills.length}</span> : null}
      </h3>
      {/* Straight after a payment: its receipt, one tap away. */}
      {paidFor ? (
        <div className={styles.paidBar}>
          <span>Payment saved.</span>
          <Link className={styles.button} href={`/payments/receipt/?latest=${paidFor}`}>
            Print receipt
          </Link>
        </div>
      ) : null}
      <div className={styles.queue}>
        {bills.map((bill) => (
          <BillEntry
            key={bill.id}
            client={client}
            bill={bill}
            onHome={!patientId}
            canPay={canPay}
            mine={bill.created_by === staff.id}
            onDone={() => void load()}
            onPaid={(paidPatient) => {
              setPaidFor(paidPatient)
              void load()
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ===== 2. One bill =====
function BillEntry({
  client,
  bill,
  onHome,
  canPay,
  mine,
  onDone,
  onPaid,
}: {
  client: SupabaseClient
  bill: Bill
  onHome: boolean
  canPay: boolean
  mine: boolean
  onDone: () => void
  onPaid: (patientId: number) => void
}) {
  const [paying, setPaying] = useState(false)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const open = bill.status === 'awaiting_payment'
  // An inpatient's bill: the stay's statement, read when Take payment opens.
  const [statement, setStatement] = useState<Statement | null>(null)
  const [reading, setReading] = useState(false)

  async function startPaying() {
    setProblem(null)
    if (!bill.admission_id) {
      setPaying(true)
      return
    }
    setReading(true)
    const found = await loadStatement(client, bill.patient_id)
    setReading(false)
    if (!found) {
      setProblem('The stay could not be read. Check the internet and try again.')
      return
    }
    setStatement(found.admitted && found.admission_id === bill.admission_id ? found : null)
    setPaying(true)
  }
  const balance = statement ? Number(statement.balance ?? 0) : null

  async function cancel() {
    setBusy(true)
    const failed = await voidBill(client, bill.id)
    setBusy(false)
    setProblem(failed)
    setAsking(false)
    if (!failed) onDone()
  }

  return (
    <div className={styles.entry}>
      <div className={styles.entryTop}>
        <div>
          {onHome ? (
            <>
              <b>{bill.patient?.full_name ?? 'Patient'}</b>
              <StayPill client={client} patientId={bill.patient_id} />
              <small>{bill.patient?.patient_number}</small>
            </>
          ) : (
            <b>{naira(billTotal(bill))}</b>
          )}
          <small>
            {bill.lines.map((line) => `${line.item} ${naira(line.amount)}`).join(' · ')}
          </small>
          {onHome ? <small>Total {naira(billTotal(bill))}</small> : null}
          <small>
            By {bill.maker?.full_name ?? 'staff'} · {waitedSince(bill.created_at)} ago
          </small>
          {bill.note ? <small className={styles.note}>Note: {bill.note}</small> : null}
        </div>
      </div>

      <div className={styles.entryButtons}>
        {open ? <span className={styles.waitingPay}>Not paid yet</span> : <span>Paid</span>}
        {open && canPay && !paying ? (
          <button
            className={`${styles.button} ${styles.primary}`}
            disabled={reading}
            onClick={startPaying}
          >
            Take payment
          </button>
        ) : null}
        {open && mine && !asking ? (
          <button className={styles.button} onClick={() => setAsking(true)}>
            Cancel bill
          </button>
        ) : null}
      </div>

      {/* Cancel asks once, so a slip of the finger changes nothing. */}
      {asking ? (
        <div className={styles.entryButtons}>
          <span>Cancel this bill?</span>
          <button className={styles.button} disabled={busy} onClick={() => setAsking(false)}>
            Keep it
          </button>
          <button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={cancel}>
            {busy ? 'Saving…' : 'Yes, cancel it'}
          </button>
        </div>
      ) : null}

      {problem ? <p className={styles.muted}>{problem}</p> : null}
      {paying && statement ? (
        <p className={styles.muted}>
          This stay: billed {naira(Number(statement.billed ?? 0))} · paid since admission{' '}
          {naira(Number(statement.paid ?? 0))} · <b>balance {naira(balance ?? 0)}</b>
        </p>
      ) : null}
      {paying && statement && (balance ?? 0) <= 0 ? (
        <p className={styles.muted}>
          The deposits already cover this bill
          {(balance ?? 0) < 0 ? `, with ${naira(-(balance ?? 0))} over` : ''}. Nothing to take.
        </p>
      ) : null}
      {paying && statement && (balance ?? 0) > 0 ? (
        // An inpatient: the balance, which the Front Desk may change.
        <PriceForm
          formId={`bill-${bill.id}`}
          labels={['Balance']}
          prices={[balance ?? 0]}
          save={(lines, mode) => payBill(client, bill.id, lines, mode)}
          onCancel={() => setPaying(false)}
          onDone={() => {
            setPaying(false)
            onPaid(bill.patient_id)
          }}
        />
      ) : null}
      {paying && !statement ? (
        // The doctor's amounts filled in; the Front Desk may change them.
        <PriceForm
          formId={`bill-${bill.id}`}
          labels={bill.lines.map((line) => line.item)}
          prices={bill.lines.map((line) => line.amount)}
          fromDoctor={bill.lines.map(() => true)}
          save={(lines, mode) => payBill(client, bill.id, lines, mode)}
          onCancel={() => setPaying(false)}
          onDone={() => {
            setPaying(false)
            onPaid(bill.patient_id)
          }}
        />
      ) : null}
    </div>
  )
}
