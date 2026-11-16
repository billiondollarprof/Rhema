/*
 * components/options/OptionSelect.tsx: a drop down to pick one word or phrase
 * from a short list, with "Other" to type one that is missing.
 *
 * Why: Anthony, 2026-11-12: doses, how often, allergies and the like are
 * picked, not typed. On a computer the first letter jumps to that line; on a
 * phone it opens the phone's own list.
 *
 * "Other" shows a box to type it. It is kept for the person from then on (and
 * becomes standard for everybody when a second person types the same one). A
 * line the person typed can be removed again.
 *
 * Without a network the last list still works; a typed line that cannot be
 * saved to the list is still used on this entry.
 *
 * Never: change what the parent saves. It hands back the words.
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './OptionSelect.module.css'
import {
  addOption,
  knownOptions,
  loadOptions,
  optionsOf,
  removeOption,
  type PickList,
  type PickOption,
} from '@/lib/options/options'

const OTHER = '__other__'

type Props = {
  client: SupabaseClient
  staffId: string
  list: PickList
  id: string
  value: string
  onChange: (value: string) => void
  // What the empty line says, e.g. "Choose the dose".
  placeholder?: string
  // What "Other" asks for, e.g. "Type the dose".
  otherLabel?: string
}

export default function OptionSelect({
  client,
  staffId,
  list,
  id,
  value,
  onChange,
  placeholder = 'Choose',
  otherLabel = 'Type it',
}: Props) {
  const [all, setAll] = useState<PickOption[]>(() => knownOptions(staffId))
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  // A fresh copy, behind what is already showing.
  useEffect(() => {
    let current = true
    loadOptions(client, staffId).then((fresh) => {
      if (current && fresh) setAll(fresh)
    })
    return () => {
      current = false
    }
  }, [client, staffId])

  const options = useMemo(() => optionsOf(all, list), [all, list])
  const chosen = options.find((option) => option.label.toLowerCase() === value.toLowerCase())

  async function save() {
    const words = typed.trim()
    if (!words) return
    setBusy(true)
    const saved = await addOption(client, list, words)
    const fresh = await loadOptions(client, staffId)
    if (fresh) setAll(fresh)
    setBusy(false)
    // If it could not reach the list, it is still used on this entry.
    onChange(saved ?? words)
    setTyping(false)
    setTyped('')
  }

  if (typing) {
    return (
      <div className={styles.other}>
        <input
          id={id}
          className={styles.input}
          placeholder={otherLabel}
          maxLength={80}
          value={typed}
          autoFocus
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && !busy && save()}
        />
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.small}
            disabled={busy || !typed.trim()}
            onClick={save}
          >
            {busy ? 'Adding…' : 'Add and use'}
          </button>
          <button type="button" className={styles.small} onClick={() => setTyping(false)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(event) => {
          if (event.target.value === OTHER) setTyping(true)
          else onChange(event.target.value)
        }}
      >
        <option value="">{placeholder}</option>
        {/* A value already on the entry that is not in the list. */}
        {value && !chosen ? <option value={value}>{value}</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.label}>
            {option.label}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {chosen && !chosen.standard ? (
        <button
          type="button"
          className={styles.quiet}
          onClick={async () => {
            await removeOption(client, list, chosen.label)
            const fresh = await loadOptions(client, staffId)
            if (fresh) setAll(fresh)
            onChange('')
          }}
        >
          Remove “{chosen.label}” from my list
        </button>
      ) : null}
    </div>
  )
}
