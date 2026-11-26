/*
 * components/orders/BillForm.tsx: "Add a bill". A doctor, the matron or
 * anybody in a consulting room bills a patient, on the lines of the
 * hospital's Discharge / Billing Form.
 *
 * Why: the director's voice note and Anthony, 2026-11-21 and 22 (request
 * 235, part 3): bills and prices come from the doctor, "the system should be
 * able to automatically calculate the total... So the front desk sees it."
 *
 * How it goes:
 *   1. Each line: what it is for (Procedure, Operation, Bed fee and the
 *      rest, or a name used before, or Other to type a new one), its name,
 *      and its amount. The amount fills in from the standard price, else
 *      this person's last price for that name.
 *      A name typed with Other shows in the box, not "Other", and comes
 *      back as its own choice next time (request 240g, 2026-11-23: "that
 *      new name... becomes what appears in the field, not [Other]").
 *   2. "+ Add another line" for more. The total shows.
 *   3. Preview: the receipt as the patient will see it, line by line, each
 *      line still open to change (request 240f). Then Send bill: the Front
 *      Desk sees it in Bills to pay. Then "Make these the standard prices?"
 *      for amounts that are new or not the standard.
 *
 * An inpatient (request 240, 2026-11-23): the bill starts with the lines
 * worked out from the stay: Medicines given (doses given × the price of a
 * dose), Take Home Drugs (prescriptions of the stay) and Laboratory tests,
 * paid or not. Under each, the names for the doctor; the receipt shows only
 * the line. At the bottom: billed before in this stay, paid since admission
 * (deposits too, and the drugs and tests already paid on their own), and
 * the balance.
 * Each of these three lines has a tick, "Put on this bill" (request 245,
 * 2026-11-24: "If a line is not selected, it should not appear on the
 * receipt"). Ticked: it needs an amount and goes on the bill, and the bill
 * settles what it is made of. Not ticked: it is left off, and what it is
 * made of stays for the next bill (the database settles only the lines on
 * the bill, 20261124094742). It starts ticked when it has an amount.
 *
 * Never: send a total. The database adds the lines up itself.
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './orders.module.css'
import SearchSelect from '@/components/options/SearchSelect'
import MakeStandard, { type Candidate } from './MakeStandard'
import DraftBack from '@/components/drafts/DraftBack'
import { useDraft } from '@/lib/drafts/drafts'
import { naira } from '@/lib/lab/lab'
import {
  BILL_KINDS,
  addBill,
  billKindWords,
  balanceWords,
  loadStatement,
  sumOf,
  type BillKind,
  type Statement,
} from '@/lib/bills/bills'
import {
  loadMyPrices,
  loadPrices,
  myPriceOf,
  priceKey,
  priceOf,
  amountWrong,
  readAmount,
  type MyPrice,
  type Price,
} from '@/lib/prices/prices'
import type { PatientResult } from '@/lib/patients/patients'

// One line as typed: the kind, its name and its amount, as text. auto: a
// line worked out from the stay (its kind and name are fixed).
// on: a line worked out from the stay is ticked to go on this bill.
type Line = {
  key: number
  kind: BillKind | ''
  item: string
  amount: string
  auto?: boolean
  on?: boolean
}

let nextKey = 1
const emptyLine = (): Line => ({ key: nextKey++, kind: '', item: '', amount: '' })

export default function BillForm({
  client,
  staffId,
  patient,
}: {
  client: SupabaseClient
  staffId: string
  patient: Pick<PatientResult, 'id' | 'full_name'>
}) {
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [toStandard, setToStandard] = useState<Candidate[]>([])
  // The receipt preview is open (request 240f).
  const [previewing, setPreviewing] = useState(false)

  // ===== 0. The stay: lines worked out from it, for an inpatient =====
  const [statement, setStatement] = useState<Statement | null>(null)
  // A medicine given with no price (request 247): the price of one dose the
  // doctor types, by the medicine's name. It adds into Medicines given, and
  // is offered as the drug's standard price after sending.
  const [dosePrices, setDosePrices] = useState<Record<string, string>>({})
  useEffect(() => {
    let current = true
    void loadStatement(client, patient.id).then((found) => {
      if (!current || !found) return
      setStatement(found)
      if (!found.admitted) return
      // A line for each that has anything in it, even with no price yet:
      // then its amount box waits to be filled.
      const worked: Line[] = [
        {
          kind: 'medicines_given',
          item: 'Medicines given',
          count: (found.medicines ?? []).length,
          amount: sumOf((found.medicines ?? []).map((one) => one.amount)),
        },
        {
          kind: 'take_home_drugs',
          item: 'Take Home Drugs',
          count: (found.prescriptions ?? []).length,
          amount: sumOf((found.prescriptions ?? []).map((one) => one.amount)),
        },
        {
          kind: 'lab_tests',
          item: 'Laboratory tests',
          count: (found.labs ?? []).length,
          amount: sumOf((found.labs ?? []).map((one) => one.amount)),
        },
      ]
        .filter((one) => one.count > 0)
        .map((one) => ({
          key: nextKey++,
          kind: one.kind as BillKind,
          item: one.item,
          amount: one.amount > 0 ? String(one.amount) : '',
          auto: true,
          on: one.amount > 0,
        }))
      // Before the doctor's own lines, once; a draft put back keeps its own.
      if (worked.length)
        setLines((all) => (all.some((line) => line.auto) ? all : [...worked, ...all]))
    })
    return () => {
      current = false
    }
  }, [client, patient.id])

  // ===== 1. The standard prices and this person's last prices =====
  const [list, setList] = useState<Price[]>([])
  const [mine, setMine] = useState<MyPrice[]>([])
  useEffect(() => {
    let current = true
    void Promise.all([loadMyPrices(client), loadPrices(client)]).then(([own, standard]) => {
      if (!current) return
      setMine(own)
      setList(standard ?? [])
    })
    return () => {
      current = false
    }
  }, [client])
  // The standard price first, else this person's last price.
  const priceFor = (item: string) =>
    priceOf(list, 'procedure', item) ?? myPriceOf(mine, 'procedure', priceKey(item))

  // ===== 1b. What a line can be for: the kinds, then every name used
  // before (a standard price, or this person's own), then Other. =====
  const kindWords = new Set(BILL_KINDS.map((one) => one.words.toLowerCase()))
  const usedNames: string[] = []
  for (const name of [
    ...list.filter((price) => price.kind === 'procedure').map((price) => price.item),
    // Own prices are kept in small letters: a capital first, to read well.
    ...mine
      .filter((price) => price.kind === 'procedure')
      .map((price) => price.item.charAt(0).toUpperCase() + price.item.slice(1)),
  ]) {
    const seen = usedNames.some((one) => one.toLowerCase() === name.toLowerCase())
    if (!seen && !kindWords.has(name.toLowerCase())) usedNames.push(name)
  }
  const choices = [
    ...BILL_KINDS.filter((one) => one.kind !== 'others').map((one) => ({
      value: one.kind as string,
      label: one.words,
    })),
    ...usedNames.map((name) => ({ value: name, label: name, group: 'Used before' })),
  ]
  // The box shows the kind, or for Others, the name typed.
  const boxValue = (line: Line) => (line.kind === 'others' ? line.item || 'Others' : line.kind)
  // A kind, or a name: a name is an Others line with that name.
  function pick(at: number, value: string) {
    if (BILL_KINDS.some((one) => one.kind === value)) change(at, { kind: value as BillKind })
    else change(at, { kind: 'others', item: value })
  }

  // The unsaved bill, kept 30 minutes on this device, like every form.
  const draft = useDraft({
    staffId,
    name: `bill-${patient.id}`,
    value: { lines, note },
    isEmpty: (typed) =>
      !typed.note.trim() &&
      typed.lines.every((line) => line.auto || (!line.kind && !line.item && !line.amount)),
    restore: (typed) => {
      setLines(typed.lines.map((line) => ({ ...line, key: nextKey++ })))
      setNote(typed.note)
    },
  })

  // ===== 2. Changing a line =====
  function change(at: number, part: Partial<Omit<Line, 'key'>>) {
    setLines((all) =>
      all.map((line, index) => {
        if (index !== at) return line
        const next = { ...line, ...part }
        // A kind picked: its name fills in, unless a name was typed already
        // or comes with it (a name chosen or typed with Other).
        if (part.kind !== undefined && part.item === undefined) {
          const before = line.kind ? billKindWords(line.kind) : ''
          if (!line.item.trim() || line.item === before) {
            next.item = part.kind === 'others' ? '' : billKindWords(part.kind as BillKind)
          }
        }
        // The amount fills in for the name, unless one was typed already.
        if ((part.kind !== undefined || part.item !== undefined) && !line.amount.trim()) {
          const known = next.item.trim() ? priceFor(next.item) : undefined
          if (known) next.amount = String(known)
        }
        return next
      }),
    )
  }

  // A line of the stay left off this bill counts for nothing.
  const amounts = lines.map((line) => (line.auto && !line.on ? 0 : (readAmount(line.amount) ?? 0)))
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  // An inpatient: paid since admission, counting the drugs and tests of this
  // bill already paid on their own (the database counts them once the bill
  // covers them), and what this stay owes once this bill is added.
  // Only for the drug and test lines ticked onto this bill.
  const ticked = (kind: BillKind) =>
    lines.some((line) => line.auto && line.on && line.kind === kind)
  const paidSoFar = statement?.admitted
    ? Number(statement.paid ?? 0) +
      sumOf(
        [
          ...(ticked('take_home_drugs') ? (statement.prescriptions ?? []) : []),
          ...(ticked('lab_tests') ? (statement.labs ?? []) : []),
        ]
          .filter((one) => one.paid)
          .map((one) => one.amount),
      )
    : 0
  const stayBalance = statement?.admitted ? Number(statement.billed ?? 0) + total - paidSoFar : null

  // Medicines given, worked out again when the doctor types a dose price.
  function typeDosePrice(medicine: string, typed: string) {
    const next = { ...dosePrices, [medicine]: typed }
    setDosePrices(next)
    const sum = sumOf(
      (statement?.medicines ?? []).map((one) =>
        one.amount != null ? one.amount : one.doses * (readAmount(next[one.medicine] ?? '') ?? 0),
      ),
    )
    setLines((all) =>
      all.map((line) =>
        line.auto && line.kind === 'medicines_given'
          ? { ...line, amount: sum > 0 ? String(sum) : '', on: sum > 0 ? true : line.on }
          : line,
      ),
    )
  }

  // Every line ready, or the words to show (Preview and Send both check).
  function readyLines(): { kind: BillKind; item: string; amount: number }[] | string {
    const ready: { kind: BillKind; item: string; amount: number }[] = []
    for (const line of lines) {
      // A doctor's line left empty, or a stay's line not ticked, is simply
      // not on the bill (request 245).
      if (!line.auto && !line.kind && !line.item.trim() && !line.amount.trim()) continue
      if (line.auto && !line.on) continue
      const amount = readAmount(line.amount)
      if (!line.kind || line.item.trim().length < 2 || amount === null) {
        return 'Each line needs what it is for, a name and an amount, like 5,000.'
      }
      ready.push({ kind: line.kind, item: line.item.trim(), amount })
    }
    return ready.length ? ready : 'Add a line.'
  }

  // ===== 3. Send =====
  async function send() {
    const ready = readyLines()
    if (typeof ready === 'string') {
      setError(ready)
      setPreviewing(false)
      return
    }
    setBusy(true)
    setError(null)
    const problem = await addBill(client, patient.id, ready, note)
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    draft.clear()
    // Amounts that are new, or not the standard: offer them as standard.
    // Not the lines worked out from the stay.
    const linePrices: Candidate[] = ready.flatMap((line) => {
      if (['medicines_given', 'take_home_drugs', 'lab_tests'].includes(line.kind)) return []
      const now = priceOf(list, 'procedure', line.item)
      return now === line.amount
        ? []
        : [{ kind: 'procedure' as const, item: line.item, amount: line.amount, now }]
    })
    // And a dose price typed for a medicine with none: the drug's standard
    // (request 247: "the system should be learning").
    const drugPrices: Candidate[] = Object.entries(dosePrices).flatMap(([medicine, typed]) => {
      const amount = readAmount(typed)
      return amount ? [{ kind: 'drug' as const, item: medicine, amount }] : []
    })
    setToStandard([...drugPrices, ...linePrices])
    setSent(`Bill sent to the Front Desk: ${naira(total)}.`)
  }

  // ===== 4. Sent =====
  if (sent)
    return (
      <>
        <p className={styles.good}>{sent}</p>
        <MakeStandard client={client} candidates={toStandard} />
        <div className={styles.buttons}>
          <Link
            className={`${styles.button} ${styles.primary}`}
            href={`/patients/?p=${patient.id}`}
          >
            Back to patient
          </Link>
          <Link className={styles.button} href="/">
            Home
          </Link>
        </div>
      </>
    )

  // ===== 4b. The preview: the receipt, line by line (request 240f) =====
  // The lines that will be sent (an empty line is left out).
  const checked = readyLines()
  const previewLines = typeof checked === 'string' ? [] : checked
  if (previewing)
    return (
      <>
        <div className={styles.preview} aria-label="Receipt preview">
          <b>Receipt preview</b>
          <p className={styles.muted}>{patient.full_name}</p>
          <ol className={styles.previewLines}>
            {previewLines.map((line, index) => (
              <li key={`${line.kind}-${index}`}>
                <span>{line.item || billKindWords(line.kind)}</span>
                <b>{naira(line.amount)}</b>
              </li>
            ))}
          </ol>
          <p className={styles.previewTotal}>
            <span>Total</span>
            <b>{naira(total)}</b>
          </p>
          {statement?.admitted ? (
            <>
              <p className={styles.previewTotal}>
                <span>Paid since admission</span>
                <b>{naira(paidSoFar)}</b>
              </p>
              {Number(statement.billed ?? 0) > 0 ? (
                <p className={styles.previewTotal}>
                  <span>Billed before in this stay</span>
                  <b>{naira(Number(statement.billed))}</b>
                </p>
              ) : null}
              <p className={styles.previewTotal}>
                <span>Balance</span>
                <b>{balanceWords(stayBalance ?? 0, naira)}</b>
              </p>
            </>
          ) : null}
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() => setPreviewing(false)}
          >
            Change
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={send}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Send bill'}
          </button>
        </div>
      </>
    )

  // ===== 5. The form =====
  return (
    <>
      {draft.restoredAt ? (
        <DraftBack
          savedAt={draft.restoredAt}
          what="bill"
          onContinue={draft.keep}
          onDiscard={() => {
            setLines([emptyLine()])
            setNote('')
            draft.clear()
          }}
        />
      ) : null}

      {/* ----- One block per line ----- */}
      {lines.map((line, index) =>
        line.auto ? (
          <AutoLine
            key={line.key}
            line={line}
            index={index}
            statement={statement}
            onAmount={(amount) => change(index, { amount })}
            onTick={(on) => change(index, { on })}
            dosePrices={dosePrices}
            onDosePrice={typeDosePrice}
          />
        ) : (
          <div key={line.key} className={styles.drug}>
            <div className={styles.drugTop}>
              <b>Line {index + 1}</b>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className={`${styles.button} ${styles.small}`}
                  onClick={() => setLines((all) => all.filter((_, at) => at !== index))}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className={styles.grid}>
              <div className={styles.wide}>
                <label className={styles.label} htmlFor={`bill-kind-${index}`}>
                  What for
                </label>
                <SearchSelect
                  id={`bill-kind-${index}`}
                  value={boxValue(line)}
                  options={choices}
                  onChange={(value) => pick(index, value)}
                  // Other: what was typed in the search becomes the name, or
                  // the Name box waits for it.
                  onOther={(typed) => {
                    change(index, { kind: 'others', item: typed })
                    if (!typed)
                      window.setTimeout(
                        () => document.getElementById(`bill-item-${index}`)?.focus(),
                        50,
                      )
                  }}
                />
              </div>
              <div>
                <label className={styles.label} htmlFor={`bill-item-${index}`}>
                  Name
                </label>
                <input
                  id={`bill-item-${index}`}
                  className={styles.input}
                  maxLength={120}
                  placeholder="e.g. Wound dressing"
                  value={line.item}
                  onChange={(event) => change(index, { item: event.target.value })}
                />
              </div>
              <div>
                <label className={styles.label} htmlFor={`bill-amount-${index}`}>
                  Amount ₦
                </label>
                <input
                  id={`bill-amount-${index}`}
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="e.g. 5,000"
                  aria-invalid={amountWrong(line.amount) ? 'true' : undefined}
                  value={line.amount}
                  onChange={(event) =>
                    change(index, { amount: event.target.value.replace(/[^\d.,\s]/g, '') })
                  }
                />
              </div>
            </div>
          </div>
        ),
      )}

      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setLines((all) => [...all, emptyLine()])}
          disabled={lines.length >= 40}
        >
          + Add another line
        </button>
      </div>

      {total > 0 ? (
        <p className={styles.total}>
          Total <b>{naira(total)}</b>
        </p>
      ) : null}
      {/* An inpatient: what was paid since admission, and what is left. */}
      {statement?.admitted ? (
        <p className={styles.muted}>
          Paid since admission {naira(paidSoFar)}
          {Number(statement.billed ?? 0) > 0
            ? ` · Billed before in this stay ${naira(Number(statement.billed))}`
            : ''}{' '}
          · <b>Balance {balanceWords(stayBalance ?? 0, naira)}</b>
        </p>
      ) : null}

      {/* ----- A note for the Front Desk ----- */}
      <div>
        <label className={styles.label} htmlFor="bill-note">
          Note (optional)
        </label>
        <textarea
          id="bill-note"
          className={styles.input}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {lines.some((line) => amountWrong(line.amount)) ||
      Object.values(dosePrices).some((price) => amountWrong(price)) ? (
        <p className={styles.error}>
          The amount in red is not an amount. Type it in naira, like 5,000.
        </p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={() => {
            const ready = readyLines()
            if (typeof ready === 'string') setError(ready)
            else {
              setError(null)
              setPreviewing(true)
            }
          }}
        >
          Preview
        </button>
      </div>
    </>
  )
}

