/*
 * components/onboarding/OnboardingGate.tsx: the cards every staff member
 * goes through once on each phone or computer, in this order:
 *   1. Install RHEMA (requests 102 and 104)
 *   2. Allow call alerts, inside the installed app (request 103)
 *   3. Android only: set a loud ring for RHEMA (request 105, option a)
 *
 * Why: Anthony, 2026-10-30. Alerts only reach a phone that has RHEMA
 * installed and alerts allowed, so both are required: "it's a mandatory
 * requirement... there is no X, it's only the allow button." The cards
 * float in the middle of the screen, "because it's something that needs to
 * be seen", with a short explanation beside a drawn line.
 *
 * When it shows nothing:
 *   - the device cannot install apps or show alerts (an old browser): it
 *     never asks for the impossible;
 *   - the browser is driven by an automatic test (navigator.webdriver), so
 *     the checks in CI can use the screens. This is not a way round it for
 *     people: a person's browser never says webdriver.
 *
 * Never: show an X or a "later" button on these cards. Never ask for alerts
 * before the app is installed on a phone that needs it (iPhone, iPad).
 */
'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import InstallGuide from './InstallGuide'
import styles from './onboarding.module.css'
import { alertsState, turnOnAlerts, type AlertsState } from '@/lib/attention/push'
import {
  canInstallNow,
  detectPlatform,
  installNow,
  installsByHand,
  isInstalled,
  onInstallChange,
  type Platform,
} from '@/lib/install/device'

type Stage = 'checking' | 'install' | 'installed-elsewhere' | 'allow' | 'ring' | 'done'

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
  if (typeof navigator !== 'undefined' && navigator.webdriver) return 'done'
  if (platform !== 'other' && !isInstalled()) return 'install'
  const alerts = await alertsState(client)
  if (alerts === 'off' || alerts === 'blocked' || alerts === 'not-ready') return 'allow'
  if (platform === 'android' && alerts === 'on' && !ringAlreadySet()) return 'ring'
  return 'done'
}

// ===== 2. The explanation beside a drawn line =====
function Explain({ lines }: { lines: string[] }) {
  return (
    <div className={styles.explain}>
      {lines.map((line, i) => (
        <p key={line} style={{ animationDelay: `${0.35 + i * 0.25}s` }}>
          {line}
        </p>
      ))}
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
  const [platform] = useState<Platform>(() => detectPlatform())
  const [stage, setStage] = useState<Stage>('checking')
  const [guide, setGuide] = useState(false)
  const [busy, setBusy] = useState(false)
  const [alerts, setAlerts] = useState<AlertsState | null>(null)

  // Look again: used on opening, and by the "Check again" button.
  const check = useCallback(async () => {
    setStage(await pickStage(client, platform))
    setAlerts(await alertsState(client))
  }, [client, platform])

  useEffect(() => {
    let current = true
    pickStage(client, platform).then((found) => {
      if (current) setStage(found)
    })
    alertsState(client).then((found) => {
      if (current) setAlerts(found)
    })
    return () => {
      current = false
    }
  }, [client, platform])

  // The one tap install (Android, Chrome, Edge) becomes possible a moment
  // after the page opens; this follows it.
  const oneTap = useSyncExternalStore(onInstallChange, canInstallNow, () => false)

  if (stage === 'checking' || stage === 'done') return null

  async function install() {
    if (installsByHand(platform) || !oneTap) {
      setGuide(true)
      return
    }
    setBusy(true)
    const accepted = await installNow()
    setBusy(false)
    if (accepted) setStage('installed-elsewhere')
  }

  async function allow() {
    setBusy(true)
    const result = await turnOnAlerts(client, staffId)
    setBusy(false)
    setAlerts(result)
    if (result === 'on') setStage(platform === 'android' && !ringAlreadySet() ? 'ring' : 'done')
  }

  function ringDone() {
    try {
      localStorage.setItem(RING_SET_KEY, '1')
    } catch {
      // Private window: it may ask again next time. Nothing breaks.
    }
    setStage('done')
  }

  const guidePlatform = platform === 'other' ? 'desktop' : platform

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
            <div className={styles.badge} aria-hidden="true">
              <span>RH</span>
            </div>
            <h2 id="onboarding-title">Install the RHEMA app</h2>
            {guide ? (
              <>
                <InstallGuide platform={guidePlatform} />
                <p className={styles.small}>
                  Then open RHEMA from{' '}
                  {platform === 'mac-safari' || platform === 'desktop'
                    ? 'your apps'
                    : 'your home screen'}{' '}
                  and sign in there.
                </p>
              </>
            ) : (
              <>
                <Explain
                  lines={[
                    'It opens in one tap, fast, like any app on your phone.',
                    'Calls from other rooms reach you, even when the app is closed.',
                    'Every staff phone and computer needs it. It takes less than a minute.',
                  ]}
                />
                <button className={styles.primary} onClick={install} disabled={busy}>
                  {busy ? 'Installing…' : 'Install'}
                </button>
              </>
            )}
            <Link className={styles.help} href="/install/">
              Other devices
            </Link>
          </>
        ) : null}

        {/* ----- Installed from this browser: now open the app ----- */}
        {stage === 'installed-elsewhere' ? (
          <>
            <div className={styles.badge} aria-hidden="true">
              <span>RH</span>
            </div>
            <h2 id="onboarding-title">RHEMA is installed</h2>
            <Explain
              lines={[
                platform === 'android'
                  ? 'Open RHEMA from your home screen and sign in there.'
                  : 'RHEMA opens in its own window. Use it from there.',
                'You can close this browser tab.',
              ]}
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
            {alerts === 'blocked' ? (
              <>
                <Explain
                  lines={[
                    'Alerts are blocked on this device, so calls cannot reach you.',
                    platform === 'android'
                      ? 'Open Settings, then Apps, then RHEMA, then Notifications, and switch them on.'
                      : platform === 'iphone' || platform === 'ipad'
                        ? 'Open Settings, then Notifications, then RHEMA, and switch on Allow Notifications.'
                        : 'Click the lock icon beside the address, then allow Notifications.',
                    'Then come back and tap Check again.',
                  ]}
                />
                <button className={styles.primary} onClick={() => void check()}>
                  Check again
                </button>
              </>
            ) : (
              <>
                <Explain
                  lines={[
                    'When a room calls you, this device rings straight away.',
                    'It works even when the app is closed or the phone is locked.',
                    'This is required for every staff member. Tap Allow, then Allow again when asked.',
                  ]}
                />
                {alerts === 'not-ready' ? (
                  <p className={styles.error}>
                    That did not work. Check the internet and try again.
                  </p>
                ) : null}
                <button className={styles.primary} onClick={allow} disabled={busy}>
                  {busy ? 'Turning on…' : 'Allow'}
                </button>
              </>
            )}
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
            <h2 id="onboarding-title">Alerts are on. Now make them loud</h2>
            <Explain
              lines={[
                'Your phone uses its quiet message tone for RHEMA. Give RHEMA a loud ring instead.',
                'Open Settings, then Apps, then RHEMA, then Notifications.',
                'Tap the alert type, then Sound, and pick a loud ringtone.',
              ]}
            />
            <button className={styles.primary} onClick={ringDone}>
              I have set the ring
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
