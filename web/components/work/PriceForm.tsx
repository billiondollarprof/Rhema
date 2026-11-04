/*
 * components/work/PriceForm.tsx: the Front Desk's payment form, used for lab tests
 * and for drugs: a price for each line, the total worked out by the app,
 * and how it was paid (Cash, POS, Transfer).
 *
 * Why: Anthony, 2026-10-31: "let the app always work out the total, the
 * front desk and the lab, they should be able to type in their price. For
 * now, they are typing in manually."
 *
 * The total shown here is only for the eye. The database adds up the same
 * lines itself, so what is saved is always the true sum.
 *
 * Never: send a total of our own; send the lines and let the database add.
 */
'use client'

import { useState } from 'react'
import styles from './work.module.css'
import { PAYMENT_MODES, naira, type PaymentMode } from '@/lib/lab/lab'

type Line = { label: string; amount: number }

// "7,500" and "7500.50" both read as numbers; anything else reads as 0.
function readNaira(typed: string): number {
  const value = Number(typed.replace(/[,\s]/g, ''))
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

export default function PriceForm({
  formId,
  labels,
  save,
  onCancel,
  onDone,
}: {
  // Keeps each box's label tied to its own box when several forms are open.
  formId: string
  // One line per test or drug, e.g. "Malaria test", "Paracetamol 500 mg".
  labels: string[]
  save: (lines: Line[], mode: PaymentMode) => Promise<string | null>
  onCancel: () => void
  onDone: () => void
}) {
  const [typed, setTyped] = useState<string[]>(labels.map(() => ''))
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amounts = typed.map(readNaira)
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  const ready = amounts.every((amount) => amount > 0 && amount < 100000000)

  async function record() {
    setBusy(true)
    setError(null)
    const problem = await save(
      labels.map((label, at) => ({ label, amount: amounts[at] })),
      mode,
    )
    setBusy(false)
    if (problem) setError(problem)
    else onDone()
  }

  return (
    <div className={styles.payForm}>
      {/* ----- A price for each line ----- */}
      {labels.map((label, at) => (
        <div key={label + at} className={styles.priceLine}>
          <label htmlFor={`${formId}-${at}`}>{label}</label>
          <div className={styles.money}>
            <span aria-hidden="true">₦</span>
            <input
              id={`${formId}-${at}`}
              inputMode="decimal"
              placeholder="0"
              value={typed[at]}
              autoFocus={at === 0}
              onChange={(event) => {
                const value = event.target.value.replace(/[^\d.,\s]/g, '')
                setTyped((all) => all.map((old, index) => (index === at ? value : old)))
              }}
            />
          </div>
        </div>
      ))}

      {/* ----- The total, worked out as they type ----- */}
      <div className={styles.total}>
        <span>Total</span>
        <b>{naira(total)}</b>
      </div>

      <span className={styles.fieldLabel}>Paid by</span>
      <div className={styles.segments} role="group" aria-label="Paid by">
        {PAYMENT_MODES.map(([value, words]) => (
          <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>
            {words}
          </button>
        ))}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.entryButtons}>
        <button className={styles.button} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          className={`${styles.button} ${styles.primary}`}
          onClick={record}
          disabled={!ready || busy}
        >
          {busy ? 'Saving…' : `Record payment · ${naira(total)}`}
        </button>
      </div>
    </div>
  )
}
