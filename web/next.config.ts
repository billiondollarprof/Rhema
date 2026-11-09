/*
 * next.config.ts: how Next.js builds the RHEMA app.
 *
 * Why: the app is built as plain static files (output: 'export'), so
 * Cloudflare can serve it free with no size limit on the server side. All
 * server work lives in the Worker in /worker, never in Next.js.
 *
 * Never: add a Next.js feature that needs a server (server actions, API
 * routes, server side rendering at request time). The build will fail, and
 * that failure is on purpose.
 */
import { writeFileSync } from 'node:fs'
import type { NextConfig } from 'next'

// Which build this is (request 157, 2026-11-08). The deploy builds from a
// commit, so its id is the build's id. The same id goes into the app and
// into /version.json; an open app that finds a different id there knows a
// newer version went live and reloads itself (AppFreshness), instead of
// keeping buttons whose screens no longer exist.
const BUILD_ID = process.env.GITHUB_SHA ?? 'local'
writeFileSync(
  new URL('./public/version.json', import.meta.url),
  JSON.stringify({ build: BUILD_ID }),
)

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  output: 'export',
  // Every page is a folder with its own index.html, so /patients/ works
  // when Cloudflare serves the files directly.
  trailingSlash: true,
  // There is no image server in a static build.
  images: { unoptimized: true },
}

export default nextConfig
