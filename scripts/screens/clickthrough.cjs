/*
 * scripts/screens/clickthrough.cjs: presses every button on every screen,
 * one at a time on a fresh page, and reports any button that breaks the
 * page or does nothing at all.
 *
 * Why: Anthony, 2026-11-02: "A skill that clicks through buttons to ensure
 * that everything is working well." CLAUDE.md section 5: "A control that
 * writes nothing never reports an error, so it looks exactly like one that
 * works."
 *
 * "Does nothing" means: after the press, nothing on the page changed, no
 * request went out, the address stayed the same, and no file or print
 * window was asked for. A person must look at
 * every one it reports: a few are fine (a button already chosen).
 *
 * Usage:
 *   scripts/screens/serve.sh               (once, to build and serve)
 *   node scripts/screens/clickthrough.cjs  (exits 1 if a button breaks a page)
 *
 * Never: point it at the live or testing site. It uses made up data.
 */
const { chromium } = require('playwright')
const { signIn, mockSupabase } = require('./mock.cjs')
const { SCREENS } = require('./screens-list.cjs')

const APP = process.env.APP_URL || 'http://127.0.0.1:3100'
// Buttons that leave the app or end the session: pressed by the sign in
// walkthrough instead.
const SKIP = /^(Sign out|Lock screen)$/

async function openScreen(browser, screen) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await signIn(context, {
    role: screen.medical ? 'nurse' : 'front_desk',
    medical: Boolean(screen.medical),
    admin: Boolean(screen.admin),
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 120)))
  let requests = 0
  page.on('request', (request) => {
    if (!request.url().includes('/_next/')) requests += 1
  })
  // Opening the file window or the print window counts as doing something.
  page.on('filechooser', () => {
    requests += 1
  })
  await page.addInitScript(() => {
    window.print = () => {
      window.__printed = (window.__printed || 0) + 1
    }
  })
  await mockSupabase(page, screen.extra ?? {})
  await page.goto(APP + screen.path)
  await page.getByText(screen.waitFor).first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(500)
  return { context, page, errors, requests: () => requests }
}

;(async () => {
  const browser = await chromium.launch()
  const broken = []
  const idle = []
  let pressed = 0
  for (const screen of SCREENS) {
    // ===== 1. The buttons on this screen =====
    const first = await openScreen(browser, screen).catch(() => null)
    if (!first) {
      broken.push(`${screen.path}: did not load`)
      continue
    }
    const names = await first.page.evaluate(() =>
      [...document.querySelectorAll('main button')]
        // Only buttons a person can see now: not inside a folded section.
        .filter(
          (b) =>
            !b.disabled &&
            b.getBoundingClientRect().width > 0 &&
            !b.closest('details:not([open]) > :not(summary)'),
        )
        // Every button keeps its place in the list, named or not.
        .map((b) => (b.innerText || b.getAttribute('aria-label') || '(no label)').trim()),
    )
    await first.context.close()

    // ===== 2. Press each one on a fresh page =====
    for (const [index, name] of names.entries()) {
      if (SKIP.test(name)) continue
      const { context, page, errors, requests } = await openScreen(browser, screen)
      const before = await page.evaluate(
        () => document.body.innerHTML + location.href + (window.__printed || 0),
      )
      const sent = requests()
      // The same button again, by its position among the buttons, so a
      // name inside another name ("Male" in "Female") cannot fool it.
      await page
        .locator('main button:not([disabled])')
        .filter({ visible: true })
        .nth(index)
        .click({ timeout: 3000 })
        .catch(() => {})
      await page.waitForTimeout(700)
      pressed += 1
      const after = await page.evaluate(
        () => document.body.innerHTML + location.href + (window.__printed || 0),
      )
      if (errors.length) broken.push(`${screen.path} "${name}": ${errors[0]}`)
      else if (after === before && requests() === sent)
        idle.push(`${screen.path} "${name}" (button ${index + 1})`)
      await context.close()
    }
  }
  await browser.close()

  // ===== 3. Report =====
  console.log(`Pressed ${pressed} buttons on ${SCREENS.length} screens.`)
  if (idle.length) {
    console.log('Look at these: pressing them changed nothing (an option already chosen is fine).')
    for (const line of idle) console.log('  ' + line)
  }
  if (broken.length) {
    console.log('CLICK-THROUGH FAILED: these broke the page.')
    for (const line of broken) console.log('  ' + line)
    process.exit(1)
  }
  console.log('No button broke a page.')
})()
