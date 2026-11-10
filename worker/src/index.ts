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
import {
  deleteRecordFile,
  downloadFile,
  uploadLabFile,
  uploadRecordFile,
  type FilesEnv,
} from './files'
import { emailInvite, type InvitesEnv } from './invites'
import { emailReceipt, type ReceiptsEnv } from './receipts'
import { emailRecord, type RecordsEnv } from './records'
import { sendToAll, type Device, safeAppPath, safeTag } from './push'

// ===== 1. What the Worker is given by Cloudflare =====
export interface Env extends FilesEnv, InvitesEnv, ReceiptsEnv, RecordsEnv {
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
    let message: {
      call_id?: unknown
      title?: unknown
      body?: unknown
      tag?: unknown
      url?: unknown
      targets?: unknown
    }
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
        // A lab result (2026-10-30) brings its own tag and the screen to open.
        // Only short plain tags and paths inside this app pass.
        tag: safeTag(message.tag),
        url: safeAppPath(message.url),
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

  // Lab result files (request 115, slice 2): see files.ts.
  if (url.pathname === '/api/files/lab' && request.method === 'POST') {
    return uploadLabFile(request, env)
  }
  // Files on the record itself (request 128): scans, photos and PDFs.
  if (url.pathname === '/api/files/record' && request.method === 'POST') {
    return uploadRecordFile(request, env)
  }
  if (
    (url.pathname.startsWith('/api/files/lab/') || url.pathname.startsWith('/api/files/record/')) &&
    request.method === 'GET'
  ) {
    return downloadFile(request, url.pathname.slice('/api/files/'.length), env)
  }
  if (url.pathname.startsWith('/api/files/record/') && request.method === 'DELETE') {
    return deleteRecordFile(request, url.pathname.slice('/api/files/'.length), env)
  }

  // Receipt emails (request 159, 2026-11-09): see receipts.ts.
  if (url.pathname === '/api/receipts/email' && request.method === 'POST') {
    return emailReceipt(request, env)
  }

  // A medical record to the patient's own email (2026-11-10): see records.ts.
  if (url.pathname === '/api/records/email' && request.method === 'POST') {
    return emailRecord(request, env)
  }

  // Invitation emails (2026-11-07): see invites.ts.
  if (url.pathname === '/api/invites/email' && request.method === 'POST') {
    return emailInvite(request, env)
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}

// ===== 4. Entry point =====
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    // A private hospital tool: nothing it answers may be indexed
    // (request 136). The screens get the same header from web/public/_headers.
    const response = url.pathname.startsWith('/api/')
      ? await handleApi(request, env)
      : await env.ASSETS.fetch(request)
    const answered = new Response(response.body, response)
    answered.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet')
    // The /api answers get the same basic protections as the screens
    // (request 155): never treated as another type, never shown in a frame.
    answered.headers.set('X-Content-Type-Options', 'nosniff')
    answered.headers.set('X-Frame-Options', 'DENY')
    return answered
  },
}
