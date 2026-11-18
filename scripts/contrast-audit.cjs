/*
 * scripts/contrast-audit.cjs: every screen, in the light look and the dark
 * look, checked for text that is too faint to read.
 *
 * Why: Anthony, 2026-11-18 (request 227n): "make sure every page is dark
 * mode suitable and readable as well as light mode, so no text or design
 * disappears simply because someone toggles dark mode." A screenshot only
 * shows the screens somebody remembers to open; this opens all of them.
 *
 * How:
 *   1. Each screen in screens/screens-list.cjs opens at a phone width, once
 *      with the light look and once with the dark look (the menu's choice,
 *      saved on the device as "rhema-theme").
 *   2. For every visible piece of text, the colour of the words is compared
 *      with the colour behind them (the first solid background found going
 *      outwards). Below 3 to 1 is reported: by then the words are fading
 *      into what is behind them. (Normal text should reach 4.5 to 1; 3 to 1
 *      is the floor below which it disappears.)
 *   3. Any problem: the list, and a failed run.
 *
 * Never: change a screen, or pass a screen that did not load.
 */
const { chromium } = require('playwright')
const { signIn, mockSupabase } = require('./screens/mock.cjs')
const { SCREENS } = require('./screens/screens-list.cjs')

const APP = process.env.APP_URL || 'http://127.0.0.1:3100'
const FLOOR = 3

// ===== 1. Measured inside the page: faint text on this screen =====
function faintText(floor) {
  // "rgb(1, 2, 3)" or "rgba(1, 2, 3, 0.5)" to [r, g, b, a].
  const parse = (value) => {
    const n = (value.match(/[\d.]+/g) || []).map(Number)
    return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n.length > 3 ? n[3] : 1]
  }
  const light = ([r, g, b]) => {
    const one = (c) => {
      c /= 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * one(r) + 0.7152 * one(g) + 0.0722 * one(b)
  }
  // The solid colour behind an element: its own background, or the first
  // one found going outwards. Half see through ones are mixed in.
  const behind = (el) => {
    let colour = null
    for (let node = el; node; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor)
      if (getComputedStyle(node).backgroundImage !== 'none' && bg[3] === 0) return null
      if (bg[3] === 0) continue
      if (!colour) colour = bg
      else colour = colour.map((c, i) => (i < 3 ? c * colour[3] + bg[i] * (1 - colour[3]) : 1))
      if (colour[3] >= 1) return colour
      colour[3] = 1 - (1 - colour[3]) * (1 - bg[3])
    }
    return colour
  }
  const found = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const words = text.textContent.trim()
    if (!words) continue
    const el = text.parentElement
    if (!el || el.closest('svg, [aria-hidden="true"], input, textarea, select')) continue
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    const style = getComputedStyle(el)
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue
    // A button that cannot be pressed now is faint on purpose.
    if (el.closest('button:disabled, [aria-disabled="true"]')) continue
    const fg = parse(style.color)
    const bg = behind(el)
    if (!bg) continue
    const mixed = fg.map((c, i) => (i < 3 ? c * fg[3] + bg[i] * (1 - fg[3]) : 1))
    const a = light(mixed)
    const b = light(bg)
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    if (ratio < floor)
      found.push(
        `"${words.slice(0, 40)}" ${ratio.toFixed(1)}:1 (${style.color} on rgb(${bg.slice(0, 3).map(Math.round).join(', ')}))`,
      )
  }
  return [...new Set(found)]
}

// ===== 2. Walk every screen, in both looks =====
;(async () => {
  const browser = await chromium.launch()
  const problems = []
  for (const theme of ['light', 'dark']) {
    for (const screen of SCREENS) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
      await signIn(context, {
        role: screen.role ?? (screen.medical ? 'nurse' : 'front_desk'),
        medical: Boolean(screen.medical),
        admin: Boolean(screen.admin),
        ...(screen.roomId ? { roomId: screen.roomId } : {}),
      })
      await context.addInitScript((look) => {
        try {
          localStorage.setItem('rhema-theme', look)
        } catch {}
      }, theme)
      const page = await context.newPage()
      await mockSupabase(page, screen.extra ?? {})
      await page.goto(APP + screen.path)
      try {
        await page.getByText(screen.waitFor).first().waitFor({ timeout: 10000 })
      } catch {
        problems.push(`${theme} ${screen.path}: did not load ("${screen.waitFor}" never showed)`)
        await context.close()
        continue
      }
      // Let fades and slides finish before measuring.
      await page.waitForTimeout(700)
      const look = await page.evaluate(() => document.documentElement.dataset.theme || 'light')
      if (look !== theme)
        problems.push(`${theme} ${screen.path}: the ${theme} look did not switch on`)
      for (const line of await page.evaluate(faintText, FLOOR)) {
        problems.push(`${theme} ${screen.path}${screen.role ? ` (${screen.role})` : ''}: ${line}`)
      }
      await context.close()
    }
  }
  await browser.close()
  if (problems.length) {
    console.log(`CONTRAST AUDIT FAILED: ${problems.length} faint lines`)
    for (const problem of problems) console.log('  ' + problem)
    process.exit(1)
  }
  console.log(
    `Contrast audit passed: ${SCREENS.length} screens, light and dark: no text below ${FLOOR} to 1.`,
  )
})()
