---
name: screens
description: Screenshot a screen with made up data at a phone and a desktop width, click through its controls, and run the overflow check at 320, 360, 375 and 390. Use after building or changing any screen, before saying it is done (CLAUDE.md section 5).
---

# screens

Nothing is done until it has been used and looked at. This skill does the
looking without a real database, so no patient data can reach a picture.

## Steps

1. **Build and serve the screens build** (fake Supabase address):
   ```
   scripts/screens/serve.sh
   ```
2. **Run the overflow check on every screen:**
   ```
   node scripts/overflow-audit.cjs
   ```
   When a new screen is built, add it to `SCREENS` in that file first.
3. **Walk the new screen through.** Write a short script in the scratchpad
   that uses `scripts/screens/mock.cjs`:
   ```js
   const { chromium } = require('playwright')
   const { signIn, mockSupabase, overflow, shoot } = require('<repo>/scripts/screens/mock.cjs')
   const browser = await chromium.launch()
   const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
   await signIn(context, { role: 'nurse', roomId: 6, medical: true })
   const page = await context.newPage()
   const writes = await mockSupabase(page, { 'rest/v1/allergies': [/* made up rows */] })
   await page.goto('http://127.0.0.1:3100/patients/record/?p=1')
   // click every button, type a wrong value, cancel a form, refresh
   await shoot(page, '<scratchpad>/shots', 'record')
   console.log(writes)            // what each button sent
   console.log(await overflow(page, 'record'))
   ```
   Check `writes`: every control that should save must show a write.
4. **Look at the pictures** with the Read tool, phone and desktop. Judge
   them as somebody who was never told how the screen works.
5. Say what you checked: which controls, which widths, what the overflow
   check said.

## If the skill itself goes wrong

- Every screen "did not load": `npm run verify` (or any build) replaced the
  screens build. Run `scripts/screens/serve.sh` again.

- `serve.sh` stops at the build: read the build error, it is in the code.
- A screen "did not load" in the audit: the mock is missing rows that the
  screen waits for. Add them to `mockSupabase` (or to `extra` in your
  script), not a delay.
- If `mock.cjs` itself is wrong, fix it in the same change and say so.
