/*
 * record/_parts/Line.tsx: one line of the record, the same shape in every
 * section: what it is (left), its status (right), who and when (under),
 * then its buttons. A voided line stays, greyed and crossed out, with who
 * voided it and why.
 *
 * Never: remove a voided line from view. Seeing what was corrected, and by
 * whom, is part of the record.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import ReasonForm from './ReasonForm'
import styles from './record.module.css'
import { VOID_REASONS, voidItem, type VoidableTable } from '@/lib/record/record'

type LineProps = {
  what: React.ReactNode
  status?: React.ReactNode
  meta: string
  voided: { reason: string | null; by: string | null } | null
  // Pass these to show a Void button on the line.
  voidable?: {
    client: SupabaseClient
    table: VoidableTable
    id: number
    staffId: string
    onDone: () => void
  }
  actions?: React.ReactNode
  // Shown under the line in place of its buttons, e.g. the Give dose form.
  form?: React.ReactNode
  children?: React.ReactNode
}

export default function Line({
  what,
  status,
  meta,
  voided,
  voidable,
  actions,
  form,
  children,
}: LineProps) {
  const [voiding, setVoiding] = useState(false)

  return (
    <div className={`${styles.line} ${voided ? styles.voided : ''}`}>
      <div className={styles.lineTop}>
        <div className={styles.what}>{what}</div>
        {voided ? <span className={`${styles.pill} ${styles.grey}`}>Voided</span> : status}
      </div>
      {children}
      <span className={styles.lineMeta}>{meta}</span>
      {voided ? (
        <span className={styles.lineMeta}>
          Voided{voided.by ? ` by ${voided.by}` : ''}: {voided.reason}
        </span>
      ) : null}
      {!voided && form ? form : null}
      {!voided && !form && voiding && voidable ? (
        <ReasonForm
          question="Why void this?"
          choices={VOID_REASONS}
          confirmLabel="Void"
          onCancel={() => setVoiding(false)}
          onConfirm={async (reason) => {
            const problem = await voidItem(
              voidable.client,
              voidable.table,
              voidable.id,
              reason,
              voidable.staffId,
            )
            if (!problem) {
              setVoiding(false)
              voidable.onDone()
            }
            return problem
          }}
        />
      ) : null}
      {!voided && !form && !voiding && (actions || voidable) ? (
        <div className={styles.actions}>
          {actions}
          {voidable ? (
            <button className={`${styles.small} ${styles.link}`} onClick={() => setVoiding(true)}>
              Void
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
