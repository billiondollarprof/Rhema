/*
 * app/lock/page.tsx: the lock screen.
 *
 * Why: after 10 minutes without use, or when somebody taps "Lock screen",
 * the RHEMA idle screen covers the app (Anthony, 2026-10-28: the lock
 * screen uses the idle design). Tapping it opens the PIN card from the
 * demo: "Welcome back", 4 digits, Unlock. Since 2026-10-30 the hospital
 * photos float behind the idle screen, the same as on the sign in page.
 *
 * At a shared desk (Anthony, 2026-10-29) the card also lists the other
 * people signed in on this device. Each one taps their own name and types
 * their own PIN, so whatever they do next carries their name.
 *
 * A click, a tap, or any key (Enter, a digit) opens the card. If the page
 * is still loading when somebody clicks, the card opens the moment it is
 * ready, and the cover keeps listening until then (Anthony, 2026-10-31:
 * a click on a desktop did nothing).
 *
 * Never: show anything from a patient record here. Never unlock without the
 * database saying the PIN is right.
 */
'use client'

import { useEffect, useState } from 'react'
import CodeBoxes from '@/components/auth/CodeBoxes'
import IdleScreen from '@/components/IdleScreen'
import PersonBadge from '@/components/auth/PersonBadge'
import SignInPhotos from '@/components/auth/SignInPhotos'
import styles from '@/components/auth/Auth.module.css'
import { PIN_LENGTH } from '@/lib/auth/config'
import { listAccounts, type DeviceAccount } from '@/lib/auth/device-accounts'
import { roleLabel } from '@/lib/auth/roles'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

export default function LockPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/lock/')
  const [open, setOpen] = useState(false)
  // The card shows only once the account is known to be locked.
  const showCard = open && auth.status === 'locked' && Boolean(auth.account)

  // ===== 1a. Any key opens the card too, for a desktop with a keyboard =====
  useEffect(() => {
    if (showCard) return
    function onKey(event: KeyboardEvent) {
      // Leave shortcuts such as Ctrl + R to the browser.
      if (event.ctrlKey || event.metaKey || event.altKey) return
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCard])

  return (
    <>
      {/* ===== 1. The idle screen, until somebody taps it. The hospital
          photos float behind it (Anthony, 2026-10-30). ===== */}
      <IdleScreen footer={<span>Tap anywhere to unlock</span>} behind={<SignInPhotos />} />
      {/* The cover stays until the card is really showing, so a click while
          the page is still loading is never lost. */}
      {!showCard ? (
        <button className={styles.tapArea} aria-label="Unlock" onClick={() => setOpen(true)} />
      ) : null}

      {/* ===== 2. The PIN card. A new key per person starts it empty. ===== */}
      {showCard && auth.account ? <PinCard key={auth.account.id} /> : null}
    </>
  )
}

function PinCard() {
  const auth = useAuth()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = auth.account?.name ?? ''
  // The other people remembered on this device, for a shared desk.
  const others: DeviceAccount[] = listAccounts().filter((person) => person.id !== auth.account?.id)

  // ===== 3. Check the PIN with the database =====
  async function tryPin(typed: string) {
    setBusy(true)
    setError(null)
    const result = await auth.unlock(typed)
    setBusy(false)
    if (result === 'wrong') {
      setError('That PIN is not right. Try again.')
      setPin('')
    }
  }

  return (
    <div className={styles.overlay}>
      <section className={styles.card}>
        <PersonBadge name={name} large />
        <h2>Welcome back, {name}</h2>
        <p className={styles.lead}>Enter your 4 digit PIN to continue</p>
        <CodeBoxes
          length={PIN_LENGTH}
          value={pin}
          onChange={setPin}
          onComplete={tryPin}
          secret
          label="Your PIN"
          autoFocus
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <button
          className={`${styles.button} ${styles.primary}`}
          disabled={pin.length !== PIN_LENGTH || busy}
          onClick={() => tryPin(pin)}
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>

        {/* ===== 4. Somebody else at the same desk ===== */}
        {others.length > 0 ? (
          <>
            <p className={styles.note}>Not you? Tap your name.</p>
            <div className={styles.people}>
              {others.map((person) => (
                <button
                  key={person.id}
                  className={styles.person}
                  onClick={() => auth.switchTo(person.id)}
                >
                  <PersonBadge name={person.name} />
                  <span>
                    <b>{person.name}</b>
                    <small>{roleLabel(person.role)}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        <button className={styles.button} onClick={auth.useAnotherAccount}>
          Sign in as someone else
        </button>
      </section>
    </div>
  )
}
