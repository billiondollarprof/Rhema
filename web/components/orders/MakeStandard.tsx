/*
 * components/orders/MakeStandard.tsx: "Make these the standard prices?",
 * shown after a doctor or the matron sends a prescription or a lab request
 * with prices that are new or differ from the standard (request 236).
 *
 * Why: Anthony, 2026-11-22: "once they press save, show them a dialogue
 * button to make the price a standard price... it sticks. Can also decide
 * to edit the price... put a new standard price... no clutter... easy to
 * understand by any one." So: one small card, a tick for each price (all
 * ticked), Make standard and Not now. A standard price fills in for every
 * doctor and the matron next time; they can still change it.
 *
 * Never: change a standard price without the tap on Make standard.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './orders.module.css'
import { naira } from '@/lib/lab/lab'
import { makeStandardPrices, type StandardPrice } from '@/lib/prices/prices'

// A price to offer, with the standard it would replace (if any).
export type Candidate = StandardPrice & { now?: number }

export default function MakeStandard({
  client,
  candidates,
}: {
  client: SupabaseClient
  candidates: Candidate[]
}) {
  // ===== 1. Which are ticked (all, to start), and what happened =====
  const [ticked, setTicked] = useState<boolean[]>(() => candidates.map(() => true))
  const [state, setState] = useState<'asking' | 'busy' | 'saved' | 'skipped'>('asking')
  const [problem, setProblem] = useState<string | null>(null)

  if (candidates.length === 0 || state === 'skipped') return null
  if (state === 'saved') return <p className={styles.good}>Saved as the standard prices.</p>

  // ===== 2. Save the ticked ones =====
  async function save() {
    const chosen = candidates.filter((_, at) => ticked[at])
    if (chosen.length === 0) {
      setState('skipped')
      return
    }
    setState('busy')
    setProblem(null)
    const failed = await makeStandardPrices(
      client,
      chosen.map(({ kind, item, amount }) => ({ kind, item, amount })),
    )
    if (failed) {
      setProblem(failed)
      setState('asking')
    } else setState('saved')
  }

  // ===== 3. The card =====
  return (
    <div className={styles.standardCard} role="group" aria-label="Make these the standard prices?">
      <b>Make these the standard prices?</b>
      <p className={styles.muted}>They fill in for every doctor next time.</p>
      {candidates.map((price, at) => (
        <label key={`${price.kind}-${price.item}`} className={styles.standardRow}>
          <input
            type="checkbox"
            checked={ticked[at]}
            onChange={(event) =>
              setTicked((all) =>
                all.map((old, index) => (index === at ? event.target.checked : old)),
              )
            }
          />
          <span>
            {price.item} <b>{naira(price.amount)}</b>
            {price.now ? <small> (now {naira(price.now)})</small> : null}
          </span>
        </label>
      ))}
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={state === 'busy'}
          onClick={save}
        >
          {state === 'busy' ? 'Saving…' : 'Make standard'}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={state === 'busy'}
          onClick={() => setState('skipped')}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
