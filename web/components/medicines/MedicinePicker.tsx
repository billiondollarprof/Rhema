/*
 * components/medicines/MedicinePicker.tsx: pick a medicine and its strength
 * from the hospital's list, instead of typing them.
 *
 * Why: Anthony, 2026-11-11: "when they click on that place, it will give a
 * drop down with a search. They press the first letter, tick which medicine,
 * then tick the milligram... in case it is not in the list, they click
 * 'other' and add it."
 *
 * How it goes:
 *   1. Type the first letters. The names that start with them come first.
 *   2. Tap the name, then tap one of its strengths.
 *   3. Not there? Tap "Other" and type it. The Pharmacy's addition is standard
 *      at once; a doctor's or nurse's is kept for them (pending) and can be
 *      used straight away. The Pharmacy confirms it for everybody.
 *
 * Without a network the last list still works; an addition that cannot be
 * saved to the list is still used on this entry.
 *
 * Never: change what the parent screen saves. It only hands back a name and a
 * strength.
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './MedicinePicker.module.css'
import {
  addMedicine,
  findMedicines,
  groupMedicines,
  knownMedicines,
  loadMedicines,
  medicineWords,
  type MedicineLine,
} from '@/lib/medicines/medicines'

type Props = {
  client: SupabaseClient
  staffId: string
  // The id of the search box, so a label can point at it.
  id: string
  name: string
  strength: string
  onChange: (name: string, strength: string) => void
  placeholder?: string
  // Medicines and supplies (syringes, plaster) are two lists (Anthony,
  // 2026-11-12: "anything that's not medicine should have its own list").
  kind?: 'medicine' | 'item'
}

export default function MedicinePicker({
  client,
  staffId,
  id,
  name,
  strength,
  onChange,
  placeholder = 'Type the first letters',
  kind = 'medicine',
}: Props) {
  const [lines, setLines] = useState<MedicineLine[]>(() => knownMedicines(staffId))
  const [typed, setTyped] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStrength, setNewStrength] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // A fresh copy, behind what is already showing.
  useEffect(() => {
    let current = true
    loadMedicines(client, staffId).then((fresh) => {
      if (current && fresh) setLines(fresh)
    })
    return () => {
      current = false
    }
  }, [client, staffId])

  const names = useMemo(
    () => groupMedicines(lines.filter((line) => line.kind === kind)),
    [lines, kind],
  )
  const matches = useMemo(() => findMedicines(names, typed), [names, typed])
  const picked = names.find((entry) => entry.name.toLowerCase() === name.toLowerCase())

  async function saveNew() {
    if (newName.trim().length < 2) {
      setProblem('Type the name.')
      return
    }
    setBusy(true)
    setProblem(null)
    const result = await addMedicine(client, newName.trim(), newStrength.trim() || null, kind)
    const fresh = await loadMedicines(client, staffId)
    if (fresh) setLines(fresh)
    setBusy(false)
    // If it could not reach the list, it is still used on this entry.
    onChange(newName.trim(), newStrength.trim())
    setAdding(false)
    setTyped('')
    setNewName('')
    setNewStrength('')
    if (result) setProblem(null)
  }

  function startAdding() {
    setNewName(typed.trim())
    setNewStrength('')
    setProblem(null)
    setAdding(true)
  }

  // ===== 1. Adding something that is not in the list =====
  if (adding) {
    return (
      <div className={styles.form}>
        <label htmlFor={`${id}-new-name`}>Name</label>
        <input
          id={`${id}-new-name`}
          className={styles.box}
          maxLength={120}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <label htmlFor={`${id}-new-strength`}>Strength or size (optional)</label>
        <input
          id={`${id}-new-strength`}
          className={styles.box}
          placeholder="e.g. 500 mg tablet"
          maxLength={60}
          value={newStrength}
          onChange={(event) => setNewStrength(event.target.value)}
        />
        <p className={styles.hint}>
          It goes in the list for you. The Pharmacy confirms it for everybody.
        </p>
        {problem ? <p className={styles.error}>{problem}</p> : null}
        <div>
          <button type="button" className={styles.small} disabled={busy} onClick={saveNew}>
            {busy ? 'Adding…' : 'Add and use'}
          </button>{' '}
          <button type="button" className={styles.small} onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ===== 2. A medicine is chosen =====
  if (name) {
    return (
      <div className={styles.picker}>
        <div className={styles.chosen}>
          <b>{medicineWords(name, strength)}</b>
          <button
            type="button"
            className={styles.small}
            onClick={() => {
              onChange('', '')
              setTyped('')
            }}
          >
            Change
          </button>
        </div>
        {/* Its strengths, until one is chosen. */}
        {picked && !strength ? (
          <div>
            <p className={styles.hint}>Choose the strength</p>
            <div className={styles.strengths}>
              {picked.strengths.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  className={styles.strength}
                  aria-pressed={strength === line.strength}
                  onClick={() => onChange(name, line.strength ?? '')}
                >
                  {line.strength ?? 'No strength'}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.strength} ${styles.other}`}
                onClick={() => {
                  setNewName(name)
                  setNewStrength('')
                  setProblem(null)
                  setAdding(true)
                }}
              >
                Other
              </button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // ===== 3. Search =====
  return (
    <div className={styles.picker}>
      <input
        id={id}
        className={styles.box}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={120}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
      <div className={styles.list} role="listbox" aria-label="Medicines">
        {matches.map((entry) => {
          const mine = entry.strengths.every((line) => line.status === 'pending')
          return (
            <button
              key={entry.name}
              type="button"
              role="option"
              aria-selected="false"
              className={styles.row}
              onClick={() => {
                setTyped('')
                // One strength only: it is chosen with the name.
                onChange(
                  entry.name,
                  entry.strengths.length === 1 ? (entry.strengths[0].strength ?? '') : '',
                )
              }}
            >
              <span>{entry.name}</span>
              {mine ? <span className={styles.mark}>Yours, waiting for the Pharmacy</span> : null}
            </button>
          )
        })}
        <button
          type="button"
          role="option"
          aria-selected="false"
          className={`${styles.row} ${styles.other}`}
          onClick={startAdding}
        >
          {typed.trim() ? `Other: add “${typed.trim()}”` : 'Other: add a new one'}
        </button>
      </div>
    </div>
  )
}
