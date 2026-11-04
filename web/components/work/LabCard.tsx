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
import styles from './work.module.css'
import type { StaffMember } from '@/lib/auth/session'
import { waitedSince } from '@/lib/patients/age'
import {
  listAwaitingPayment,
  listAwaitingTest,
  listMyReadyResults,
  markSeen,
  payLabRequestLines,
  type LabRequest,
} from '@/lib/lab/lab'

type View = 'pay' | 'lab' | 'mine'

// ===== 1. Which list this person sees =====
function viewFor(staff: StaffMember): View | null {
  if (staff.role === 'front_desk' || staff.role === 'admin') return 'pay'
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
  const [requests, setRequests] = useState<LabRequest[] | null>(null)

  // The patient just paid for, to offer their receipt.
  const [paidFor, setPaidFor] = useState<number | null>(null)
  const load = useCallback(async () => {
    if (view === 'pay') setRequests(await listAwaitingPayment(client))
    else if (view === 'lab') setRequests(await listAwaitingTest(client))
    else if (view === 'mine') setRequests(await listMyReadyResults(client, staff.id))
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
    return () => {
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
        <Link className={`${styles.button} ${styles.wide}`} href="/lab/result/">
          Add a result without a request
        </Link>
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
          <button className={`${styles.button} ${styles.primary}`} onClick={() => setPaying(true)}>
            Take payment
          </button>
        ) : null}
        {view === 'lab' ? (
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

      {paying ? (
        // A price for each test; the app adds them up (2026-10-31).
        <PriceForm
          formId={`lab-${request.id}`}
          labels={request.tests}
          save={(lines, mode) => payLabRequestLines(client, request.id, lines, mode)}
          onCancel={() => setPaying(false)}
          onDone={() => onPaid(request.patient_id)}
        />
      ) : null}
    </div>
  )
}
