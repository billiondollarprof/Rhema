/*
 * components/work/LabCard.tsx: the Laboratory card, on Home and inside a
 * notice on Notifications (request 148). It shows a different
 * list to each person (request 115):
 *   Front Desk, Admin     tests waiting for payment: a price for each test
 *                         (the app adds them up), the mode (Cash, POS,
 *                         Transfer), Record payment (PriceForm.tsx).
 *   Laboratory            tests to do: Enter results; and a way to add a
 *                         result for a walk in.
 *   Doctor, Nurse, Matron results ready for the tests they asked for. A
 *                         tap opens the patient's record, where the result
 *                         sits.
 *
 * Why: Anthony, 2026-10-30: "Front desk usually add amount paid in naira not
 * just tap paid and they also add mode of payment." "You only send a copy
 * when a person requested for it."
 *
 * Never: show a result here. The result lives in the patient's record; this
 * card only says it is ready.
 */
'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import PriceForm from './PriceForm'
import {
  loadPriceChanges,
  loadPrices,
  priceOf,
  waitingPriceOf,
  type Price,
  type PriceChange,
} from '@/lib/prices/prices'
import styles from './work.module.css'
import type { StaffMember } from '@/lib/auth/session'
import { recall, remember } from '@/lib/cache/memory'
import { waitedSince } from '@/lib/patients/age'
import {
  listAwaitingPayment,
  listAwaitingTest,
  listMyReadyResults,
  markSampleTaken,
  markSeen,
  payLabRequestLines,
  type LabRequest,
} from '@/lib/lab/lab'
import { onChange } from '@/lib/live/changes'
import { takesPayments } from '@/lib/auth/roles'

type View = 'pay' | 'lab' | 'mine'

// ===== 1. Which list this person sees =====
function viewFor(staff: StaffMember): View | null {
  // The Front Desk, or an admin who does not work with patients (request 213e).
  if (takesPayments(staff)) return 'pay'
  if (staff.role === 'laboratory') return 'lab'
  if (staff.can_medical) return 'mine'
  return null
}

const TITLES: Record<View, [string, string]> = {
  pay: ['Lab tests to pay for', 'Nothing waiting for payment.'],
  lab: ['Lab tests to do', 'No tests waiting.'],
  mine: ['Lab results ready for you', 'No new results.'],
}

