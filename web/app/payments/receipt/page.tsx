/*
 * app/payments/receipt/page.tsx: a receipt, ready to print (request 123,
 * part 2).
 *
 * Why: Anthony, 2026-10-31: "other payments with printable receipts."
 * 2026-11-02: print "anyhow many times they want"; when the patient pays
 * more on the same day, the day's receipt "updates automatically".
 *
 * Three ways in:
 *   ?id=12               one payment's receipt
 *   ?p=7&day=today       every payment the patient made today, one receipt
 *   ?latest=7            the newest payment this person took for patient 7
 *                        (Print receipt right after paying on Home)
 *
 * On paper: the hospital's letterhead, the receipt number, the patient,
 * each line with its price, the total, how it was paid, who took it and
 * when. The file name, if saved as PDF, is the patient's name, number and
 * the receipt number.
 *
 * Send to email (request 159, 2026-11-09): when the patient gave an email,
 * a button beside Print sends this receipt to it, through the Worker
 * (worker/src/receipts.ts), the same way staff invitations go.
 *
 * A bill's payment (request 240, 2026-11-23): the bill's own lines, the
 * total, what was paid now, and for an inpatient still in, what was paid
 * since admission and the balance; then lines for the doctor and the
 * patient to sign, as on the hospital's Discharge / Billing Form. The bill's
 * lines never name a medicine or a test.
 *
 * Never: show a receipt to anybody but the Front Desk and admins (the
 * database refuses them too), or show the email button when there is no
 * email to send to.
 */
'use client'

import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './receipt.module.css'
import AppShell from '@/components/shell/AppShell'
import Logo from '@/components/brand/Logo'
import { naira } from '@/lib/lab/lab'
import {
  MODE_WORDS,
  PURPOSE_WORDS,
  getPayment,
  latestPayment,
  paymentsOnDay,
  receiptCode,
  emailReceipt,
  type Payment,
} from '@/lib/payments/payments'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'
import { BRAND } from '@/lib/brand/brand'
import {
  billForPayment,
  balanceWords,
  billTotal,
  loadStatement,
  type Bill,
  type Statement,
} from '@/lib/bills/bills'

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

