/*
 * lib/theme/theme.ts: the light or dark look, chosen on this device.
 *
 * Why: Anthony, 2026-11-16 (request 196g): "some of the nurses are
 * complaining that it's too bright." Each person picks the dark look from
 * the menu. It is kept on the device, so a shared ward tablet keeps the look
 * the ward chose.
 *
 * The page sets the look before anything shows (THEME_FIRST in
 * app/layout.tsx), so the screen never flashes white first.
 *
 * Never: keep anything about a person here. It is one word: light or dark.
 */

// ===== 1. Where it is kept, and the two looks =====
export const THEME_KEY = 'rhema-theme'
export type Theme = 'light' | 'dark'

// ===== 2. Read and set =====
export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // A private or full device: the look still changes for now.
  }
}

// ===== 3. The first thing the page runs, before it draws =====
export const THEME_FIRST = `(function () {
  try {
    if (localStorage.getItem('${THEME_KEY}') === 'dark') document.documentElement.dataset.theme = 'dark';
  } catch (e) {}
})();`
