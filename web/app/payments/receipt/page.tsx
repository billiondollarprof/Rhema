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
 * Never: show a receipt to anybody but the Front Desk and admins (the
 * database refuses them too). Email comes when the hospital email is
 * connected; no button shows for it before then.
 */
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  type Payment,
} from '@/lib/payments/payments'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

function Receipt() {
  const auth = useAuth()
  useRightPage(auth.status, '/payments/receipt/')
  const router = useRouter()
  const params = useSearchParams()
  const { client, staff } = auth
  const [payments, setPayments] = useState<Payment[] | null>(null)

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
    load().then((found) => {
      if (current) setPayments(found)
    })
    return () => {
      current = false
    }
  }, [client, staff, auth.status, params])

  if (auth.status !== 'ready' || !client || !staff) return null

  const patient = payments?.[0]?.patient ?? null
  const total = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0)
  const numbers = (payments ?? []).map((payment) => payment.receipt_number).join(', ')

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
          <button className={styles.button} onClick={() => router.back()}>
            Back
          </button>
        </div>

        {payments === null ? <p className={styles.muted}>Loading…</p> : null}
        {payments && payments.length === 0 ? (
          <p className={styles.muted}>This receipt was not found.</p>
        ) : null}

        {/* ===== 3. The receipt, as it prints ===== */}
        {payments && payments.length > 0 && patient ? (
          <article className={styles.receipt}>
            <header className={styles.letterhead}>
              <Logo size={64} />
              <div>
                <h1>RHEMA MEDICAL CENTRE</h1>
                <p>Former License Office by Ojolu Junction, Sapele, Delta State, Nigeria</p>
              </div>
            </header>
            <div className={styles.redLine} aria-hidden="true" />

            <div className={styles.titleRow}>
              <h2>Receipt</h2>
              <span>{numbers}</span>
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

            <table className={styles.lines}>
              <thead>
                <tr>
                  <th>Item</th>
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
                            {PURPOSE_WORDS[payment.purpose]} · {payment.receipt_number} ·{' '}
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
