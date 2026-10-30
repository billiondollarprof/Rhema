/*
 * lib/install/device.ts: what kind of device the app is running on, and
 * whether it has been installed (added to the home screen or the desktop).
 *
 * Why: Anthony, 2026-10-30 (requests 102 to 105). Every staff phone and
 * computer installs RHEMA first, then turns on call alerts inside the
 * installed app. How you install depends on the device:
 *   - Android, and Chrome or Edge on a computer: the browser can install
 *     with one button (section 3).
 *   - iPhone, iPad and Safari on a Mac: no website may install itself, so
 *     the person follows the Share, then Add to Home Screen steps.
 *
 * Never: guess "installed" from anything but the browser's own answer. A
 * wrong "installed" would hide the install card from someone who needs it.
 */

// ===== 1. The kinds of device =====
export type Platform =
  | 'iphone' // iPhone or iPod: Safari, Share button at the bottom
  | 'ipad' // iPad: Safari, Share button at the top
  | 'mac-safari' // Safari on a Mac: File, then Add to Dock
  | 'android' // Android: Chrome installs with one button
  | 'desktop' // Chrome or Edge on Windows, Mac or Linux: one button
  | 'other' // a browser that cannot install apps (Firefox and so on)

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const agent = navigator.userAgent
  // An iPad says it is a Mac, but a Mac has no touch screen.
  const touchMac = /Macintosh/.test(agent) && navigator.maxTouchPoints > 1
  if (/iPhone|iPod/.test(agent)) return 'iphone'
  if (/iPad/.test(agent) || touchMac) return 'ipad'
  if (/Android/.test(agent)) return 'android'
  const chromium = /Chrome|Chromium|Edg\//.test(agent)
  if (/Macintosh/.test(agent) && /Safari/.test(agent) && !chromium) return 'mac-safari'
  if (chromium) return 'desktop'
  return 'other'
}

// iPhone, iPad and Mac Safari install by hand, with the guide.
export function installsByHand(platform: Platform): boolean {
  return platform === 'iphone' || platform === 'ipad' || platform === 'mac-safari'
}

// ===== 2. Is this the installed app? =====
// The installed app opens in its own window, without the browser bar.
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone || iosStandalone
}

// ===== 3. The one button install (Android, Chrome and Edge) =====
// The browser offers it once, early, as an event. We keep that event, and
// use it when the person taps Install.
type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}
let saved: InstallEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop the browser's own small banner; our card does the asking.
    event.preventDefault()
    saved = event as InstallEvent
    listeners.forEach((tell) => tell())
  })
  window.addEventListener('appinstalled', () => {
    saved = null
    listeners.forEach((tell) => tell())
  })
}

export function canInstallNow(): boolean {
  return saved !== null
}

// Tell the screen when the install button becomes possible, or is used.
export function onInstallChange(tell: () => void): () => void {
  listeners.add(tell)
  return () => listeners.delete(tell)
}

// Show the browser's own install box. Returns true if they installed.
export async function installNow(): Promise<boolean> {
  if (!saved) return false
  const event = saved
  await event.prompt()
  const choice = await event.userChoice
  if (choice.outcome === 'accepted') saved = null
  return choice.outcome === 'accepted'
}