function Receipt() {
  const auth = useAuth()
  useRightPage(auth.status, '/payments/receipt/')
  const params = useSearchParams()
  const { client, staff } = auth
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  // A bill's payment: the bill, and the stay's statement while still in.
  const [bill, setBill] = useState<Bill | null>(null)
  const [statement, setStatement] = useState<Statement | null>(null)

  // ===== 1. Load the payment, or the day's payments =====
  useEffect(() => {
    if (!client || !staff || auth.status !== 'ready') return
    const id = Number(params.get('id'))
    const patient = Number(params.get('p') || params.get('latest'))
    let current = true
    const load = async (): Promise<Payment[]> => {
      if (id) {
        const one = await getPayment(client, id)
        return one ? [one] : []
      }
      if (params.get('latest') && patient) {
        const one = await latestPayment(client, patient, staff.id)
        return one ? [one] : []
      }
      if (patient) return paymentsOnDay(client, patient, new Date())
      return []
    }
    load().then(async (found) => {
      if (!current) return
      setPayments(found)
      // One bill payment: its bill, and the stay's statement (request 240).
      if (found.length === 1 && found[0].purpose === 'bill') {
        const paid = await billForPayment(client, found[0].id)
        if (!current || !paid) return
        setBill(paid)
        if (paid.admission_id) {
          const now = await loadStatement(client, paid.patient_id)
          if (current && now?.admitted && now.admission_id === paid.admission_id) setStatement(now)
        }
      }
    })
    return () => {
      current = false
    }
  }, [client, staff, auth.status, params])

  if (auth.status !== 'ready' || !client || !staff) return null

  const patient = payments?.[0]?.patient ?? null
  const total = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0)
  // The numbers people see: bank style, never like a patient number.
  const numbers = (payments ?? [])
    .map((payment) => receiptCode(payment.receipt_number, payment.received_at))
    .join(', ')

  // ===== 2b. Send it to the patient's email (request 159) =====
  // Shown only when the patient gave an email. One tap sends it.
  async function sendEmail() {
    if (!client || !payments?.length) return
    setEmailState('sending')
    const problem = await emailReceipt(
      client,
      payments.map((payment) => payment.id),
    )
    setEmailState(problem ? 'failed' : 'sent')
  }

  // ===== 2. Print, with the file named after the patient =====
  function print() {
    const title = document.title
    if (patient)
      document.title = `${patient.full_name} ${patient.patient_number} receipt ${numbers}`
    window.addEventListener('afterprint', () => (document.title = title), { once: true })
    window.setTimeout(() => window.print(), 50)
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.actions}>
          <button className={`${styles.button} ${styles.primary}`} onClick={print}>
            Print receipt
          </button>
          {patient?.email ? (
            <button
              className={styles.button}
              onClick={sendEmail}
              disabled={emailState === 'sending' || emailState === 'sent'}
            >
              {emailState === 'sending'
                ? 'Sending…'
                : emailState === 'sent'
                  ? 'Sent to email'
                  : 'Send to email'}
            </button>
          ) : null}
          {/* Back to the patient, so it works however the receipt was opened. */}
          {patient ? (
            <Link className={styles.button} href={`/patients/?p=${patient.id}`}>
              Back to patient
            </Link>
          ) : null}
        </div>

        {emailState === 'sent' && patient?.email ? (
          <p className={styles.good}>The receipt was sent to {patient.email}.</p>
        ) : null}
        {emailState === 'failed' ? (
          <p className={styles.bad}>The email did not go. Check the internet, then try again.</p>
        ) : null}
        {payments === null ? <p className={styles.muted}>Loading…</p> : null}
        {payments && payments.length === 0 ? (
          <p className={styles.muted}>This receipt was not found.</p>
        ) : null}

        {/* ===== 3. The receipt, as it prints ===== */}
        {payments && payments.length > 0 && patient ? (
          <article className={`${styles.receipt} lightOnly`}>
            <header className={styles.letterhead}>
              <Logo size={64} />
              <div>
                <h1>{BRAND.name.toUpperCase()}</h1>
                {BRAND.address ? <p>{BRAND.address}</p> : null}
              </div>
            </header>
            <div className={styles.redLine} aria-hidden="true" />

            <div className={styles.titleRow}>
              <h2>Receipt</h2>
              <div className={styles.receiptNo}>
                <small>Receipt no.</small>
                <span>{numbers}</span>
              </div>
            </div>

            <dl className={styles.facts}>
              <div>
                <dt>Patient</dt>
                <dd>{patient.full_name}</dd>
              </div>
              <div>
                <dt>Patient number</dt>
                <dd>{patient.patient_number}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{when(payments[payments.length - 1].received_at)}</dd>
              </div>
            </dl>

            {bill ? (
              // ----- A bill: its lines, as on the hospital's form -----
              <table className={styles.lines}>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.item}</td>
                      <td>{naira(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{naira(billTotal(bill))}</td>
                  </tr>
                  {statement ? (
                    <tr>
                      <td>Paid since admission (deposits too)</td>
                      <td>{naira(Number(statement.paid ?? 0))}</td>
                    </tr>
                  ) : null}
                  {statement ? (
                    <tr>
                      <td>Balance</td>
                      <td>{balanceWords(Number(statement.balance ?? 0), naira)}</td>
                    </tr>
                  ) : null}
                </tfoot>
              </table>
            ) : null}

            <table className={styles.lines}>
              <thead>
                <tr>
                  <th>{bill ? 'Paid now' : 'Item'}</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) =>
                  payment.lines.map((line, at) => (
                    <tr key={`${payment.id}-${at}`}>
                      <td>
                        {line.label}
                        {payments.length > 1 && at === 0 ? (
                          <small>
                            {PURPOSE_WORDS[payment.purpose]} ·{' '}
                            {receiptCode(payment.receipt_number, payment.received_at)} ·{' '}
                            {MODE_WORDS[payment.mode]}
                          </small>
                        ) : null}
                      </td>
                      <td>{naira(Number(line.amount))}</td>
                    </tr>
                  )),
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total paid</td>
                  <td>{naira(total)}</td>
                </tr>
              </tfoot>
            </table>

            <dl className={styles.facts}>
              {payments.length === 1 ? (
                <div>
                  <dt>Paid by</dt>
                  <dd>{MODE_WORDS[payments[0].mode]}</dd>
                </div>
              ) : null}
              <div>
                <dt>Received by</dt>
                <dd>
                  {[
                    ...new Set(payments.map((payment) => payment.receiver?.full_name ?? 'Staff')),
                  ].join(', ')}
                </dd>
              </div>
            </dl>
            {bill ? (
              // Signed by the doctor and the patient, as on the paper form.
              <div className={styles.signatures}>
                <span>Signed: Doctor</span>
                <span>Patient</span>
              </div>
            ) : null}
            <p className={styles.thanks}>Thank you.</p>
          </article>
        ) : null}
      </div>
    </AppShell>
  )
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={null}>
      <Receipt />
    </Suspense>
  )
}
