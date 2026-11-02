---
name: screens
description: Screenshot a screen with made up data, run the thorough layout check at phone, tablet (portrait and landscape) and desktop widths, and press every button with the click-through check. Use after building or changing any screen, before saying it is done (CLAUDE.md section 5).
---

# screens

Nothing is done until it has been used and looked at. This skill does the
looking without a real database, so no patient data can reach a picture.

## Steps

1. **Build and serve the screens build** (fake Supabase address):
   ```
   scripts/screens/serve.sh
   ```
2. **Run the layout check on every screen:**
   ```
   node scripts/overflow-audit.cjs
   ```
   At 320, 360, 390, tablet portrait (820), tablet landscape (1180) and
   desktop (1440) it fails on: anything past the edge, text cut off, a
   heading on more than 2 lines, text on top of other text, a button under
   32 pixels high. When a new screen is built, add it to
   `scripts/screens/screens-list.cjs` first (with `extra` rows if it needs
   data to show). Since 2026-11-02, after the receipt's letterhead was
   squeezed at 320 and the old check could not see it.
2b. **Press every button with the click-through check:**
   ```
   node scripts/screens/clickthrough.cjs
   ```
   It presses each visible button on a fresh page. It fails if a button
   breaks the page. It lists buttons that changed nothing: read every one;
   only an option that was already chosen is fine.
2c. **Ask what is missing.** Anthony, 2026-11-02: "There are certain
   things that I might not remember to include... you should know that,
   oh, we'll probably need this thing... for easy flow. Without clutter."
   Walk the screen as the person who uses it: is there a way back, a next
   step, a way to undo a mistake, a confirmation that it saved? Add what is
   needed, nothing more.
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
