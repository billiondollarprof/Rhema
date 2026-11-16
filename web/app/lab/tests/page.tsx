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
 *   4. tests the hospital added with Other (pick list "lab_test").
 *
 * The list itself lives in lib/lab/catalogue.ts. This page only shows it.
 *
 * Never: show or load anything about a patient.
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import AppShell from '@/components/shell/AppShell'
import styles from '../_parts/lab.module.css'
import { LAB_SECTIONS, findLabTest, searchLabTests, type LabTest } from '@/lib/lab/catalogue'
import { knownOptions, loadOptions, optionsOf } from '@/lib/options/options'
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

  // ===== 1. The tests the hospital added, from the database =====
  const staffId = staff?.id
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

  if (auth.status !== 'ready' || !staff) return null

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
              found.map((test) => <TestDetails key={test.name} test={test} />)
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
                    <TestDetails key={test.name} test={test} />
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
                <ul className={styles.plainList}>
                  {ownTests.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  )
}

// One test: its name, its other names, and each box when opened.
function TestDetails({ test }: { test: LabTest }) {
  return (
    <details className={styles.testItem}>
      <summary>
        <b>{test.name}</b>
        {test.also && test.also.length ? <small>Also: {test.also.join(', ')}</small> : null}
      </summary>
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
    </details>
  )
}
