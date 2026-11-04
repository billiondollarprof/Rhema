/*
 * lib/brand/brand.ts: the hospital's name and mark, in one place.
 *
 * Why: request 150 (Anthony, 2026-11-04). The testing site is also used to
 * show the system to a new client: "anytime we want to pitch a new client,
 * you hide the Rema stuff and put the name of the client." So every screen
 * takes the name from here, and the build picks which hospital it is.
 *
 * How the build picks:
 *   - main (the live Rhema site) is always 'rhema'. deploy.yml never sets
 *     anything else for main.
 *   - testing reads ops/pitch.json. {"brand": "rhema"} puts Rhema back;
 *     {"brand": "mascap"} shows MASCAP. A new client is a new entry below
 *     plus its icons in web/brands/<key>/ (scripts/pitch-brand.mjs).
 *
 * pitch: true also shows Automations in the menu, the list of what is
 * coming next, for the meeting.
 *
 * Never: let a pitch brand reach the live site, or put a real patient's
 * detail into a brand.
 */

// ===== 1. The shape =====
export type Brand = {
  key: string
  // "Rhema Medical Centre": the tab, the app name, the alt text.
  name: string
  // "RHEMA": the installed app's short name and the install words.
  short: string
  // Letters in a circle instead of the logo picture; null uses /logo.webp.
  initials: string | null
  // The receipt's address line; empty leaves it out.
  address: string
  // Shows Automations in the menu (pitch only).
  pitch: boolean
}

// ===== 2. The hospitals =====
const BRANDS: Record<string, Brand> = {
  rhema: {
    key: 'rhema',
    name: 'Rhema Medical Centre',
    short: 'RHEMA',
    initials: null,
    address: 'Former License Office by Ojolu Junction, Sapele, Delta State, Nigeria',
    pitch: false,
  },
  lana: {
    key: 'lana',
    name: 'LANA Medical Centre',
    short: 'LANA',
    initials: 'LA',
    address: '',
    pitch: true,
  },
  mascap: {
    key: 'mascap',
    name: 'MASCAP Medical Centre',
    short: 'MASCAP',
    initials: 'MA',
    address: '',
    pitch: true,
  },
}

// ===== 3. The one in use for this build =====
export const BRAND: Brand = BRANDS[process.env.NEXT_PUBLIC_BRAND ?? 'rhema'] ?? BRANDS.rhema
