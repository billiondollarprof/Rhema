/*
 * app/lab/tests/page.tsx: the Lab test list. Every test the Laboratory does,
 * by section, with the boxes each one has: unit, normal range and the words
 * to pick from. No patient on this page, ever.
 *
 * Why: Anthony, 2026-11-16: "can the lab scientists see the list of test
 * without any patient data, if not please fix." Until then the tests only
 * showed inside a patient's request.
 *
 * What is here, in order:
 *   1. a search box: type the first letters (short names work: FBC, E/U/Cr);
 *   2. every section, folded; open one to see its tests;
 *   3. each test opens to show its boxes, units, normal ranges and picks;
 *   4. tests the hospital added with Other (pick list "lab_test");
 *   5. each test's price. The Laboratory sends a new price; it waits for the
 *      admin, and becomes standard on its own after 72 hours (request 208).
 *      An admin's new price is standard at once.
 *
 * The list itself lives in lib/lab/catalogue.ts. This page only shows it.
 *
 * Never: show or load anything about a patient.
 */
'use client'

import { HOSPITAL_TIME_ZONE } from '@/lib/time/zone'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@/components/shell/AppShell'
import styles from '../_parts/lab.module.css'
import { LAB_SECTIONS, findLabTest, searchLabTests, type LabTest } from '@/lib/lab/catalogue'
import { knownOptions, loadOptions, optionsOf } from '@/lib/options/options'
import {
  loadPriceChanges,
  loadPrices,
  priceOf,
  proposePrice,
  readAmount,
  setPrice,
  standardOn,
  waitingPriceOf,
  type Price,
  type PriceChange,
} from '@/lib/prices/prices'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

