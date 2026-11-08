/*
 * components/legal/AgreementGate.tsx: the card that asks a signed in member
 * of staff to agree to the Terms of Use and the Privacy Policy, when they
 * have not agreed to the current words yet.
 *
 * Why: Anthony, 2026-11-08 (request 156): "everyone should during pin set
 * up and also myself that already uses the master account." New staff tick
 * on the Choose your PIN screen (app/sign-in). This card catches everybody
 * who already had a PIN before the tick existed, and anybody whose words
 * changed since they agreed (LEGAL_VERSION moved). It has no close button:
 * the app stays covered until they agree.
 *
 * It shows nothing while an automatic test drives the browser
 * (navigator.webdriver), like the install cards, so the screen checks can
 * use the screens. A person's browser never says webdriver.
 *
 * Never: let the card go away without the agreement saved in the database.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Logo from '@/components/brand/Logo'
import card from '@/components/onboarding/onboarding.module.css'
import auth from '@/components/auth/Auth.module.css'
import { LEGAL_VERSION } from './PrivacyText'
import styles from './legal.module.css'

type State = 'checking' | 'needed' | 'done'

export default function AgreementGate({
  client,
  staffId,
  onDone,
}: {
  client: SupabaseClient
  staffId: string
  // Called once nothing is left to agree to, so the next cards can show.
  onDone: () => void
}) {
  const [state, setState] = useState<State>('checking')
  const [ticked, setTicked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ===== 1. Has this person agreed to these words? =====
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return
    let stillHere = true
    client
      .from('staff')
      .select('terms_version')
      .eq('id', staffId)
      .maybeSingle()
      .then(({ data, error: failed }) => {
        if (!stillHere) return
        // No answer (for example no network): ask again next time, rather
        // than covering the app when the person may already have agreed.
        if (failed || !data) return setState('done')
        setState(data.terms_version === LEGAL_VERSION ? 'done' : 'needed')
      })
    return () => {
      stillHere = false
    }
  }, [client, staffId])

  // ===== 2. Saving the agreement =====
  async function agree() {
    setBusy(true)
    setError(null)
    const { data, error: failed } = await client.rpc('agree_to_terms', { terms: LEGAL_VERSION })
    setBusy(false)
    if (failed || data !== true) {
      setError('Your agreement could not be saved. Check the internet and try again.')
      return
    }
    setState('done')
  }

  // Tell the app shell once there is nothing (left) to agree to.
  const finished = state === 'done' || (typeof navigator !== 'undefined' && navigator.webdriver)
  useEffect(() => {
    if (finished) onDone()
  }, [finished, onDone])

  if (state !== 'needed') return null

  // ===== 3. The card =====
  return (
    <div
      className={card.backdrop}
      // Above the install and alerts cards (z-index 70). Set here, not in
      // the CSS file, because the two files can load in either order.
      style={{ zIndex: 80 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agree-title"
    >
      <div className={card.card}>
        <div className={`${card.badge} ${card.badgeLogo}`}>
          <Logo size={58} />
        </div>
        <h2 id="agree-title">Before you continue</h2>
        <p className={styles.gateLead}>
          Patient information is confidential. Please read and agree to how it must be handled.
        </p>
        <label className={auth.agree}>
          <input
            type="checkbox"
            checked={ticked}
            onChange={(event) => setTicked(event.target.checked)}
          />
          <span>
            I have read the{' '}
            <a href="/terms/" target="_blank" rel="noopener">
              Terms of Use
            </a>{' '}
            and the{' '}
            <a href="/privacy/" target="_blank" rel="noopener">
              Privacy Policy
            </a>
            . I will keep patient information confidential and use it only for patient care.
          </span>
        </label>
        {error ? <p className={card.error}>{error}</p> : null}
        <button className={card.primary} onClick={agree} disabled={!ticked || busy}>
          {busy ? 'Saving…' : 'I agree'}
        </button>
      </div>
    </div>
  )
}
