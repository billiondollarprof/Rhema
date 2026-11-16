/*
 * app/patients/_parts/PaymentsCard.tsx: payments on a patient's profile,
 * for the Front Desk and admins (request 123, part 2).
 *
 * Why: Anthony, 2026-10-31: "other payments with printable receipts."
 * 2026-11-02: the Front Desk types what each line is for and its price,
 * the app adds them up; every payment has a receipt to print again any
 * time; the day's receipt grows when the patient pays more.
 *
 * Never: show payments to anybody but the Front Desk and admins (the
 * database refuses them too).
 */
'use client'

import Link from 'next/link'
import {
  CARD_ITEM,
  CONSULTATION_ITEM,
  loadPriceChanges,
  loadPrices,
  priceOf,
  waitingPriceOf,
  type Price,
  type PriceChange,
} from '@/lib/prices/prices'
import SearchSelect, { type SelectOption } from '@/components/options/SearchSelect'
import { LAB_SECTIONS, findLabTest } from '@/lib/lab/catalogue'
import { loadMedicines, medicineWords } from '@/lib/medicines/medicines'
import { loadOptions, optionsOf } from '@/lib/options/options'
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './patients.module.css'
import { PAYMENT_MODES, naira, type PaymentMode } from '@/lib/lab/lab'
import {
  PURPOSE_WORDS,
  TAKE_PURPOSES,
  patientPayments,
  takePayment,
  receiptCode,
  type Payment,
  type PaymentPurpose,
} from '@/lib/payments/payments'

type Line = { label: string; price: string }

