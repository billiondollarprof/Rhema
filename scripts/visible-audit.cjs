/*
 * scripts/visible-audit.cjs: every button and section that a screen must
 * show, checked to be there and visible to the person using it.
 *
 * Why: Anthony, 2026-11-18 (request 227): "there have been times you
 * created a button or section, but it was hidden from the public eye. You
 * could not see it, but you have made it. So check that each button
 * created, each section created can be seen."
 *
 * How:
 *   1. A screen in screens/screens-list.cjs lists, in mustSee, the words of
 *      each button or heading it must show. press names a button to tap,
 *      or a folded record section to open, first (for example Antenatal).
 *   2. Each screen opens at a phone width and a desktop width, as the right
 *      person. For each word: found on the page, not hidden, not of zero
 *      size, not see-through, and reachable by scrolling (not cut off
 *      outside the page). A word found only in the code proves nothing.
 *   3. Any missing: the list, and a failed run.
 *
 * Never: pass a screen that did not load. When a new button or section is
 * built, its words go in mustSee in the same change.
 */
const { chromium } = require('playwright')
const { signIn, mockSupabase } = require('./screens/mock.cjs')
const { SCREENS } = require('./screens/screens-list.cjs')

const APP = process.env.APP_URL || 'http://127.0.0.1:3100'
const SIZES = [
  [390, 844],
  [1280, 900],
]

// ===== 1. Measured inside the page: can a person see these words? =====
function seen(words) {
  const all = [...document.querySelectorAll('body *')]
  const match = all.filter(
    (el) =>
      el.children.length === 0 || ['BUTTON', 'A', 'H1', 'H2', 'H3', 'LABEL'].includes(el.tagName),
  )
  for (const el of match) {
    // The words alone, or with a small mark or a count beside them
    // ("‹ Back to the app", "Drugs to pay for 2").
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
    const fits =
      text === words ||
      text === words + ':' ||
      text.startsWith(words + ' ') ||
      text.endsWith(' ' + words)
    if (!fits) continue
    const box = el.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) continue
    let hidden = false
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity) < 0.1
      ) {
        hidden = true
        break
      }
    }
    if (hidden) continue
    // Inside the page sideways, so scrolling down reaches it.
    if (box.right < 0 || box.left > document.documentElement.clientWidth) continue
    return true
  }
  return false
}

// ===== 2. Walk the screens that list what they must show =====
;(async () => {
  const browser = await chromium.launch()
  const problems = []
  let checked = 0
  for (const screen of SCREENS.filter((one) => one.mustSee)) {
    for (const [width, height] of SIZES) {
      const context = await browser.newContext({ viewport: { width, height } })
      await signIn(context, {
        role: screen.role ?? (screen.medical ? 'nurse' : 'front_desk'),
        medical: Boolean(screen.medical),
        admin: Boolean(screen.admin),
        ...(screen.roomId ? { roomId: screen.roomId } : {}),
      })
      const page = await context.newPage()
      await mockSupabase(page, screen.extra ?? {})
      await page.goto(APP + screen.path)
      const where = `${screen.path}${screen.role ? ` (${screen.role})` : ''} at ${width}`
      try {
        await page.getByText(screen.waitFor).first().waitFor({ timeout: 10000 })
        if (screen.press) {
          // A button by its words, or else a folded record section by its
          // heading (request 228a: what is inside a section must be seen too).
          const button = page.getByRole('button', { name: screen.press, exact: true }).first()
          if (await button.count()) await button.click()
          else await page.locator('summary', { hasText: screen.press }).first().click()
        }
        await page.waitForTimeout(1200)
      } catch {
        problems.push(`${where}: did not load ("${screen.waitFor}" never showed)`)
        await context.close()
        continue
      }
      for (const words of screen.mustSee) {
        checked += 1
        if (!(await page.evaluate(seen, words))) problems.push(`${where}: cannot see "${words}"`)
      }
      await context.close()
    }
  }
  await browser.close()
  if (problems.length) {
    console.log('VISIBLE AUDIT FAILED')
    for (const problem of problems) console.log('  ' + problem)
    process.exit(1)
  }
  console.log(
    `Visible audit passed: ${checked} buttons and sections seen, at a phone and a desktop width.`,
  )
})()
