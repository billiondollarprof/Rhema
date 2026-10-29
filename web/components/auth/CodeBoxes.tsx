/*
 * components/auth/CodeBoxes.tsx: a row of single digit boxes, used for the
 * 6 digit email code and the 4 digit PIN.
 *
 * Why: the RHEMA demo's code screen. Typing a digit moves to the next box,
 * backspace on an empty box goes back, and pasting a whole code fills every
 * box at once. When the last box is filled, onComplete runs, so nobody has
 * to press a button after typing.
 *
 * Never: keep the digits anywhere but the boxes and the parent's state. A
 * PIN typed here is sent once to the database for checking, then cleared.
 */
'use client'

import { useEffect, useRef } from 'react'
import styles from './Auth.module.css'

type CodeBoxesProps = {
  length: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  // PINs show dots; email codes show the digits.
  secret?: boolean
  label: string
  autoFocus?: boolean
}

export default function CodeBoxes({
  length,
  value,
  onChange,
  onComplete,
  secret = false,
  label,
  autoFocus = false,
}: CodeBoxesProps) {
  const boxes = useRef<Array<HTMLInputElement | null>>([])
  const group = useRef<HTMLDivElement | null>(null)

  // When the boxes are emptied (a wrong PIN or code), put the cursor back in
  // the first box, so the person can simply type again.
  useEffect(() => {
    if (value === '' && group.current?.contains(document.activeElement)) {
      boxes.current[0]?.focus()
    }
  }, [value])

  // ===== 1. Put new digits in, starting at one box =====
  function fill(start: number, digits: string) {
    const clean = digits.replace(/\D/g, '')
    if (!clean) return
    const chars = value.padEnd(length, ' ').split('')
    for (let i = 0; i < clean.length && start + i < length; i++) chars[start + i] = clean[i]
    const next = chars.join('').replace(/\s+$/, '')
    onChange(next)
    const nextBox = Math.min(start + clean.length, length - 1)
    boxes.current[nextBox]?.focus()
    if (next.length === length && !next.includes(' ')) onComplete?.(next)
  }

  // ===== 2. Backspace clears this box, or goes back one =====
  function erase(index: number) {
    const chars = value.padEnd(length, ' ').split('')
    if (chars[index] && chars[index] !== ' ') {
      chars[index] = ' '
    } else if (index > 0) {
      chars[index - 1] = ' '
      boxes.current[index - 1]?.focus()
    }
    onChange(chars.join('').replace(/\s+$/, ''))
  }

  // ===== 3. The boxes =====
  return (
    <div ref={group} className={styles.boxes} role="group" aria-label={label}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element
          }}
          className={styles.box}
          type={secret ? 'password' : 'text'}
          inputMode="numeric"
          autoComplete={index === 0 && !secret ? 'one-time-code' : 'off'}
          maxLength={length}
          aria-label={`${label}, digit ${index + 1}`}
          autoFocus={autoFocus && index === 0}
          value={(value[index] ?? '').trim()}
          onChange={(event) => {
            // Keep only the new digits: a box that held "4" and now reads
            // "47" adds just the 7. A phone filling the whole code into the
            // first box adds all of it.
            const typed = event.target.value.replace(/\D/g, '')
            const before = (value[index] ?? '').trim()
            fill(index, before && typed.startsWith(before) ? typed.slice(before.length) : typed)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace') {
              event.preventDefault()
              erase(index)
            }
          }}
          onPaste={(event) => {
            event.preventDefault()
            fill(index, event.clipboardData.getData('text'))
          }}
        />
      ))}
    </div>
  )
}
