/*
 * components/auth/EmailPicker.tsx: the email box on the sign in page, with a
 * drop down of the emails that have signed in on this device.
 *
 * Why: Anthony, 2026-11-12: nobody should retype their email every time.
 * With one remembered email the box already holds it. With two or more, a
 * small arrow opens the list; tapping one fills the box. Each can be
 * removed ("Not you? Remove"), for a shared computer.
 *
 * Never: show an email that did not sign in on this device.
 */
'use client'

import { useState } from 'react'
import styles from './Auth.module.css'

type Props = {
  id: string
  value: string
  onChange: (email: string) => void
  onEnter: () => void
  emails: string[]
  onForget: (email: string) => void
}

export default function EmailPicker({ id, value, onChange, onEnter, emails, onForget }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.combo}>
      <div className={styles.comboRow}>
        <input
          id={id}
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onEnter()}
        />
        {emails.length > 1 ? (
          <button
            type="button"
            className={styles.comboArrow}
            aria-label="Choose from the emails used on this device"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            ▾
          </button>
        ) : null}
      </div>
      {open ? (
        <div className={styles.comboList} role="listbox" aria-label="Emails used on this device">
          {emails.map((email) => (
            <div key={email} className={styles.comboItem}>
              <button
                type="button"
                role="option"
                aria-selected={email === value}
                className={styles.comboPick}
                onClick={() => {
                  onChange(email)
                  setOpen(false)
                }}
              >
                {email}
              </button>
              <button
                type="button"
                className={styles.comboForget}
                aria-label={`Remove ${email} from this device`}
                onClick={() => onForget(email)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
