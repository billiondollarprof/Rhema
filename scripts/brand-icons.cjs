/*
 * scripts/brand-icons.cjs: makes a client's app icons and round mark,
 * their letters in a navy ring on white ("MA" for MASCAP).
 *
 * Why: request 150 (2026-11-04). To show the system to a new client, the
 * testing site carries the client's name and letters instead of Rhema's.
 * The icons a phone shows once the app is installed are pictures, so they
 * are drawn here once and kept in web/brands/<key>/.
 *
 * Usage:  node scripts/brand-icons.cjs <key> <letters>
 *         node scripts/brand-icons.cjs mascap MA
 *
 * Never: write into web/public. scripts/pitch-brand.mjs copies the icons
 * there during the testing build only.
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

// ===== 1. What to draw =====
const [key, letters] = process.argv.slice(2)
if (!key || !letters) {
  console.error('Usage: node scripts/brand-icons.cjs <key> <letters>')
  process.exit(1)
}
const out = path.join(__dirname, '..', 'web', 'brands', key)
fs.mkdirSync(out, { recursive: true })

// The letters in a navy ring; a maskable icon has a white square behind it.
const html = (size, ring, square) => `<html><body style="margin:0;width:${size}px;height:${size}px;
display:grid;place-items:center;background:${square ? '#ffffff' : 'transparent'}">
<div style="width:${ring}px;height:${ring}px;border-radius:50%;background:#fff;
box-shadow:inset 0 0 0 ${Math.round(ring / 14)}px #0a2a5e;display:grid;place-items:center;
font-family:Arial,Helvetica,sans-serif;font-weight:800;color:#0a2a5e;
font-size:${Math.round(ring * 0.4)}px;letter-spacing:0.02em">${letters}</div></body></html>`

// ===== 2. Each picture: name, size, ring size, white square behind =====
const pictures = [
  ['icon-192.png', 192, 184, false],
  ['icon-512.png', 512, 492, false],
  ['icon-maskable-512.png', 512, 400, true],
  ['apple-touch-icon.png', 180, 180, true],
  ['logo.png', 320, 320, false],
]

;(async () => {
  const browser = await chromium.launch()
  for (const [name, size, ring, square] of pictures) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(html(size, ring, square))
    await page.screenshot({ path: path.join(out, name), omitBackground: !square })
    await page.close()
  }
  await browser.close()
  // ===== 3. The round mark the app shows is a WebP, like Rhema's =====
  execFileSync('python3', [
    '-c',
    `from PIL import Image; Image.open('${out}/logo.png').convert('RGBA').save('${out}/logo.webp', 'WEBP', quality=92)`,
  ])
  fs.unlinkSync(path.join(out, 'logo.png'))
  console.log(`Icons made in web/brands/${key}/`)
})()
