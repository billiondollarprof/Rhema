/*
 * components/orders/BillForm.tsx: "Add a bill". A doctor or the matron
 * bills a patient for a procedure, an operation, the bed fee, a
 * consultation, a dressing, a catheter or anything else.
 *
 * Why: the director's voice note and Anthony, 2026-11-21 and 22 (request
 * 235, part 3): bills and prices come from the doctor, "the system should be
 * able to automatically calculate the total... So the front desk sees it."
 *
 * How it goes:
 *   1. Each line: what it is for (Procedure, Operation, Bed fee and the
 *      rest), its name, and its amount. The amount fills in from the
 *      standard price, else this person's last price for that name.
 *   2. "+ Add another line" for more. The total shows.
 *   3. Send bill: the Front Desk sees it in Bills to pay. Then "Make these
 *      the standard prices?" for amounts that are new or not the standard.
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
import { BILL_KINDS, addBill, billKindWords, type BillKind } from '@/lib/bills/bills'
import {
  loadMyPrices,
  loadPrices,
  myPriceOf,
  priceKey,
  priceOf,
  readAmount,
  type MyPrice,
  type Price,
} from '@/lib/prices/prices'
import type { PatientResult } from '@/lib/patients/patients'

// One line as typed: the kind, its name and its amount, as text.
type Line = { key: number; kind: BillKind | ''; item: string; amount: string }

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

  // The unsaved bill, kept 30 minutes on this device, like every form.
  const draft = useDraft({
    staffId,
    name: `bill-${patient.id}`,
    value: { lines, note },
    isEmpty: (typed) =>
      !typed.note.trim() && typed.lines.every((line) => !line.kind && !line.item && !line.amount),
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
        // A kind picked: its name fills in, unless a name was typed already.
        if (part.kind !== undefined) {
          const before = line.kind ? billKindWords(line.kind) : ''
          if (!line.item.trim() || line.item === before) {
            next.item = part.kind === 'other' ? '' : billKindWords(part.kind as BillKind)
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

  const amounts = lines.map((line) => readAmount(line.amount) ?? 0)
  const total = amounts.reduce((sum, amount) => sum + amount, 0)

  // ===== 3. Send =====
  async function send() {
    const ready: { kind: BillKind; item: string; amount: number }[] = []
    for (const line of lines) {
      const amount = readAmount(line.amount)
      if (!line.kind || line.item.trim().length < 2 || amount === null) {
        setError('Each line needs what it is for, a name and an amount, like 5,000.')
        return
      }
      ready.push({ kind: line.kind, item: line.item.trim(), amount })
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
    setToStandard(
      ready.flatMap((line) => {
        const now = priceOf(list, 'procedure', line.item)
        return now === line.amount
          ? []
          : [{ kind: 'procedure' as const, item: line.item, amount: line.amount, now }]
      }),
    )
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
      {lines.map((line, index) => (
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
                value={line.kind}
                options={BILL_KINDS.map((one) => ({ value: one.kind, label: one.words }))}
                onChange={(value) => change(index, { kind: value as BillKind })}
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
                value={line.amount}
                onChange={(event) =>
                  change(index, { amount: event.target.value.replace(/[^\d.,\s]/g, '') })
                }
              />
            </div>
          </div>
        </div>
      ))}

      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setLines((all) => [...all, emptyLine()])}
          disabled={lines.length >= 20}
        >
          + Add another line
        </button>
      </div>

      {total > 0 ? (
        <p className={styles.total}>
          Total <b>{naira(total)}</b>
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

      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.buttons}>
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
}
