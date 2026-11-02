/*
 * scripts/overflow-audit.cjs: the layout check for every screen, at phone
 * (320, 360, 390), tablet portrait, tablet landscape and desktop widths.
 *
 * Why: a screenshot cannot see content cut off the right edge, and a
 * quick look misses a squeezed heading. Since 2026-11-02 (Anthony: "I
 * don't know how you missed that receipt... improve the skill... to do
 * thorough job") it checks, at every width: anything spilling past the
 * edge, text cut off, headings on more than 2 lines, text on top of other
 * text, and buttons too small to tap (scripts/screens/mock.cjs, layout).
 * CLAUDE.md section 5.
 *
 * Usage:
 *   scripts/screens/serve.sh          (once, to build and serve)
 *   node scripts/overflow-audit.cjs   (exits 1 if anything spills)
 *
 * Add a screen to SCREENS when it is built.
 *
 * Never: point it at the live or testing site. It uses made up data.
 */
const { chromium } = require('playwright')
const { signIn, mockSupabase, layout } = require('./screens/mock.cjs')

const APP = process.env.APP_URL || 'http://127.0.0.1:3100'

// ===== 1. Every screen (scripts/screens/screens-list.cjs) =====
const { SCREENS } = require('./screens/screens-list.cjs')

// ===== 2. Walk them all =====
;(async () => {
  const browser = await chromium.launch()
  const problems = []
  for (const screen of SCREENS) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await signIn(context, {
      role: screen.medical ? 'nurse' : 'front_desk',
      medical: Boolean(screen.medical),
      admin: Boolean(screen.admin),
    })
    const page = await context.newPage()
    await mockSupabase(page, screen.extra ?? {})
    await page.goto(APP + screen.path)
    try {
      await page.getByText(screen.waitFor).first().waitFor({ timeout: 10000 })
    } catch {
      problems.push(`${screen.path}: did not load ("${screen.waitFor}" never showed)`)
      await context.close()
      continue
    }
    problems.push(...(await layout(page, screen.path)))
    await context.close()
  }
  await browser.close()
  if (problems.length) {
    console.log('LAYOUT AUDIT FAILED')
    for (const problem of problems) console.log('  ' + problem)
    process.exit(1)
  }
  console.log(
    `Layout audit passed: ${SCREENS.length} screens at phone, tablet and desktop widths: nothing spills, nothing is cut off, squeezed, on top of other text or too small to tap.`,
  )
})()
