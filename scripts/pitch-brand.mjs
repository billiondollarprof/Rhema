/*
 * scripts/pitch-brand.mjs: puts a client's icons and app name into the
 * testing build, for showing the system to that client (request 150).
 *
 * Why: the names on the screens come from lib/brand/brand.ts, but the icons
 * and the installed app's name are files in web/public. This copies the
 * client's files from web/brands/<key>/ over them in the finished build
 * (web/out), after "npm run build". The files in web/public never change.
 *
 * Usage:  node scripts/pitch-brand.mjs <key>      (from the repo root)
 * "rhema" changes nothing: Rhema's own files are already in web/public.
 *
 * Never: run this for the live site. deploy.yml runs it only on testing.
 */
import { copyFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ===== 1. Which client =====
const key = process.argv[2]
if (!key) {
  console.error('Usage: node scripts/pitch-brand.mjs <key>')
  process.exit(1)
}
if (key === 'rhema') {
  console.log('Brand: Rhema, nothing to copy.')
  process.exit(0)
}

// ===== 2. Copy every file of that client over Rhema's =====
const from = join('web', 'brands', key)
if (!existsSync(from)) {
  console.error(
    `No files for "${key}" in ${from}. Run: node scripts/brand-icons.cjs ${key} <letters>`,
  )
  process.exit(1)
}
for (const name of readdirSync(from)) {
  copyFileSync(join(from, name), join('web', 'out', name))
  console.log(`Brand ${key}: ${name}`)
}
