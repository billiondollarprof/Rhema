/*
 * components/onboarding/OnboardingGate.tsx: the cards a staff member sees
 * on a phone or computer until RHEMA is installed and alerts are on:
 *   1. Install RHEMA (requests 102, 104, 107)
 *   2. Allow call alerts, only inside the installed app (request 103)
 *   3. Android only: give RHEMA a loud ring (request 105, option a)
 *
 * Why, in Anthony's words (2026-10-30):
 *   - Install: the eye goes to the Install button first. A separate line
 *     says "if you have already installed... click here to ignore". "Once
 *     they click, don't remind them again", and never show the install
 *     card "more than 3 times" in one browser. On an iPhone, an iPad or
 *     Mac Safari, Install opens the full install page ("clean and bigger").
 *     On Android, Chrome and Edge, "just click the install button and it
 *     installs."
 *   - Alerts: required, no X, only Allow. If they tap Block, "just leave
 *     it... let it not be like all those annoying ads." The call card
 *     reminds them later (AttentionAlerts).
 *   - All cards float in the middle of the screen, "because it's
 *     something that needs to be seen."
 *
 * It shows nothing when the device cannot install or show alerts, and when
 * an automatic test drives the browser (navigator.webdriver), so the
 * checks in CI can use the screens. A person's browser never says
 * webdriver.
 *
 * Never: ask for alerts on an iPhone or iPad before RHEMA is installed
 * there; they cannot work. Never show the Allow card again after Block.
 */
'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './onboarding.module.css'
import Logo from '@/components/brand/Logo'
import { alertsState, turnOnAlerts } from '@/lib/attention/push'
import {
  canInstallNow,
  countInstallShown,
  detectPlatform,
  installCardWanted,
  installNow,
  installsByHand,
  isInstalled,
  onInstallChange,
  skipInstall,
  type Platform,
} from '@/lib/install/device'
import { BRAND } from '@/lib/brand/brand'

type Stage = 'checking' | 'install' | 'installed-elsewhere' | 'allow' | 'ring' | 'done'

// PAUSED 2026-10-30 to 2026-11-08. Anthony, 2026-10-30: "we should pause
// the ask for now... before we hand over to the hospital... we can now
// bring it back." The reason was that sign in used an email link, which on
// an iPhone or iPad opens Safari, not the installed app. Since 2026-11-07
// both sign in emails carry the 6 digit code (checked every day by
// ops/supabase_check.py), so the cards are back on for the handover
// (request 109, found missing in the pass of 2026-11-08, request 155).
// Set it to true again only on his word.
const CARDS_PAUSED = false

const RING_SET_KEY = 'rhema-loud-ring-set'

function ringAlreadySet(): boolean {
  try {
    return localStorage.getItem(RING_SET_KEY) === '1'
  } catch {
    return false
  }
}

// ===== 1. Which card, if any =====
async function pickStage(client: SupabaseClient, platform: Platform): Promise<Stage> {
  if (CARDS_PAUSED) return 'done'
  if (typeof navigator !== 'undefined' && navigator.webdriver) return 'done'
  const installed = isInstalled()
  if (!installed && platform !== 'other') {
    // Not installed in this window: ask, unless they skipped or were asked 3 times.
    return installCardWanted() ? 'install' : 'done'
  }
  // Installed (or a browser that cannot install): now the alerts.
  const alerts = await alertsState(client)
  if (alerts === 'off' || alerts === 'not-ready') return 'allow'
  if (platform === 'android' && alerts === 'on' && !ringAlreadySet()) return 'ring'
  // 'blocked' lands here on purpose: we leave them alone.
  return 'done'
}

// ===== 2. The explanation beside a drawn line =====
function Explain({ lines, children }: { lines: string[]; children?: React.ReactNode }) {
  return (
    <div className={styles.explain}>
      {lines.map((line, i) => (
        <p key={line} style={{ animationDelay: `${0.35 + i * 0.25}s` }}>
          {line}
        </p>
      ))}
      {children}
    </div>
  )
}

