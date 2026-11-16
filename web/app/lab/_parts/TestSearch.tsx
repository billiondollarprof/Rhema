/*
 * app/lab/_parts/TestSearch.tsx: find any lab test by typing its first
 * letters, or open a section and tap it.
 *
 * Why: Anthony, 2026-11-16 (requests 196a and 196h): "every picker with a
 * long list: a search where they type the first letter." The lab menu has
 * well over a hundred tests, too many for chips.
 *
 * How it goes:
 *   1. Type "fb" and Full Blood Count comes up (by its other name, FBC).
 *      Tap it to add it; tap it again to take it off.
 *   2. Or open a section, such as Chemistry, and tap the tests there.
 *   3. Not on the list? "Add ... as a new test" keeps it on the hospital's
 *      lab list (pick list "lab_test"), so the next person finds it too.
 *
 * Never: send anything. It only tells the page which tests were chosen.
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './lab.module.css'
import { ALL_LAB_TESTS, LAB_SECTIONS, findLabTest, searchLabTests } from '@/lib/lab/catalogue'
import { addOption, knownOptions, loadOptions, optionsOf } from '@/lib/options/options'

type Props = {
  client: SupabaseClient
  staffId: string
  chosen: string[]
  onToggle: (test: string) => void
}

export default function TestSearch({ client, staffId, chosen, onToggle }: Props) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  // Tests typed in before, kept on the hospital's lab list.
  const [extra, setExtra] = useState<string[]>(() =>
    optionsOf(knownOptions(staffId), 'lab_test').map((option) => option.label),
  )

  // ===== 1. The lab list from the database, once =====
  useEffect(() => {
    let current = true
    loadOptions(client, staffId).then((all) => {
      if (current && all) setExtra(optionsOf(all, 'lab_test').map((option) => option.label))
    })
    return () => {
      current = false
    }
  }, [client, staffId])

  // ===== 2. What the typed letters find =====
  const words = typed.trim().toLowerCase()
  const found = useMemo(() => {
    if (!words) return []
    const fromMenu = searchLabTests(words).map((test) => test.name)
    const fromList = extra.filter(
      (name) =>
        name.toLowerCase().includes(words) && !findLabTest(name) && !fromMenu.includes(name),
    )
    return [...fromMenu, ...fromList].slice(0, 12)
  }, [words, extra])
  const exact = found.some((name) => name.toLowerCase() === words) || Boolean(findLabTest(typed))

  // ===== 3. Add a test that is not on the list =====
  async function addNew() {
    const name = typed.trim()
    if (name.length < 2) return
    setBusy(true)
    const saved = await addOption(client, 'lab_test', name)
    setBusy(false)
    const label = saved ?? name
    if (!extra.includes(label)) setExtra([...extra, label])
    if (!chosen.includes(label)) onToggle(label)
    setTyped('')
  }

  // Tests typed in before that are not in the menu.
  const ownTests = extra.filter((name) => !findLabTest(name))

  return (
    <div className={styles.search}>
      <input
        className={styles.input}
        aria-label="Find a test"
        placeholder="Find a test: type the first letters"
        value={typed}
        maxLength={80}
        onChange={(event) => setTyped(event.target.value)}
      />

      {/* ----- What the letters found ----- */}
      {words ? (
        <div className={styles.chips}>
          {found.map((name) => (
            <button
              key={name}
              className={styles.chip}
              aria-pressed={chosen.includes(name)}
              onClick={() => onToggle(name)}
            >
              {name}
            </button>
          ))}
          {!exact && typed.trim().length >= 2 ? (
            <button className={styles.button} disabled={busy} onClick={addNew}>
              {busy ? 'Adding…' : `Add "${typed.trim()}" as a new test`}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ----- Every section, folded ----- */}
      {!words ? (
        <div className={styles.sections}>
          {LAB_SECTIONS.map((section) => (
            <details key={section.name} className={styles.section}>
              <summary>
                {section.name}
                <small>{section.tests.length}</small>
              </summary>
              <div className={styles.chips}>
                {section.tests.map((test) => (
                  <button
                    key={test.name}
                    className={styles.chip}
                    aria-pressed={chosen.includes(test.name)}
                    onClick={() => onToggle(test.name)}
                  >
                    {test.name}
                  </button>
                ))}
              </div>
            </details>
          ))}
          {ownTests.length > 0 ? (
            <details className={styles.section}>
              <summary>
                Added by the hospital
                <small>{ownTests.length}</small>
              </summary>
              <div className={styles.chips}>
                {ownTests.map((name) => (
                  <button
                    key={name}
                    className={styles.chip}
                    aria-pressed={chosen.includes(name)}
                    onClick={() => onToggle(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
      <p className={styles.muted}>{ALL_LAB_TESTS.length} tests on the list.</p>
    </div>
  )
}
