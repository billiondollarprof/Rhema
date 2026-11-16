/*
 * app/lab/_parts/TestSearch.tsx: add any lab test from one drop down, with a
 * search box where they type the first letters.
 *
 * Why: Anthony, 2026-11-16 (requests 196a and 200): "shouldn't it be just
 * like a drop down? When they click on the drop down, they will now select
 * and they should be able to search... type the first letter." The lab menu
 * has over a hundred tests, too many to show at once.
 *
 * How it goes:
 *   1. Tap "Add a test". The whole menu opens, under its section headings.
 *   2. Type "fb" and Full Blood Count comes up (by its other name, FBC).
 *      Tap it and it joins the chosen tests above.
 *   3. Not on the list? "Other" keeps it on the hospital's lab list (pick
 *      list "lab_test"), so the next person finds it too.
 *
 * Never: send anything. It only tells the page which test was added.
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './lab.module.css'
import SearchSelect, { type SelectOption } from '@/components/options/SearchSelect'
import { LAB_SECTIONS, findLabTest } from '@/lib/lab/catalogue'
import { addOption, knownOptions, loadOptions, optionsOf } from '@/lib/options/options'

type Props = {
  client: SupabaseClient
  staffId: string
  chosen: string[]
  onToggle: (test: string) => void
}

export default function TestSearch({ client, staffId, chosen, onToggle }: Props) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
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

  // ===== 2. Every test, under its section =====
  const options = useMemo<SelectOption[]>(() => {
    const menu = LAB_SECTIONS.flatMap((section) =>
      section.tests.map((test) => ({
        value: test.name,
        label: test.name,
        group: section.name,
        also: test.also,
        note: chosen.includes(test.name) ? 'Added' : undefined,
      })),
    )
    const own = extra
      .filter((name) => !findLabTest(name))
      .map((name) => ({
        value: name,
        label: name,
        group: 'Added by the hospital',
        note: chosen.includes(name) ? 'Added' : undefined,
      }))
    return [...menu, ...own]
  }, [extra, chosen])

  // ===== 3. Add a test that is not on the list =====
  async function addNew(typed: string) {
    const name = typed.trim()
    if (name.length < 2) {
      setProblem('Type the name of the test in the search box, then tap Other.')
      return
    }
    setProblem(null)
    setBusy(true)
    // A new test is saved for everybody, so it is on the list next time.
    const saved = await addOption(client, 'lab_test', name, true)
    setBusy(false)
    const label = saved ?? name
    if (!extra.includes(label)) setExtra([...extra, label])
    if (!chosen.includes(label)) onToggle(label)
  }

  return (
    <div className={styles.search}>
      <label className={styles.label} htmlFor="add-test">
        Any other test
      </label>
      <SearchSelect
        id="add-test"
        value=""
        placeholder={busy ? 'Adding…' : 'Add a test'}
        options={options}
        onChange={(name) => {
          setProblem(null)
          if (!chosen.includes(name)) onToggle(name)
        }}
        onOther={addNew}
      />
      {problem ? <p className={styles.error}>{problem}</p> : null}
    </div>
  )
}
