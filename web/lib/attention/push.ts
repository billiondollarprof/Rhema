/*
 * lib/attention/push.ts: Call attention alerts on this device, even when
 * the app is closed (step 2, Anthony 2026-10-29).
 *
 * How it works, in order:
 *   1. The app registers the background script /sw.js once it opens.
 *   2. A person taps "Turn on". The browser asks "Allow notifications?".
 *   3. If they allow, the browser makes a push address for this device,
 *      using our public VAPID key from /api/push/key.
 *   4. register_push_device() keeps that address under their account.
 *   5. When their room is called, the database and the Worker send the
 *      notification, and /sw.js shows it.
 *
 * A shared desk computer has one push address for the whole browser. Each
 * person who signs in on it is added under their own name (section 4), and
 * signing out removes only that person (section 5).
 *
 * Never: send the push address anywhere except register_push_device().
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type AlertsState = 'unsupported' | 'blocked' | 'off' | 'on' | 'not-ready'

// ===== 1. Can this device do it at all? =====
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// An iPhone only allows it once the app is on the home screen.
export function needsHomeScreen(): boolean {
  if (typeof window === 'undefined') return false
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const installed = window.matchMedia('(display-mode: standalone)').matches
  return apple && !installed
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 =
    base64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64Url.length + 3) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function publicKey(): Promise<string | null> {
  try {
    const response = await fetch('/api/push/key')
    if (!response.ok) return null
    return ((await response.json()) as { publicKey: string }).publicKey
  } catch {
    return null
  }
}

// A person who turned alerts off on this device stays off, even though the
// browser keeps its push address for colleagues at a shared desk.
function offKey(staffId: string) {
  return `rhema-alerts-off-${staffId}`
}
function markOff(staffId: string, off: boolean) {
  try {
    if (off) localStorage.setItem(offKey(staffId), '1')
    else localStorage.removeItem(offKey(staffId))
  } catch {
    // Private window: nothing to remember. The database row still decides.
  }
}
function turnedOff(staffId: string): boolean {
  try {
    return localStorage.getItem(offKey(staffId)) === '1'
  } catch {
    return false
  }
}

// ===== 2. Where things stand for this person on this device =====
// "On" means this browser can receive, and this person's row is there.
export async function alertsState(client: SupabaseClient): Promise<AlertsState> {
  if (!pushSupported() || needsHomeScreen()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  const reg = await registration()
  const subscription = await reg?.pushManager.getSubscription()
  if (!subscription) return 'off'
  const { data } = await client
    .from('push_devices')
    .select('id')
    .eq('endpoint', subscription.endpoint)
    .limit(1)
  return data && data.length ? 'on' : 'off'
}

// ===== 3. Turn on: ask, make the push address, keep it =====
export async function turnOnAlerts(client: SupabaseClient, staffId: string): Promise<AlertsState> {
  if (!pushSupported() || needsHomeScreen()) return 'unsupported'
  markOff(staffId, false)
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const key = await publicKey()
  const reg = await registration()
  if (!key || !reg) return 'not-ready'
  try {
    let subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      })
    }
    return (await keep(client, subscription)) ? 'on' : 'not-ready'
  } catch {
    // The browser could not reach its push service (offline, or blocked).
    return 'not-ready'
  }
}

async function keep(client: SupabaseClient, subscription: PushSubscription): Promise<boolean> {
  const json = subscription.toJSON()
  const { error } = await client.rpc('register_push_device', {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth_key: json.keys?.auth ?? '',
  })
  if (error) console.warn(`Alerts could not be turned on: ${error.code}`)
  return !error
}

// ===== 4. On opening the app: keep this person on this device =====
// If alerts are already on in this browser (perhaps by a colleague at a
// shared desk), the person now signed in is added too. If our key changed
// since the address was made, the address is made again.
export async function refreshAlerts(client: SupabaseClient, staffId: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted' || turnedOff(staffId)) return
  const reg = await registration()
  let subscription = await reg?.pushManager.getSubscription()
  if (!reg || !subscription) return
  const key = await publicKey()
  if (!key) return
  const current = subscription.options.applicationServerKey
  const same = current && new Uint8Array(current).join(',') === keyBytes(key).join(',')
  try {
    if (!same) {
      await subscription.unsubscribe()
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      })
    }
    await keep(client, subscription)
  } catch {
    // Offline: try again the next time the app opens.
  }
}

// ===== 5. Turn off, or sign out: remove this person from this device =====
// The browser's push address stays, because colleagues at a shared desk
// may still use it. Only this person's row goes. Turning off is remembered
// (section 2); signing out is not, so signing in again brings alerts back.
export async function turnOffAlerts(client: SupabaseClient, staffId: string): Promise<void> {
  markOff(staffId, true)
  await forgetThisDevice(client)
}

export async function forgetThisDevice(client: SupabaseClient): Promise<void> {
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const subscription = await reg?.pushManager.getSubscription()
    if (!subscription) return
    const { error } = await client.rpc('forget_push_device', { endpoint: subscription.endpoint })
    if (error) console.warn(`Alerts could not be turned off: ${error.code}`)
  } catch {
    // Offline: the row stays until the next sign out. Nothing breaks.
  }
}
