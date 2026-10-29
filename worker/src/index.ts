/*
 * worker/src/index.ts: the one Cloudflare Worker behind the RHEMA app.
 *
 * Why: the screens are plain files, so anything that needs a server runs
 * here. Cloudflare sends every /api/ address to this code first; every
 * other address is served straight from the built files in web/out.
 *
 * Never: put a secret in this file. Keys arrive in `env`, set with
 * `wrangler secret put` or from GitHub Actions. Never log patient details,
 * push addresses or keys.
 */
import { sendToAll, type Device } from './push'

// ===== 1. What the Worker is given by Cloudflare =====
export interface Env {
  // The built screens (web/out), served as static files.
  ASSETS: Fetcher
  // Call attention push (set by the push-keys workflow). Until they are
  // set, the push routes answer "not set up" and send nothing.
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_JWK?: string
  PUSH_SECRET?: string
}

// Who the push services can contact about our messages (RFC 8292).
const VAPID_SUBJECT = 'mailto:rhemamedical7@gmail.com'

// ===== 2. Checking the shared secret =====
// Compares two strings without leaking, through timing, how much matched:
// both are hashed first, then every byte is compared.
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const hash = async (text: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  const [a, b] = await Promise.all([hash(given), hash(expected)])
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i]
  return difference === 0
}

// ===== 3. Routes =====
export async function handleApi(request: Request, env: Partial<Env> = {}): Promise<Response> {
  const url = new URL(request.url)

  // Health check, used by the holding screen, the smoke test and the AWS
  // uptime watcher. It says only that the Worker is up, nothing more.
  if (url.pathname === '/api/health') {
    return Response.json({ ok: true })
  }

  // The public half of the VAPID key. Browsers need it to turn alerts on.
  // It is public by design; the private half never leaves the Worker.
  if (url.pathname === '/api/push/key' && request.method === 'GET') {
    if (!env.VAPID_PUBLIC_KEY)
      return Response.json({ error: 'Alerts are not set up yet' }, { status: 503 })
    return Response.json({ publicKey: env.VAPID_PUBLIC_KEY })
  }

  // The database asks us to send a Call attention push. Only the database
  // knows the shared secret (it lives in Vault).
  if (url.pathname === '/api/push/attention' && request.method === 'POST') {
    if (!env.PUSH_SECRET || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK) {
      return Response.json({ error: 'Alerts are not set up yet' }, { status: 503 })
    }
    if (!(await sameSecret(request.headers.get('X-Rhema-Push-Secret') ?? '', env.PUSH_SECRET))) {
      return Response.json({ error: 'Not allowed' }, { status: 401 })
    }
    let message: { call_id?: unknown; title?: unknown; body?: unknown; targets?: unknown }
    try {
      message = await request.json()
    } catch {
      return Response.json({ error: 'Bad request' }, { status: 400 })
    }
    const targets = Array.isArray(message.targets) ? (message.targets as Device[]) : []
    const good = targets.filter(
      (t) =>
        typeof t?.endpoint === 'string' &&
        t.endpoint.startsWith('https://') &&
        typeof t.p256dh === 'string' &&
        typeof t.auth === 'string',
    )
    if (
      !good.length ||
      good.length > 500 ||
      typeof message.body !== 'string' ||
      typeof message.call_id !== 'number'
    ) {
      return Response.json({ error: 'Bad request' }, { status: 400 })
    }
    const result = await sendToAll(
      good,
      {
        title: typeof message.title === 'string' ? message.title : 'Call attention',
        body: message.body,
        call_id: message.call_id,
      },
      {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK) as JsonWebKey,
        subject: VAPID_SUBJECT,
      },
    )
    // Counts only: never the addresses.
    console.log(
      `Call attention push for call ${message.call_id}: ${result.sent} sent, ${result.gone} gone, ${result.failed} failed`,
    )
    return Response.json(result)
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}

// ===== 4. Entry point =====
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env)
    }
    return env.ASSETS.fetch(request)
  },
}
