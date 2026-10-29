/*
 * record/_parts/ReasonForm.tsx: asks "why?" before a line is voided, or a
 * medicine suspended or stopped. Quick choices, or one short line typed.
 * It will not save without a reason (Anthony, 2026-10-29: "you have to add
 * a reason, even if the reason is just one small line").
 *
 * Never: save an empty reason. The database refuses it too.
 */
'use client'

import { useState } from 'react'
import styles from './record.module.css'

type ReasonProps = {
  question: string
  choices: string[]
  confirmLabel: string
  onConfirm: (reason: string) => Promise<string | null>
  onCancel: () => void
}

export default function ReasonForm({
  question,
  choices,
  confirmLabel,
  onConfirm,
  onCancel,
}: ReasonProps) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function confirm() {
    if (!reason.trim()) {
      setProblem('Give a short reason.')
      return
    }
    setBusy(true)
    const result = await onConfirm(reason)
    setBusy(false)
    if (result) setProblem(result)
  }

  return (
    <div className={styles.form}>
      <b>{question}</b>
      <div className={styles.chips}>
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className={styles.chip}
            aria-pressed={reason === choice}
            onClick={() => {
              setReason(choice)
              setProblem(null)
            }}
          >
            {choice}
          </button>
        ))}
      </div>
      <input
        className={styles.input}
        aria-label="Reason"
        placeholder="Or type a short reason"
        maxLength={300}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value)
          setProblem(null)
        }}
      />
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.actions}>
        <button className={`${styles.small} ${styles.primary}`} disabled={busy} onClick={confirm}>
          {busy ? 'Saving…' : confirmLabel}
        </button>
        <button className={styles.small} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
