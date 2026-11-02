---
name: clickthrough
description: Press every visible button on every screen, as made up staff with made up data, and report any button that breaks the page or does nothing. Use after building or changing any screen, with the screens skill, before saying it is done (CLAUDE.md section 5).
---

# clickthrough

Anthony, 2026-11-02: "A skill that clicks through buttons to ensure that
everything is working well." CLAUDE.md section 5: a control that writes
nothing never reports an error, so it looks exactly like one that works.

## Steps

1. **Build and serve the screens build** (fake Supabase address):
   ```
   scripts/screens/serve.sh
   ```
2. **Make sure the new screen is in the list:** `scripts/screens/screens-list.cjs`
   (its path, the text that shows it loaded, `medical`/`admin` if needed,
   and `extra` made up rows if it needs data).
3. **Press everything:**
   ```
   node scripts/screens/clickthrough.cjs
   ```
   Each visible button is pressed on a fresh page. A file window or the
   print window counts as doing something.
4. **Read the report.**
   - "broke the page": a real fault. Fix it, then run again.
   - "changed nothing": read every one. Only an option that was already
     chosen (the default Week, Female, Individual) is fine. Anything else
     is a dead button: fix it.
5. **Then walk the new flow by hand** in a short script (see the screens
   skill, step 3) to check what each button *sent*: pressing is not the
   same as saving the right thing.
6. Say what you checked: how many buttons, what it reported, what you
   fixed.

## If the skill itself goes wrong

- Every screen "did not load": a build replaced the screens build. Run
  `scripts/screens/serve.sh` again.
- A screen "did not load" on its own: its `waitFor` text never shows (a
  placeholder is not text it can see), or it needs `extra` rows.
- If the script is wrong, fix it in the same change and say so.
