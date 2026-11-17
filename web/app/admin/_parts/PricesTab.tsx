/*
 * app/admin/_parts/PricesTab.tsx: the hospital's price list (Settings,
 * part 1): the card fee, the consultation fee, and a price for each lab test.
 *
 * Why: Anthony, 2026-11-16 (requests 197 and 201): settings for the admin,
 * one part at a time, prices first. The Front Desk then sees the price
 * filled in (or offered, for the optional card fee) and can still change it
 * for one patient.
 *
 * At the top (request 208, 2026-11-16): lab test prices the Laboratory sent,
 * waiting for the admin, with Approve and Refuse. One not answered within 72
 * hours becomes standard on its own.
 *
 * How it goes:
 *   1. Card fee and consultation: type the amount, tap Save.
 *   2. Lab tests: choose a test from the drop down, type the price, tap Save.
 *      The tests with a price are listed below, each with Change and Remove.
 *
 * The database decides who may change a price (set_price, admin only). This
 * screen only asks, and every change is in the activity log.
 *
 * Never: show anything about a patient.
 */
'use client'

import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './admin.module.css'
import SearchSelect, { type SelectOption } from '@/components/options/SearchSelect'
import { LAB_SECTIONS } from '@/lib/lab/catalogue'
import {
  CARD_ITEMS,
  cardPriceFor,
  CONSULTATION_ITEM,
  decidePrice,
  loadPriceChanges,
  loadPrices,
  priceOf,
  standardOn,
  type PriceChange,
  readAmount,
  setPrice,
  type Price,
  type PriceKind,
} from '@/lib/prices/prices'