// ===== 6. A line worked out from the stay =====
// Its name is fixed; its amount can change. Under it, what it is made of,
// for the doctor only (the receipt never names a medicine or a test).
function AutoLine({
  line,
  index,
  statement,
  onAmount,
  onTick,
  dosePrices,
  onDosePrice,
}: {
  line: Line
  index: number
  statement: Statement | null
  onAmount: (amount: string) => void
  onTick: (on: boolean) => void
  dosePrices: Record<string, string>
  onDosePrice: (medicine: string, typed: string) => void
}) {
  // Medicines with no price: a box each for the price of one dose (247).
  const unpriced =
    line.kind === 'medicines_given'
      ? (statement?.medicines ?? []).filter((one) => one.amount == null)
      : []
  const parts: string[] =
    line.kind === 'medicines_given'
      ? (statement?.medicines ?? [])
          .filter((one) => one.amount != null)
          .map(
            (one) =>
              `${one.medicine}: ${naira(Number(one.dose_price))} × ${one.doses} = ${naira(Number(one.amount))}`,
          )
      : line.kind === 'take_home_drugs'
        ? (statement?.prescriptions ?? []).map(
            (one) =>
              `${one.drugs}: ${one.amount ? naira(Number(one.amount)) : 'no price'}${one.paid ? ' (paid)' : ' (not paid)'}`,
          )
        : (statement?.labs ?? []).map(
            (one) =>
              `${one.tests}: ${one.amount ? naira(Number(one.amount)) : 'no price'}${one.paid ? ' (paid)' : ' (not paid)'}`,
          )
  return (
    <div className={styles.drug}>
      <div className={styles.drugTop}>
        <b>{line.item}</b>
      </div>
      <label className={styles.standardRow}>
        <input
          type="checkbox"
          checked={Boolean(line.on)}
          onChange={(event) => onTick(event.target.checked)}
        />
        <span>Put on this bill</span>
      </label>
      <details open={unpriced.length > 0}>
        <summary>What it is made of ({parts.length + unpriced.length})</summary>
        <ul className={styles.autoParts}>
          {parts.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ul>
        {/* No price on the chart or the list: type one dose's price. */}
        {unpriced.map((one, at) => (
          <div key={one.medicine} className={styles.priceRow}>
            <label htmlFor={`dose-price-${index}-${at}`}>
              {one.medicine} × {one.doses}: price of one dose ₦
            </label>
            <input
              id={`dose-price-${index}-${at}`}
              className={styles.input}
              inputMode="decimal"
              placeholder="No price yet"
              aria-invalid={amountWrong(dosePrices[one.medicine]) ? 'true' : undefined}
              value={dosePrices[one.medicine] ?? ''}
              onChange={(event) =>
                onDosePrice(one.medicine, event.target.value.replace(/[^\d.,\s]/g, ''))
              }
            />
            {/* The worked total, so one dose's price reads plainly (2026-11-25). */}
            {readAmount(dosePrices[one.medicine] ?? '') ? (
              <small className={styles.muted}>
                × {one.doses} ={' '}
                {naira((readAmount(dosePrices[one.medicine] ?? '') ?? 0) * one.doses)}
              </small>
            ) : null}
          </div>
        ))}
      </details>
      {/* Not ticked: no amount, and it stays for the next bill. */}
      {line.on ? (
        <div>
          <label className={styles.label} htmlFor={`bill-amount-${index}`}>
            Amount ₦
          </label>
          <input
            id={`bill-amount-${index}`}
            className={styles.input}
            inputMode="decimal"
            // No price on some of it yet: the doctor types the amount.
            placeholder="Type the amount"
            aria-invalid={amountWrong(line.amount) ? 'true' : undefined}
            value={line.amount}
            onChange={(event) => onAmount(event.target.value.replace(/[^\d.,\s]/g, ''))}
          />
        </div>
      ) : (
        <p className={styles.muted}>Left off this bill. It stays for the next one.</p>
      )}
    </div>
  )
}