// ===== 3. The gate =====
export default function OnboardingGate({
  client,
  staffId,
}: {
  client: SupabaseClient
  staffId: string
}) {
  const router = useRouter()
  const [platform] = useState<Platform>(() => detectPlatform())
  const [stage, setStage] = useState<Stage>('checking')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(false)
  const counted = useRef(false)

  useEffect(() => {
    let current = true
    pickStage(client, platform).then((found) => {
      if (!current) return
      setStage(found)
      // Count one showing of the install card for this visit.
      if (found === 'install' && !counted.current) {
        counted.current = true
        countInstallShown()
      }
    })
    return () => {
      current = false
    }
  }, [client, platform])

  // The one tap install (Android, Chrome, Edge) becomes possible a moment
  // after the page opens; this follows it.
  const oneTap = useSyncExternalStore(onInstallChange, canInstallNow, () => false)

  if (stage === 'checking' || stage === 'done') return null

  // ----- What the buttons do -----
  async function install() {
    if (installsByHand(platform) || !oneTap) {
      router.push('/install/')
      return
    }
    setBusy(true)
    const accepted = await installNow()
    setBusy(false)
    if (accepted) setStage('installed-elsewhere')
  }

  function skip() {
    skipInstall()
    setStage('done')
  }

  async function allow() {
    setBusy(true)
    setProblem(false)
    const result = await turnOnAlerts(client, staffId)
    setBusy(false)
    if (result === 'on') setStage(platform === 'android' && !ringAlreadySet() ? 'ring' : 'done')
    else if (result === 'not-ready') setProblem(true)
    // Blocked or closed: leave them alone. The call card reminds them later.
    else setStage('done')
  }

  function ringDone() {
    try {
      localStorage.setItem(RING_SET_KEY, '1')
    } catch {
      // Private window: it may ask again next time. Nothing breaks.
    }
    setStage('done')
  }

  const phone = platform === 'android' || platform === 'iphone'
  const device = phone ? 'phone' : platform === 'ipad' ? 'iPad' : 'computer'

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        {/* ----- Install ----- */}
        {stage === 'install' ? (
          <>
            <div className={`${styles.badge} ${styles.badgeLogo}`}>
              <Logo size={58} />
            </div>
            <h2 id="onboarding-title">
              Install {BRAND.short} on this {device}
            </h2>
            <Explain
              lines={[
                `Once it is installed, you open ${BRAND.short} from your ${phone || platform === 'ipad' ? 'home screen' : 'apps'} with one tap.`,
                'Calls from other rooms will reach you even when the app is closed.',
                'Every staff phone and computer needs it. It takes about a minute.',
              ]}
            >
              <button className={styles.skip} onClick={skip} style={{ animationDelay: '1.1s' }}>
                Already installed {BRAND.short} on this {device}? Tap here to skip this.
              </button>
            </Explain>
            <button className={styles.primary} onClick={install} disabled={busy}>
              {busy ? 'Installing…' : 'Install'}
            </button>
          </>
        ) : null}

        {/* ----- Installed from this browser: now open the app ----- */}
        {stage === 'installed-elsewhere' ? (
          <>
            <div className={`${styles.badge} ${styles.badgeLogo}`}>
              <Logo size={58} />
            </div>
            <h2 id="onboarding-title">{BRAND.short} is installed</h2>
            <Explain
              lines={
                platform === 'android'
                  ? [
                      `Open ${BRAND.short} from your home screen and sign in there.`,
                      'You can close this browser tab now.',
                    ]
                  : [
                      `${BRAND.short} has opened in its own window. Carry on there.`,
                      'You can close this browser tab now.',
                    ]
              }
            />
          </>
        ) : null}

        {/* ----- Allow alerts ----- */}
        {stage === 'allow' ? (
          <>
            <div className={`${styles.badge} ${styles.badgeRed}`} aria-hidden="true">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                <path d="M14.05 2a9 9 0 0 1 8 7.94M14.05 6A5 5 0 0 1 18 10" />
              </svg>
            </div>
            <h2 id="onboarding-title">Turn on call alerts</h2>
            <Explain
              lines={[
                `When a room calls you, this ${device} will ring straight away, even when ${BRAND.short} is closed.`,
                'Every staff member needs this on. Tap Allow, then tap Allow again when you are asked.',
              ]}
            />
            {problem ? (
              <p className={styles.error}>
                That did not work. Check the internet and tap Allow again.
              </p>
            ) : null}
            <button className={styles.primary} onClick={allow} disabled={busy}>
              {busy ? 'Turning on…' : 'Allow'}
            </button>
          </>
        ) : null}

        {/* ----- Android: a loud ring ----- */}
        {stage === 'ring' ? (
          <>
            <div className={`${styles.badge} ${styles.badgeGreen}`} aria-hidden="true">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2 id="onboarding-title">Now make {BRAND.short} ring loud</h2>
            <Explain
              lines={[
                `Right now your phone uses its quiet message tone for ${BRAND.short} calls.`,
                `Open Settings, then Apps, then ${BRAND.short}, then Notifications.`,
                'Tap Sound and pick a loud ringtone. Then come back here.',
              ]}
            />
            <button className={styles.primary} onClick={ringDone}>
              Done
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
