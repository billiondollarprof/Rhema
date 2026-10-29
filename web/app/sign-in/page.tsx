/*
 * app/sign-in/page.tsx: the sign in page.
 *
 * Why: the RHEMA demo's sign in, made real. Four parts, in the order a
 * person meets them:
 *   1. Choose account   people already signed in on this device tap their
 *                       name, then type their PIN on the lock page.
 *   2. Email            a new person (or a new device) types their work
 *                       email, and a code is sent to it.
 *   3. Code             they type the 6 digit code from the email.
 *   4. First PIN        the first time, they choose a 4 digit PIN.
 *
 * Until the hospital's own email sender is connected (planned for
 * 6 November), Supabase's email carries a sign in link instead of a code.
 * Opening that link on this device signs the person in too.
 *
 * Never: say whether an email belongs to staff before a code is used, beyond
 * the plain "could not send" message. Never show a code or PIN after it is
 * typed. Never skip the PIN step: the PIN is what names the person at a
 * shared desk.
 */
'use client'

import { useState } from 'react'
import CodeBoxes from '@/components/auth/CodeBoxes'
import PersonBadge from '@/components/auth/PersonBadge'
import styles from '@/components/auth/Auth.module.css'
import { CODE_LENGTH, PIN_LENGTH } from '@/lib/auth/config'
import { listAccounts, type DeviceAccount } from '@/lib/auth/device-accounts'
import { roleLabel } from '@/lib/auth/roles'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

type Step = 'choose' | 'email' | 'code'

export default function SignInPage() {
  const auth = useAuth()
  useRightPage(auth.status, '/sign-in/')

  const [chosenStep, setStep] = useState<Step>('choose')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (auth.status === 'loading') return <div className={styles.page} />

  // The people remembered on this device. Read here, in the browser, once
  // the sign in state is known. With nobody remembered, start at the email.
  const people: DeviceAccount[] = listAccounts()
  const step: Step = chosenStep === 'choose' && people.length === 0 ? 'email' : chosenStep

  if (auth.status === 'not-configured') {
    return (
      <Shell title="Sign in" lead="Sign in is not set up on this copy of the app.">
        <p className={styles.note}>Open the testing or live address instead.</p>
      </Shell>
    )
  }

  // ===== 4. First PIN =====
  if (auth.status === 'needs-pin') return <ChoosePin />

  // ===== 1. Choose account =====
  if (step === 'choose') {
    return (
      <Shell title="Sign in" lead="Tap your name, then type your PIN.">
        {auth.notice ? <p className={styles.error}>{auth.notice}</p> : null}
        <div className={styles.people}>
          {people.map((person) => (
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
        <button className={styles.button} onClick={() => setStep('email')}>
          Sign in with a different account
        </button>
      </Shell>
    )
  }

  // ===== 2. Email =====
  async function sendCode() {
    setBusy(true)
    setError(null)
    const problem = await auth.requestCode(email.trim().toLowerCase())
    setBusy(false)
    if (problem) setError(problem)
    else {
      setCode('')
      setStep('code')
    }
  }

  if (step === 'email') {
    const looksRight = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    return (
      <Shell title="Sign in" lead="Use the account your administrator created for you.">
        {auth.notice ? <p className={styles.error}>{auth.notice}</p> : null}
        <label className={styles.label} htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && looksRight && !busy && sendCode()}
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <button
          className={`${styles.button} ${styles.primary}`}
          disabled={!looksRight || busy}
          onClick={sendCode}
        >
          {busy ? 'Sending…' : 'Send me a code'}
        </button>
        {people.length > 0 ? (
          <button className={`${styles.button} ${styles.quiet}`} onClick={() => setStep('choose')}>
            Back to the list of names
          </button>
        ) : null}
      </Shell>
    )
  }

  // ===== 3. Code =====
  async function checkCode(typed: string) {
    setBusy(true)
    setError(null)
    const problem = await auth.verifyCode(email.trim().toLowerCase(), typed)
    setBusy(false)
    if (problem) {
      setError(problem)
      setCode('')
    }
  }

  return (
    <Shell title="Enter your code" lead="">
      <p className={styles.lead}>
        We sent a {CODE_LENGTH} digit code to
        <br />
        <b>{email.trim()}</b>
      </p>
      <CodeBoxes
        length={CODE_LENGTH}
        value={code}
        onChange={setCode}
        onComplete={checkCode}
        label="Email code"
        autoFocus
      />
      {error ? <p className={styles.error}>{error}</p> : null}
      <button
        className={`${styles.button} ${styles.primary}`}
        disabled={code.length !== CODE_LENGTH || busy}
        onClick={() => checkCode(code)}
      >
        {busy ? 'Checking…' : 'Sign in'}
      </button>
      <p className={styles.note}>
        If the email has a sign in link instead, open it on this device.
      </p>
      <button className={`${styles.button} ${styles.quiet}`} onClick={() => setStep('email')}>
        Use a different email
      </button>
    </Shell>
  )
}

// ===== 4. First PIN: choose it, then type it again =====
function ChoosePin() {
  const auth = useAuth()
  const [first, setFirst] = useState('')
  const [again, setAgain] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(repeated: string) {
    if (repeated !== first) {
      setError('The two PINs were different. Choose your PIN again.')
      setFirst('')
      setAgain('')
      setConfirming(false)
      return
    }
    const problem = await auth.setPin(repeated)
    if (problem) setError(problem)
  }

  return (
    <Shell
      title={confirming ? 'Type it again' : 'Choose your PIN'}
      lead={
        confirming
          ? 'Type the same 4 digits once more.'
          : 'You will use these 4 digits to unlock the screen and to switch to your name at a shared desk.'
      }
    >
      {confirming ? (
        <CodeBoxes
          key="again"
          length={PIN_LENGTH}
          value={again}
          onChange={setAgain}
          onComplete={save}
          secret
          label="Type your PIN again"
          autoFocus
        />
      ) : (
        <CodeBoxes
          key="first"
          length={PIN_LENGTH}
          value={first}
          onChange={setFirst}
          onComplete={() => {
            setError(null)
            setConfirming(true)
          }}
          secret
          label="Choose your PIN"
          autoFocus
        />
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
      <p className={styles.note}>
        Do not share your PIN. Everything done under it carries your name.
      </p>
    </Shell>
  )
}

// ===== The card and its background, shared by every step =====
function Shell({
  title,
  lead,
  children,
}: {
  title: string
  lead: string
  children: React.ReactNode
}) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.mark} aria-hidden="true">
          RH
        </div>
        <h2>{title}</h2>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
        {children}
      </section>
    </main>
  )
}