// ===== 2. The card =====
export default function LabCard({
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
  const [requests, setRequests] = useState<LabRequest[] | null>(() =>
    recall(staff.id, `lab-${view}`),
  )

  // The patient just paid for, to offer their receipt.
  const [paidFor, setPaidFor] = useState<number | null>(null)
  const load = useCallback(async () => {
    const keep = (found: LabRequest[]) => setRequests(remember(staff.id, `lab-${view}`, found))
    if (view === 'pay') keep(await listAwaitingPayment(client))
    else if (view === 'lab') keep(await listAwaitingTest(client))
    else if (view === 'mine') keep(await listMyReadyResults(client, staff.id))
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
  // A doctor with nothing new sees no card at all, so Home stays quiet.
  if (view === 'mine' && (!requests || requests.length === 0)) return null

  const [title, empty] = TITLES[view]
  return (
    <div className={bare ? styles.bare : styles.card} id={bare ? undefined : 'lab'}>
      {bare ? null : (
        <h3>
          {title}
          {requests && requests.length ? (
            <span className={styles.count}>{requests.length}</span>
          ) : null}
        </h3>
      )}
      {view === 'lab' ? (
        <div className={styles.labLinks}>
          <Link className={`${styles.button} ${styles.wide}`} href="/lab/result/">
            Add a result without a request
          </Link>
          {/* Every test, with no patient on it (Anthony, 2026-11-16). */}
          <Link className={`${styles.button} ${styles.wide}`} href="/lab/tests/">
            Lab test list
          </Link>
          {/* Find a patient's paid tests, to enter or correct (request 214). */}
          <Link className={`${styles.button} ${styles.wide}`} href="/lab/patient/">
            Find a patient&apos;s tests
          </Link>
        </div>
      ) : null}
      {requests === null ? <p className={styles.muted}>Loading…</p> : null}
      {requests && requests.length === 0 ? <p className={styles.muted}>{empty}</p> : null}
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
        {(requests ?? []).map((request) => (
          <LabEntry
            key={request.id}
            client={client}
            view={view}
            request={request}
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

// ===== 3. One request in the list =====
function LabEntry({
  client,
  view,
  request,
  onDone,
  onPaid,
}: {
  client: SupabaseClient
  view: View
  request: LabRequest
  onDone: () => void
  onPaid: (patientId: number) => void
}) {
  const [paying, setPaying] = useState(false)
  const [marking, setMarking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The price list, read when the form opens, so each test's price is
  // filled in (Settings, 2026-11-16). Empty when there is none or no network.
  const [prices, setPrices] = useState<Price[] | null>(null)
  // Lab prices still waiting for the admin (request 208).
  const [waiting, setWaiting] = useState<PriceChange[]>([])

  function startPaying() {
    setPaying(true)
    Promise.all([loadPrices(client), loadPriceChanges(client)]).then(([found, changes]) => {
      setWaiting(changes ?? [])
      setPrices(found ?? [])
    })
  }

  // The standard price; a test with none takes the new price still waiting,
  // marked, so the Front Desk knows it is not approved yet.
  const lineFor = (test: string) => {
    const standard = prices ? priceOf(prices, 'lab_test', test) : undefined
    if (standard) return { price: standard, note: undefined }
    const pending = waitingPriceOf(waiting, test)
    if (pending) return { price: pending.amount, note: 'New price, not yet approved by the admin' }
    return { price: undefined, note: undefined }
  }

  return (
    <div className={styles.entry}>
      <div className={styles.entryTop}>
        <div>
          <b>{request.patient?.full_name ?? 'Patient'}</b>
          <small>
            {request.patient?.patient_number} · {request.tests.join(', ')}
          </small>
          <small>
            Asked by {request.requester?.full_name ?? 'staff'} · {waitedSince(request.requested_at)}{' '}
            ago
          </small>
          {request.note && view === 'lab' ? (
            <small className={styles.note}>Note: {request.note}</small>
          ) : null}
        </div>
      </div>

      <div className={styles.entryButtons}>
        {view === 'pay' && !paying ? (
          <button className={`${styles.button} ${styles.primary}`} onClick={() => startPaying()}>
            Take payment
          </button>
        ) : null}
        {view === 'lab' && request.status === 'awaiting_payment' ? (
          <span className={styles.waitingPay}>Waiting for payment at the Front Desk</span>
        ) : null}
        {/* The sample, one tap (request 219c, number 4). */}
        {view === 'lab' && request.status === 'awaiting_test' && !request.sample_taken_at ? (
          <button
            className={styles.button}
            disabled={marking}
            onClick={async () => {
              setMarking(true)
              const failed = await markSampleTaken(client, request.id)
              setMarking(false)
              setProblem(failed)
              if (!failed) onDone()
            }}
          >
            {marking ? 'Saving…' : 'Sample taken'}
          </button>
        ) : null}
        {view === 'lab' && request.sample_taken_at && request.status === 'awaiting_test' ? (
          <span className={styles.sampleTaken}>
            Sample taken{' '}
            {new Date(request.sample_taken_at).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ) : null}
        {view === 'lab' && request.status !== 'awaiting_payment' ? (
          <Link
            className={`${styles.button} ${styles.primary}`}
            href={`/lab/result/?r=${request.id}`}
          >
            Enter results
          </Link>
        ) : null}
        {view === 'mine' ? (
          <Link
            className={`${styles.button} ${styles.primary}`}
            href={`/patients/record/?p=${request.patient_id}#lab`}
            onClick={() => void markSeen(client, request.id)}
          >
            Open the record
          </Link>
        ) : null}
      </div>

      {problem ? <p className={styles.muted}>{problem}</p> : null}
      {paying && prices === null ? <p className={styles.muted}>Loading the prices…</p> : null}
      {paying && prices !== null ? (
        // A price for each test; the app adds them up (2026-10-31).
        <PriceForm
          formId={`lab-${request.id}`}
          labels={request.tests}
          prices={request.tests.map((test) => lineFor(test).price)}
          notes={request.tests.map((test) => lineFor(test).note)}
          save={(lines, mode) => payLabRequestLines(client, request.id, lines, mode)}
          onCancel={() => setPaying(false)}
          onDone={() => onPaid(request.patient_id)}
        />
      ) : null}
    </div>
  )
}
