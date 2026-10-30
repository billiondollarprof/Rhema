/*
 * app/admin/_parts/PinCheck.tsx: the box that asks for the admin's own PIN
 * before suspend, unsuspend, revoke or cancelling an invitation.
 *
 * Why: Anthony, 2026-10-30: "Those actions will always go with the pin,
 * the admin's pin... the same pin they are using to log in."
 *
 * The PIN is checked by the database (change_staff_access, cancel_invite),
 * never here. Five wrong PINs sign the admin out, as on the lock screen.
 *
 * Never: keep the PIN after it is sent. Never do the action when the box is
 * closed with Cancel.
 */
'use client'

import { useState } from 'react'
import CodeBoxes from '@/components/auth/CodeBoxes'
import styles from './admin.module.css'
import { PIN_LENGTH } from '@/lib/auth/config'
import type { PinResult } from '@/lib/admin/admin'
import { useAuth } from '@/lib/auth/session'

type PinCheckProps = {
  title: string
  // One plain line on what happens next.
  explain: string
  // The word on the button, e.g. "Suspend".
  action: string
  // Red for the actions that take access away.
  serious: boolean
  run: (pin: string) => Promise<PinResult>
  onDone: () => void
  onCancel: () => void
}

export default function PinCheck({
  title,
  explain,
  action,
  serious,
  run,
  onDone,
  onCancel,
}: PinCheckProps) {
  const auth = useAuth()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ===== 1. Send the PIN once; the database decides =====
  async function confirm(typed: string) {
    if (busy || typed.length !== PIN_LENGTH) return
    setBusy(true)
    setError(null)
    const result = await run(typed)
    setBusy(false)
    setPin('')
    if (result === null) {
      onDone()
    } else if (result === 'locked') {
      // Five wrong PINs: the same as the lock screen, sign in again.
      await auth.signOut()
    } else {
      setError(result)
    }
  }

  // ===== 2. The box =====
  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="pin-title">
        <h3 id="pin-title">{title}</h3>
        <p>{explain}</p>
        <p>Type your PIN to confirm.</p>
        <CodeBoxes
          length={PIN_LENGTH}
          value={pin}
          onChange={setPin}
          onComplete={confirm}
          secret
          label="Your PIN"
          autoFocus
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.buttons}>
          <button className={styles.button} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={`${styles.button} ${serious ? styles.dangerFull : styles.primary}`}
            onClick={() => confirm(pin)}
            disabled={busy || pin.length !== PIN_LENGTH}
          >
            {busy ? 'Checking…' : action}
          </button>
        </div>
      </div>
    </div>
  )
}
