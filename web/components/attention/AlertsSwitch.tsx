/*
 * components/attention/AlertsSwitch.tsx: the "Alerts on this device" line
 * at the bottom of the Call attention list.
 *
 * Why: Call attention step 2 (Anthony, 2026-10-29). Each person switches
 * alerts on once per device, so their phone or computer rings even when
 * the app is closed. One line, one button, nothing to set up.
 *
 * What it shows:
 *   - Off: "Get calls when the app is closed" and a Turn on button.
 *   - On: "On for this device" and a Turn off button.
 *   - Blocked: the person said no to notifications; how to allow them.
 *   - Not possible here: an iPhone needs the app on the home screen first.
 *
 * Never: ask for notifications by itself. The browser asks only after the
 * person taps Turn on.
 */
'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './attention.module.css'
import {
  alertsState,
  needsHomeScreen,
  turnOffAlerts,
  turnOnAlerts,
  type AlertsState,
} from '@/lib/attention/push'

export default function AlertsSwitch({
  client,
  staffId,
}: {
  client: SupabaseClient
  staffId: string
}) {
  const [state, setState] = useState<AlertsState | 'checking'>('checking')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    alertsState(client).then((found) => {
      if (current) setState(found)
    })
    return () => {
      current = false
    }
  }, [client])

  async function turnOn() {
    setBusy(true)
    setState(await turnOnAlerts(client, staffId))
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true)
    await turnOffAlerts(client, staffId)
    setState('off')
    setBusy(false)
  }

  if (state === 'checking') return null

  const words: Record<AlertsState, string> = {
    on: 'Alerts are on for this device',
    off: 'Get calls when the app is closed',
    blocked: 'Notifications are blocked. Allow them for this site in the browser settings.',
    unsupported: needsHomeScreen()
      ? 'On iPhone, add this app to the home screen first (Share, then Add to Home Screen).'
      : 'This browser cannot show alerts when the app is closed.',
    'not-ready': 'Alerts could not be turned on. Try again in a moment.',
  }

  return (
    <div className={styles.alertsRow}>
      <small>{words[state]}</small>
      {state === 'on' ? (
        <button className={styles.alertsButton} onClick={turnOff} disabled={busy}>
          Turn off
        </button>
      ) : null}
      {state === 'off' || state === 'not-ready' ? (
        <button
          className={`${styles.alertsButton} ${styles.alertsOn}`}
          onClick={turnOn}
          disabled={busy}
        >
          {busy ? 'Turning on…' : 'Turn on'}
        </button>
      ) : null}
    </div>
  )
}
