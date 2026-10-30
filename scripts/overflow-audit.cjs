/*
 * scripts/overflow-audit.cjs: checks that nothing on any screen is wider
 * than a phone, at 320, 360, 375 and 390 pixels.
 *
 * Why: a screenshot cannot see content cut off the right edge. This
 * measures every element's real edges instead. CLAUDE.md section 5.
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
const { signIn, mockSupabase, overflow } = require('./screens/mock.cjs')

const APP = process.env.APP_URL || 'http://127.0.0.1:3100'

// ===== 1. Every screen, and the text that shows it has loaded =====
const SCREENS = [
  { path: '/', waitFor: 'Registered today' },
  { path: '/patients/', waitFor: 'Find patient' },
  { path: '/patients/?p=1', waitFor: 'Adaeze Okafor' },
  { path: '/patients/register/', waitFor: 'Register patient' },
  { path: '/patients/edit/?p=1', waitFor: 'Edit patient' },
  { path: '/patients/record/?p=1', waitFor: 'Current medications', medical: true },
  { path: '/install/', waitFor: 'Get RHEMA on every device' },
  { path: '/admin/', waitFor: 'Tap a name', admin: true },
  { path: '/admin/?tab=invite', waitFor: 'Invite a new staff member', admin: true },
  { path: '/admin/?tab=rooms', waitFor: 'Add a room', admin: true },
  { path: '/admin/?tab=activity', waitFor: 'activities today', admin: true },
]

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
    await mockSupabase(page)
    await page.goto(APP + screen.path)
    try {
      await page.getByText(screen.waitFor).first().waitFor({ timeout: 10000 })
    } catch {
      problems.push(`${screen.path}: did not load ("${screen.waitFor}" never showed)`)
      await context.close()
      continue
    }
    problems.push(...(await overflow(page, screen.path)))
    await context.close()
  }
  await browser.close()
  if (problems.length) {
    console.log('OVERFLOW AUDIT FAILED')
    for (const problem of problems) console.log('  ' + problem)
    process.exit(1)
  }
  console.log(`Overflow audit passed: ${SCREENS.length} screens, 4 phone widths, nothing spills.`)
})()
