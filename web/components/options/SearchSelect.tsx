/*
 * components/options/SearchSelect.tsx: a drop down that opens a list, with a
 * search box on top when the list is long, and "Other" at the end.
 *
 * Why: Anthony, 2026-11-16 (request 200): "shouldn't it be just like a drop
 * down? When they click on the drop down, they will now select and they
 * should be able to search... type the first letter... put a visible drop
 * down arrow on anyone that has a drop down... still put Other so they can
 * enter what they have."
 *
 * How it goes:
 *   1. The closed box shows the choice (or the placeholder) and an arrow.
 *   2. Tap it: the list opens under it. A long list has a search box at the
 *      top, ready to type in. Only names that start with the letters show
 *      (request 220d).
 *   3. Tap a line to choose it. Enter chooses the first line found. Escape,
 *      or a tap outside, closes it without changing anything.
 *   4. "Other…" (when the screen offers it) hands back what was typed, so
 *      the screen can ask for the missing one.
 *
 * Never: save anything. It only hands back the value that was tapped.
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './SearchSelect.module.css'

// ===== 1. Shapes =====
export type SelectOption = {
  value: string
  label: string
  // A heading the line sits under, such as "Chemistry".
  group?: string
  // A small word after the line, such as "Yours".
  note?: string
  // Other names it is found by, such as "FBC" for Full Blood Count.
  also?: string[]
}

// The words a line is found by, in small letters.
function wordsOf(option: SelectOption): string[] {
  return [option.label, ...(option.also ?? [])].map((word) => word.toLowerCase())
}

type Props = {
  id: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  // When given, the list ends with "Other…", and this gets what was typed.
  onOther?: (typed: string) => void
  // A list longer than this gets a search box.
  searchFrom?: number
  invalid?: boolean
  // When the list opens, it is scrolled to this line (or to the chosen one),
  // such as 36.8 for a temperature, so the usual value is one tap away.
  startAt?: string
  // false: the search box does not take the keyboard when the list opens
  // (number lists, where tapping is quicker than typing).
  focusSearch?: boolean
}

export default function SearchSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  onOther,
  searchFrom = 8,
  invalid = false,
  startAt,
  focusSearch = true,
}: Props) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)

  // ===== 1b. Open at the chosen line, or at the usual one =====
  useEffect(() => {
    if (!open || !list.current) return
    const target = value || startAt
    if (!target) return
    const line = list.current.querySelector<HTMLElement>(`[data-value="${CSS.escape(target)}"]`)
    if (line) list.current.scrollTop = line.offsetTop - list.current.clientHeight / 2
  }, [open, value, startAt])

  // An open list near the bottom of a phone screen is brought into view.
  useEffect(() => {
    if (!open || !list.current) return
    list.current.parentElement?.scrollIntoView({ block: 'nearest' })
  }, [open])
  const long = options.length > searchFrom

  // ===== 2. Close on a tap outside =====
  useEffect(() => {
    if (!open) return
    function outside(event: MouseEvent | TouchEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
    }
  }, [open])

  // ===== 3. What the letters find: only names that start with them =====
  // Anthony, 2026-11-17 (request 220d): "the first letter populates only
  // those words that start with their first letter." Other names (also)
  // count, so FBC finds Full Blood Count.
  const words = typed.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!words) return options
    return options.filter((option) => wordsOf(option).some((word) => word.startsWith(words)))
  }, [options, words])

  const chosen = options.find((option) => option.value === value)

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    setTyped('')
  }

  function other() {
    const words = typed.trim()
    setOpen(false)
    setTyped('')
    onOther?.(words)
  }

  function toggle() {
    setTyped('')
    setOpen(!open)
  }

  // ===== 4. The closed box, and the list when open =====
  return (
    <div className={styles.wrap} ref={box}>
      <button
        id={id}
        type="button"
        className={styles.box}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid ? 'true' : undefined}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        <span className={chosen || value ? styles.value : styles.placeholder}>
          {chosen?.label ?? (value || placeholder)}
        </span>
        <svg className={styles.arrow} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className={styles.panel}>
          {long ? (
            <input
              className={styles.search}
              aria-label="Type to find"
              placeholder="Type to find"
              value={typed}
              autoFocus={focusSearch}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (shown[0]) choose(shown[0].value)
                  else if (onOther) other()
                }
              }}
            />
          ) : null}
          <div className={styles.list} role="listbox" aria-labelledby={id} ref={list}>
            {shown.map((option, at) => {
              const heading =
                option.group && option.group !== shown[at - 1]?.group ? option.group : null
              return (
                <div key={`${option.group ?? ''}${option.value}`}>
                  {heading ? <div className={styles.group}>{heading}</div> : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    data-value={option.value}
                    className={styles.option}
                    onClick={() => choose(option.value)}
                  >
                    {option.label}
                    {option.note ? <small>{option.note}</small> : null}
                  </button>
                </div>
              )
            })}
            {shown.length === 0 ? <p className={styles.none}>Nothing starts with that.</p> : null}
            {onOther ? (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className={styles.otherLine}
                onClick={other}
              >
                {typed.trim() ? `Other: use "${typed.trim()}"` : 'Other…'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
