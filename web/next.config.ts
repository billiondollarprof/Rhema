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
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  // Every page is a folder with its own index.html, so /patients/ works
  // when Cloudflare serves the files directly.
  trailingSlash: true,
  // There is no image server in a static build.
  images: { unoptimized: true },
}

export default nextConfig