export default function LabTestListPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/lab/tests/')
  const { client, staff } = auth
  const [typed, setTyped] = useState('')
  // Tests the hospital added with Other, kept on the lab list.
  const [added, setAdded] = useState<string[]>(() =>
    optionsOf(knownOptions(auth.staff?.id), 'lab_test').map((option) => option.label),
  )

  // The price list and the prices waiting for the admin.
  const [prices, setPrices] = useState<Price[]>([])
  const [changes, setChanges] = useState<PriceChange[]>([])

  // ===== 1. The tests the hospital added, and the prices =====
  const staffId = staff?.id
  async function reloadPrices() {
    if (!client) return
    setPrices((await loadPrices(client)) ?? [])
    setChanges((await loadPriceChanges(client)) ?? [])
  }
  useEffect(() => {
    if (!client) return
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
  useEffect(() => {
    if (!client || !staffId) return
    let current = true
    loadOptions(client, staffId).then((all) => {
      if (current && all) setAdded(optionsOf(all, 'lab_test').map((option) => option.label))
    })
    return () => {
      current = false
    }
  }, [client, staffId])

  const found = useMemo(() => searchLabTests(typed, 40), [typed])
  const ownTests = added.filter((name) => !findLabTest(name))
  const total = LAB_SECTIONS.reduce((sum, section) => sum + section.tests.length, 0)

  if (auth.status !== 'ready' || !staff || !client) return null

  // Who may change a price: the Laboratory sends one for the admin; the admin
  // sets it at once.
  const canPrice = staff.can_lab || staff.can_admin
  const priceProps = (name: string) => ({
    client,
    price: priceOf(prices, 'lab_test', name),
    waiting: waitingPriceOf(changes, name),
    canPrice,
    isAdmin: staff.can_admin,
    onSaved: reloadPrices,
  })

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>Lab test list</h2>
        <p className={styles.muted}>
          {total} tests in {LAB_SECTIONS.length} sections. Tap a test to see its boxes and normal
          ranges.
        </p>

        {/* ===== 2. Search ===== */}
        <input
          className={styles.input}
          aria-label="Find a test"
          placeholder="Find a test: type the first letters"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />

        {typed.trim() ? (
          <div className={styles.card}>
            {found.length === 0 ? (
              <p className={styles.muted}>No test starts with that.</p>
            ) : (
              found.map((test) => (
                <TestDetails key={test.name} test={test} {...priceProps(test.name)} />
              ))
            )}
          </div>
        ) : (
          <>
            {/* ===== 3. Every section, folded ===== */}
            {LAB_SECTIONS.map((section) => (
              <details key={section.name} className={styles.section}>
                <summary>
                  {section.name}
                  <small>{section.tests.length}</small>
                </summary>
                <div className={styles.testList}>
                  {section.tests.map((test) => (
                    <TestDetails key={test.name} test={test} {...priceProps(test.name)} />
                  ))}
                </div>
              </details>
            ))}

            {/* ===== 4. Added by the hospital ===== */}
            {ownTests.length > 0 ? (
              <details className={styles.section}>
                <summary>
                  Added by the hospital
                  <small>{ownTests.length}</small>
                </summary>
                <div className={styles.testList}>
                  {ownTests.map((name) => (
                    <TestDetails key={name} test={{ name, fields: [] }} {...priceProps(name)} />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  )
}

// One test: its name, its price, its other names, and each box when opened.
function TestDetails({
  test,
  client,
  price,
  waiting,
  canPrice,
  isAdmin,
  onSaved,
}: {
  test: LabTest
  client: SupabaseClient
  price: number | undefined
  waiting: PriceChange | undefined
  canPrice: boolean
  isAdmin: boolean
  onSaved: () => Promise<void>
}) {
  return (
    <details className={styles.testItem}>
      <summary>
        <b>{test.name}</b>
        <small>
          {price ? `₦${price.toLocaleString('en-GB')}` : 'No price yet'}
          {waiting
            ? ` · new price ₦${waiting.amount.toLocaleString('en-GB')} waiting for the admin`
            : ''}
        </small>
        {test.also && test.also.length ? <small>Also: {test.also.join(', ')}</small> : null}
      </summary>
      {canPrice ? (
        <PriceChanger
          client={client}
          test={test.name}
          waiting={waiting}
          isAdmin={isAdmin}
          onSaved={onSaved}
        />
      ) : null}
      {test.note ? (
        <div className={styles.testNote}>
          <b>{test.note.heading}</b>
          <span>{test.note.text}</span>
        </div>
      ) : null}
      {test.fields.length ? (
        <ul className={styles.boxList}>
          {test.fields.map((field) => (
            <li key={field.name}>
              {field.heading ? <em>{field.heading}</em> : null}
              <span>
                <b>{field.name}</b>
                {field.unit ? ` (${field.unit})` : ''}
                {field.range ? ` · normal ${field.range}` : ''}
              </span>
              {field.choices ? <small>Pick: {field.choices.join(' · ')}, or Other</small> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  )
}

// ===== 6. Change a test's price =====
// The Laboratory's price waits for the admin (standard on its own after 72
// hours). An admin's price is standard at once.
function PriceChanger({
  client,
  test,
  waiting,
  isAdmin,
  onSaved,
}: {
  client: SupabaseClient
  test: string
  waiting: PriceChange | undefined
  isAdmin: boolean
  onSaved: () => Promise<void>
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ good: boolean; words: string } | null>(null)

  async function send() {
    const amount = readAmount(typed)
    if (amount === null) {
      setNote({ good: false, words: 'Type the price in naira, like 2,000.' })
      return
    }
    setBusy(true)
    const problem = isAdmin
      ? await setPrice(client, 'lab_test', test, amount)
      : await proposePrice(client, test, amount)
    setBusy(false)
    if (problem) {
      setNote({ good: false, words: problem })
      return
    }
    setTyped('')
    setNote({
      good: true,
      words: isAdmin
        ? 'Saved. This is now the standard price.'
        : 'Sent to the admin. If the admin does not answer, it becomes the standard price in 72 hours.',
    })
    await onSaved()
  }

  return (
    <div className={styles.priceChanger}>
      {waiting ? (
        <small className={styles.muted}>
          Waiting for the admin: ₦{waiting.amount.toLocaleString('en-GB')}, sent by{' '}
          {waiting.proposer?.full_name ?? 'staff'}. Standard on its own on{' '}
          {standardOn(waiting).toLocaleString('en-GB', {
            timeZone: HOSPITAL_TIME_ZONE,
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          .
        </small>
      ) : null}
      <div className={styles.row}>
        <input
          className={styles.input}
          aria-label={`New price of ${test}`}
          inputMode="decimal"
          placeholder="e.g. 2,000"
          value={typed}
          onChange={(event) => {
            setNote(null)
            setTyped(event.target.value.replace(/[^\d.,\s]/g, ''))
          }}
        />
        <button className={styles.button} disabled={busy || !typed.trim()} onClick={send}>
          {busy ? 'Saving…' : isAdmin ? 'Set price' : 'Send new price'}
        </button>
      </div>
      {note ? <small className={note.good ? styles.good : styles.error}>{note.words}</small> : null}
    </div>
  )
}