// "7,500" and "7500.50" both read as numbers; anything else reads as 0.
function readNaira(typed: string): number {
  const value = Number(typed.replace(/[,\s]/g, ''))
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

export default function PaymentsCard({
  client,
  patientId,
  staffId,
}: {
  client: SupabaseClient
  patientId: number
  // The person taking the payment, for the lists kept on this device.
  staffId?: string
}) {
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [taking, setTaking] = useState(false)
  const [purpose, setPurpose] = useState<PaymentPurpose>('consultation')
  const [lines, setLines] = useState<Line[]>([{ label: 'Consultation', price: '' }])
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [justTaken, setJustTaken] = useState<number | null>(null)

  // ===== 1. The list =====
  const load = useCallback(async () => {
    setPayments(await patientPayments(client, patientId))
  }, [client, patientId])

  useEffect(() => {
    let current = true
    patientPayments(client, patientId).then((found) => {
      if (current) setPayments(found)
    })
    return () => {
      current = false
    }
  }, [client, patientId])

  // The price list (Settings, 2026-11-16): a card or consultation line
  // starts with its listed price, which the Front Desk can still change.
  const [prices, setPrices] = useState<Price[]>([])
  const [waiting, setWaiting] = useState<PriceChange[]>([])
  useEffect(() => {
    let current = true
    Promise.all([loadPrices(client), loadPriceChanges(client)]).then(([found, changes]) => {
      if (!current) return
      if (found) setPrices(found)
      if (changes) setWaiting(changes)
    })
    return () => {
      current = false
    }
  }, [client])

  // ===== 1b. What a lab test or drug line picks from (request 211) =====
  // Lab tests: the menu, under its sections, and tests the hospital added.
  // Drugs: the medicine list, name and strength. Other for anything else.
  const [labAdded, setLabAdded] = useState<string[]>([])
  const [drugs, setDrugs] = useState<SelectOption[]>([])
  useEffect(() => {
    if (purpose !== 'lab_test' && purpose !== 'drugs') return
    let current = true
    if (purpose === 'lab_test' && staffId) {
      loadOptions(client, staffId).then((all) => {
        if (current && all) setLabAdded(optionsOf(all, 'lab_test').map((option) => option.label))
      })
    }
    if (purpose === 'drugs' && staffId) {
      loadMedicines(client, staffId).then((lines) => {
        if (!current || !lines) return
        setDrugs(
          lines
            .filter((line) => line.status === 'standard' && line.is_active)
            .map((line) => {
              const words = medicineWords(line.name, line.strength)
              return {
                value: words,
                label: words,
                group: line.kind === 'item' ? 'Supplies' : 'Medicines',
              }
            }),
        )
      })
    }
    return () => {
      current = false
    }
  }, [client, staffId, purpose])

  const labOptions: SelectOption[] = [
    ...LAB_SECTIONS.flatMap((section) =>
      section.tests.map((test) => ({
        value: test.name,
        label: test.name,
        group: section.name,
        also: test.also,
      })),
    ),
    ...labAdded
      .filter((name) => !findLabTest(name))
      .map((name) => ({ value: name, label: name, group: 'Added by the hospital' })),
  ]

  // A lab test's price: the standard one, or the one waiting for the admin.
  function labPrice(test: string): string {
    const amount = priceOf(prices, 'lab_test', test) ?? waitingPriceOf(waiting, test)?.amount
    return amount ? String(amount) : ''
  }

  function listedPrice(purpose: PaymentPurpose): string {
    const amount =
      purpose === 'consultation'
        ? priceOf(prices, 'consultation', CONSULTATION_ITEM)
        : purpose === 'registration_card'
          ? priceOf(prices, 'card', CARD_ITEM)
          : undefined
    return amount ? String(amount) : ''
  }

  // ===== 2. Take a payment =====
  const amounts = lines.map((line) => readNaira(line.price))
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  const ready =
    lines.every((line) => line.label.trim().length > 0) && amounts.every((amount) => amount > 0)

  function choose(next: PaymentPurpose) {
    setPurpose(next)
    // Lab tests and drugs start with an empty line to pick from; the others
    // with a line named after what is being paid for, if none is typed yet.
    const picked = next === 'lab_test' || next === 'drugs'
    setLines((all) =>
      all.length === 1 && (!all[0].price || all[0].price === listedPrice(purpose))
        ? [{ label: picked ? '' : PURPOSE_WORDS[next], price: picked ? '' : listedPrice(next) }]
        : all,
    )
  }

  // A test or drug picked for a line, with the lab price filled in.
  function pickLine(at: number, label: string) {
    setLines((all) =>
      all.map((line, index) =>
        index === at
          ? { label, price: purpose === 'lab_test' ? labPrice(label) || line.price : line.price }
          : line,
      ),
    )
  }

  function change(at: number, part: keyof Line, value: string) {
    setLines((all) => all.map((line, index) => (index === at ? { ...line, [part]: value } : line)))
  }

  async function record() {
    setBusy(true)
    setProblem(null)
    const answer = await takePayment(
      client,
      patientId,
      purpose,
      lines.map((line, at) => ({ label: line.label.trim(), amount: amounts[at] })),
      mode,
    )
    setBusy(false)
    if (typeof answer === 'string') {
      setProblem(answer)
      return
    }
    setJustTaken(answer)
    setTaking(false)
    setLines([{ label: PURPOSE_WORDS[purpose], price: '' }])
    await load()
  }

  const today = (payments ?? []).filter((payment) => isToday(payment.received_at))

  return (
    <div className={styles.factGroup}>
      <h3>Payments</h3>

      {justTaken ? (
        <div className={styles.ok}>
          <b>Payment saved.</b>
          <Link className={styles.button} href={`/payments/receipt/?id=${justTaken}`}>
            Print receipt
          </Link>
        </div>
      ) : null}

      {/* ----- Take a payment ----- */}
      {taking ? (
        <div className={styles.payBox}>
          <div className={styles.segments} role="group" aria-label="Paying for">
            {TAKE_PURPOSES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={purpose === value}
                onClick={() => choose(value)}
              >
                {PURPOSE_WORDS[value]}
              </button>
            ))}
          </div>
          {lines.map((line, at) => (
            <div key={at} className={styles.payLine}>
              {purpose === 'lab_test' || purpose === 'drugs' ? (
                <SearchSelect
                  id={`pay-line-${at}`}
                  value={line.label}
                  placeholder={purpose === 'lab_test' ? 'Choose the test' : 'Choose the medicine'}
                  options={purpose === 'lab_test' ? labOptions : drugs}
                  onChange={(label) => pickLine(at, label)}
                  onOther={(typed) => pickLine(at, typed)}
                />
              ) : (
                <input
                  className={styles.input}
                  aria-label={`What line ${at + 1} is for`}
                  placeholder="What it is for"
                  maxLength={160}
                  value={line.label}
                  onChange={(event) => change(at, 'label', event.target.value)}
                />
              )}
              <div className={styles.money}>
                <span aria-hidden="true">₦</span>
                <input
                  className={styles.input}
                  aria-label={`Price for ${line.label || `line ${at + 1}`}`}
                  inputMode="decimal"
                  placeholder="e.g. 2,000"
                  value={line.price}
                  onChange={(event) =>
                    change(at, 'price', event.target.value.replace(/[^\d.,\s]/g, ''))
                  }
                />
              </div>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className={styles.lineRemove}
                  aria-label={`Remove ${line.label || `line ${at + 1}`}`}
                  onClick={() => setLines((all) => all.filter((_, index) => index !== at))}
                >
                  ×
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <button
            type="button"
            className={styles.button}
            disabled={lines.length >= 20}
            onClick={() => setLines((all) => [...all, { label: '', price: '' }])}
          >
            + Add a line
          </button>
          <div className={styles.payTotal}>
            <span>Total</span>
            <b>{naira(total)}</b>
          </div>
          <div className={styles.segments} role="group" aria-label="Paid by">
            {PAYMENT_MODES.map(([value, words]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {words}
              </button>
            ))}
          </div>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.buttons}>
            <button
              className={`${styles.button} ${styles.primary}`}
              onClick={record}
              disabled={!ready || busy}
            >
              {busy ? 'Saving…' : `Record payment · ${naira(total)}`}
            </button>
            <button className={styles.button} onClick={() => setTaking(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.buttons}>
          <button
            className={`${styles.button} ${styles.primary}`}
            onClick={() => {
              setJustTaken(null)
              setTaking(true)
              // Start with the listed price, if the line is still empty.
              setLines((all) =>
                all.length === 1 && !all[0].price
                  ? [{ ...all[0], price: listedPrice(purpose) }]
                  : all,
              )
            }}
          >
            Take payment
          </button>
          {today.length > 0 ? (
            <Link className={styles.button} href={`/payments/receipt/?p=${patientId}&day=today`}>
              Today&apos;s receipt
            </Link>
          ) : null}
        </div>
      )}

      {/* ----- Recent payments ----- */}
      {payments && payments.length > 0 ? (
        <ul className={styles.payList}>
          {payments.map((payment) => (
            <li key={payment.id}>
              <span>
                <b>
                  {PURPOSE_WORDS[payment.purpose]} · {naira(Number(payment.amount))}
                </b>
                <small>
                  {receiptCode(payment.receipt_number, payment.received_at)} ·{' '}
                  {new Date(payment.received_at).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
              </span>
              <Link className={styles.button} href={`/payments/receipt/?id=${payment.id}`}>
                Receipt
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {payments && payments.length === 0 && !taking ? (
        <p className={styles.muted}>No payments yet.</p>
      ) : null}
    </div>
  )
}
