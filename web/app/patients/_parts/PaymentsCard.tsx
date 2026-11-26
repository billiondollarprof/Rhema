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

import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import Link from 'next/link'
import {
  cardPriceFor,
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
import {
  loadMedicines,
  medicineWords,
  stockWords,
  unitWords,
  type MedicineLine,
} from '@/lib/medicines/medicines'
import { loadOptions, optionsOf } from '@/lib/options/options'
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './patients.module.css'
import { PAYMENT_MODES, naira, type PaymentMode } from '@/lib/lab/lab'
import {
  loadClinicians,
  sendPaidToLab,
  sendPaidToPharmacy,
  PURPOSE_WORDS,
  TAKE_PURPOSES,
  patientPayments,
  takePayment,
  receiptCode,
  type Payment,
  type PaymentPurpose,
} from '@/lib/payments/payments'

// qty: how many, for a drug line (request 214). Needed only when the
// Pharmacy counts that medicine's stock.
type Line = { label: string; price: string; qty?: string }

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
  category,
  inpatient = false,
}: {
  client: SupabaseClient
  patientId: number
  // An inpatient: Deposit is offered too (request 242, 2026-11-23: "front
  // desk should be able to take the payment and enter the description...
  // that deposit").
  inpatient?: boolean
  // The person taking the payment, for the lists kept on this device.
  staffId?: string
  // Individual, family or antenatal: which card fee applies (2026-11-16).
  category?: string
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
  // Each drug line by its words ("Paracetamol 500 mg tablet"), for its stock.
  const [drugLines, setDrugLines] = useState<Record<string, MedicineLine>>({})
  // After a lab or drug payment: send it on (request 213a).
  const [sendOn, setSendOn] = useState<{
    paymentId: number
    purpose: 'lab_test' | 'drugs'
    lines: Line[]
  } | null>(null)
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
        const byWords: Record<string, MedicineLine> = {}
        for (const line of lines) byWords[medicineWords(line.name, line.strength)] = line
        setDrugLines(byWords)
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
          ? cardPriceFor(prices, category ?? 'individual')
          : undefined
    return amount ? String(amount) : ''
  }

  // ===== 2. Take a payment =====
  const amounts = lines.map((line) => readNaira(line.price))
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  // A counted medicine needs how many (request 214); others do not.
  const qtyMissing = (line: Line) =>
    purpose === 'drugs' && drugLines[line.label]?.in_stock != null && !(Number(line.qty) > 0)
  const ready =
    lines.every((line) => line.label.trim().length > 0 && !qtyMissing(line)) &&
    amounts.every((amount) => amount > 0)
  // A price typed that is not an amount (request 252): that box goes red and
  // the line under the form says what to type. An empty box is not wrong yet.
  const priceWrong = (at: number) => lines[at].price.trim() !== '' && !(amounts[at] > 0)

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
    // Lab tests and drugs go on to the Lab or the Pharmacy next (request 213a).
    if (purpose === 'lab_test' || purpose === 'drugs')
      setSendOn({ paymentId: answer, purpose, lines: lines.map((line) => ({ ...line })) })
    else setSendOn(null)
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
      {sendOn ? (
        <SendOn
          client={client}
          send={sendOn}
          drugLines={drugLines}
          onDone={() => setSendOn(null)}
        />
      ) : null}

      {/* ----- Take a payment ----- */}
      {taking ? (
        <div className={styles.payBox}>
          <div className={styles.segments} role="group" aria-label="Paying for">
            {(inpatient ? [...TAKE_PURPOSES, 'deposit' as const] : TAKE_PURPOSES).map((value) => (
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
                  aria-invalid={priceWrong(at) ? 'true' : undefined}
                  value={line.price}
                  onChange={(event) =>
                    change(at, 'price', event.target.value.replace(/[^\d.,\s]/g, ''))
                  }
                />
              </div>
              {purpose === 'drugs' && line.label ? (
                <div className={styles.qtyLine}>
                  <input
                    className={styles.input}
                    aria-label={`How many of ${line.label}`}
                    inputMode="decimal"
                    aria-invalid={line.qty && !(Number(line.qty) > 0) ? 'true' : undefined}
                    placeholder={
                      drugLines[line.label]?.unit
                        ? `How many ${drugLines[line.label]?.unit}s`
                        : 'How many (optional)'
                    }
                    value={line.qty ?? ''}
                    onChange={(event) =>
                      change(at, 'qty', event.target.value.replace(/[^\d.]/g, ''))
                    }
                  />
                  {drugLines[line.label] && stockWords(drugLines[line.label]) ? (
                    <small
                      className={
                        Number(drugLines[line.label]?.in_stock) <= 0
                          ? styles.stockOut
                          : styles.muted
                      }
                    >
                      {stockWords(drugLines[line.label])}
                      {Number(drugLines[line.label]?.in_stock) <= 0
                        ? '. It can still be sold.'
                        : ''}
                    </small>
                  ) : null}
                  {qtyMissing(line) ? (
                    <small className={styles.error}>
                      The Pharmacy counts this medicine: type how many.
                    </small>
                  ) : null}
                </div>
              ) : null}
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
          {lines.some((_, at) => priceWrong(at)) ? (
            <p className={styles.error}>
              The price in red is not an amount. Type it in naira, like 2,000.
            </p>
          ) : null}
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
                    timeZone: HOSPITAL_TIME_ZONE,
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

// ===== 5. Send a lab or drug payment on (request 213a) =====
// The Lab gets the tests, or the Pharmacy the drugs, already paid. "Which
// doctor wrote the paper" is optional: that person is told when lab results
// are ready.
function SendOn({
  client,
  send,
  drugLines,
  onDone,
}: {
  client: SupabaseClient
  send: { paymentId: number; purpose: 'lab_test' | 'drugs'; lines: Line[] }
  drugLines: Record<string, MedicineLine>
  onDone: () => void
}) {
  const [doctors, setDoctors] = useState<SelectOption[]>([])
  const [doctor, setDoctor] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const toLab = send.purpose === 'lab_test'

  useEffect(() => {
    let current = true
    loadClinicians(client).then((found) => {
      if (current)
        setDoctors(found.map((person) => ({ value: person.id, label: person.full_name })))
    })
    return () => {
      current = false
    }
  }, [client])

  async function go() {
    setBusy(true)
    setProblem(null)
    const answer = toLab
      ? await sendPaidToLab(
          client,
          send.paymentId,
          send.lines.map((line) => line.label),
          doctor || null,
        )
      : await sendPaidToPharmacy(
          client,
          send.paymentId,
          send.lines.map((line) => {
            const known = drugLines[line.label]
            return {
              drug: known ? known.name : line.label,
              strength: known?.strength ?? null,
              quantity: line.qty
                ? `${line.qty}${known?.unit ? ` ${unitWords(known.unit, Number(line.qty))}` : ''}`
                : null,
            }
          }),
          doctor || null,
        )
    setBusy(false)
    if (answer) setProblem(answer)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className={styles.ok}>
        <b>{toLab ? 'Sent to the Laboratory.' : 'Sent to the Pharmacy.'}</b>
        <button type="button" className={styles.button} onClick={onDone}>
          Done
        </button>
      </div>
    )
  }
  return (
    <div className={styles.payBox}>
      <b>{toLab ? 'Now send the tests to the Laboratory' : 'Now send the drugs to the Pharmacy'}</b>
      <span className={styles.muted}>
        {send.lines.map((line) => line.label + (line.qty ? ` × ${line.qty}` : '')).join(', ')}
      </span>
      <label htmlFor={`send-doctor-${send.paymentId}`} className={styles.fieldTitle}>
        Which doctor wrote the paper? (optional)
      </label>
      <SearchSelect
        id={`send-doctor-${send.paymentId}`}
        value={doctor}
        placeholder="Choose the doctor"
        options={doctors}
        onChange={setDoctor}
      />
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={busy}
          onClick={go}
        >
          {busy ? 'Sending…' : toLab ? 'Send to the Laboratory' : 'Send to the Pharmacy'}
        </button>
        <button type="button" className={styles.button} onClick={onDone} disabled={busy}>
          Not now
        </button>
      </div>
    </div>
  )
}