// "₦2,000" for the eye.
function nairaWords(amount: number): string {
  return `₦${amount.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
}

export default function PricesTab({ client }: { client: SupabaseClient }) {
  const [prices, setPrices] = useState<Price[] | null>(null)
  const [changes, setChanges] = useState<PriceChange[]>([])

  // ===== 1. Read the list, and read it again after a change =====
  async function reload() {
    setPrices((await loadPrices(client)) ?? [])
    setChanges((await loadPriceChanges(client)) ?? [])
  }
  useEffect(() => {
    let current = true
    Promise.all([loadPrices(client), loadPriceChanges(client)]).then(([found, waiting]) => {
      if (!current) return
      setPrices(found ?? [])
      setChanges(waiting ?? [])
    })
    return () => {
      current = false
    }
  }, [client])

  if (prices === null) return <p className={styles.muted}>Loading the prices…</p>

  const labPrices = prices.filter((price) => price.kind === 'lab_test')

  return (
    <div className={styles.split}>
      {/* ===== 1b. Lab prices waiting for the admin (request 208) ===== */}
      {changes.length > 0 ? (
        <WaitingPrices client={client} changes={changes} prices={prices} onDone={reload} />
      ) : null}

      {/* ===== 2. Card fee and consultation ===== */}
      <div className={styles.card}>
        <h3>Fees</h3>
        <p className={styles.muted}>
          The Front Desk sees these when it takes a payment, and can still change the amount for one
          patient.
        </p>
        {/* One card fee for each kind of patient (2026-11-16). */}
        {(['individual', 'family', 'antenatal'] as const).map((kind) => (
          <OnePrice
            key={kind}
            client={client}
            id={`price-card-${kind}`}
            label={`Card fee: ${kind === 'individual' ? 'Individual' : kind === 'family' ? 'Family' : 'Antenatal'}`}
            kind="card"
            item={CARD_ITEMS[kind]}
            now={cardPriceFor(prices, kind)}
            onSaved={reload}
          />
        ))}
        <OnePrice
          client={client}
          id="price-consultation"
          label="Consultation fee"
          kind="consultation"
          item={CONSULTATION_ITEM}
          now={priceOf(prices, 'consultation', CONSULTATION_ITEM)}
          onSaved={reload}
        />
      </div>

      {/* ===== 3. Lab tests ===== */}
      <LabPrices client={client} labPrices={labPrices} onSaved={reload} />
    </div>
  )
}

// ===== 4. One price: a box and Save (an empty box removes it) =====
function OnePrice({
  client,
  id,
  label,
  kind,
  item,
  now,
  onSaved,
}: {
  client: SupabaseClient
  id: string
  label: string
  kind: PriceKind
  item: string
  now: number | undefined
  onSaved: () => Promise<void>
}) {
  // null: not touched, so the box shows the saved price.
  const [typed, setTyped] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const shown = typed ?? (now ? String(now) : '')

  async function save() {
    const amount = readAmount(shown)
    if (shown.trim() && amount === null) {
      setProblem('Type the amount in naira, like 2,000.')
      return
    }
    setBusy(true)
    setProblem(null)
    const answer = await setPrice(client, kind, item, amount)
    setBusy(false)
    if (answer) {
      setProblem(answer)
      return
    }
    await onSaved()
    setTyped(null)
    setSaved(true)
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.priceRow}>
        <span aria-hidden="true">₦</span>
        <input
          id={id}
          className={styles.input}
          inputMode="decimal"
          placeholder="No price yet"
          value={shown}
          aria-invalid={problem ? 'true' : undefined}
          onChange={(event) => {
            setSaved(false)
            setTyped(event.target.value.replace(/[^\d.,\s]/g, ''))
          }}
        />
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={busy || typed === null}
          onClick={save}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {problem ? <small className={styles.error}>{problem}</small> : null}
      {saved && !problem ? <small className={styles.good}>Saved.</small> : null}
      {now && !saved ? (
        <small className={styles.muted}>To remove this price, empty the box and tap Save.</small>
      ) : null}
    </div>
  )
}

// ===== 5. Lab tests: choose one, type its price =====
function LabPrices({
  client,
  labPrices,
  onSaved,
}: {
  client: SupabaseClient
  labPrices: Price[]
  onSaved: () => Promise<void>
}) {
  const [test, setTest] = useState('')

  const options = useMemo<SelectOption[]>(
    () =>
      LAB_SECTIONS.flatMap((section) =>
        section.tests.map((one) => {
          const amount = labPrices.find(
            (price) => price.item.toLowerCase() === one.name.toLowerCase(),
          )?.amount
          return {
            value: one.name,
            label: one.name,
            group: section.name,
            also: one.also,
            note: amount ? nairaWords(amount) : undefined,
          }
        }),
      ),
    [labPrices],
  )

  return (
    <div className={styles.card}>
      <h3>Lab test prices ({labPrices.length})</h3>
      <div className={styles.field}>
        <label htmlFor="price-test">Lab test</label>
        <SearchSelect
          id="price-test"
          value={test}
          placeholder="Choose a test"
          options={options}
          onChange={setTest}
          onOther={(typed) => setTest(typed)}
        />
      </div>
      {test ? (
        <OnePrice
          key={test}
          client={client}
          id="price-test-amount"
          label={`Price of ${test}`}
          kind="lab_test"
          item={test}
          now={labPrices.find((price) => price.item.toLowerCase() === test.toLowerCase())?.amount}
          onSaved={onSaved}
        />
      ) : null}

      {labPrices.length === 0 ? (
        <p className={styles.muted}>No lab test has a price yet.</p>
      ) : (
        <div className={styles.list}>
          {labPrices.map((price) => (
            <button
              key={price.id}
              type="button"
              className={styles.row}
              aria-current={price.item === test}
              onClick={() => setTest(price.item)}
            >
              <span className={styles.rowText}>
                <b>{price.item}</b>
                <small>Tap to change or remove</small>
              </span>
              <b>{nairaWords(price.amount)}</b>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== 6. Lab prices the Laboratory sent, waiting for the admin =====
function WaitingPrices({
  client,
  changes,
  prices,
  onDone,
}: {
  client: SupabaseClient
  changes: PriceChange[]
  prices: Price[]
  onDone: () => Promise<void>
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  async function decide(change: PriceChange, approve: boolean) {
    setBusy(change.id)
    setProblem(null)
    const answer = await decidePrice(client, change.id, approve)
    setBusy(null)
    if (answer) setProblem(answer)
    else await onDone()
  }

  return (
    <div className={`${styles.card} ${styles.waitingCard}`}>
      <h3>New lab prices waiting for you ({changes.length})</h3>
      <p className={styles.muted}>
        Sent by the Laboratory. A price you do not answer becomes standard on its own 72 hours after
        it was sent.
      </p>
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.list}>
        {changes.map((change) => {
          const now = priceOf(prices, 'lab_test', change.item)
          return (
            <div key={change.id} className={styles.row}>
              <span className={styles.rowText}>
                <b>{change.item}</b>
                <small>
                  {now ? `₦${now.toLocaleString('en-GB')}` : 'No price'} to ₦
                  {change.amount.toLocaleString('en-GB')} · by{' '}
                  {change.proposer?.full_name ?? 'staff'} · standard on its own{' '}
                  {standardOn(change).toLocaleString('en-GB', {
                    timeZone: HOSPITAL_TIME_ZONE,
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
              </span>
              <div className={styles.buttons}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.primary}`}
                  disabled={busy === change.id}
                  onClick={() => decide(change, true)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={busy === change.id}
                  onClick={() => decide(change, false)}
                >
                  Refuse
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
