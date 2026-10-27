/*
 * worker/src/index.ts: the one Cloudflare Worker behind the RHEMA app.
 *
 * Why: the screens are plain files, so anything that needs a server runs
 * here. Cloudflare sends every /api/ address to this code first; every
 * other address is served straight from the built files in web/out.
 *
 * Never: put a secret in this file. Keys arrive in `env`, set with
 * `wrangler secret put` or from GitHub Actions. Never log patient details.
 */

// ===== 1. What the Worker is given by Cloudflare =====
export interface Env {
  // The built screens (web/out), served as static files.
  ASSETS: Fetcher
}

// ===== 2. Routes =====
export async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url)

  // Health check, used by the holding screen, the smoke test and the AWS
  // uptime watcher. It says only that the Worker is up, nothing more.
  if (url.pathname === '/api/health') {
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}

// ===== 3. Entry point =====
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request)
    }
    return env.ASSETS.fetch(request)
  },
}
