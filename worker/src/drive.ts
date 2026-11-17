/*
 * worker/src/drive.ts: "Connect Google Drive", the trip to Google and back.
 *
 * Why: Anthony, 2026-11-17 (request 226b): a monthly text backup into the
 * hospital's own Google Drive, through one Google app made once under
 * StellaXafe, so a new hospital only taps Connect and Allow.
 *
 * How:
 *   1. /api/drive/start?code=... : the admin's browser is sent to Google's
 *      page, asking only to "see and edit the files this app creates" and
 *      the account's email address.
 *   2. Google sends the browser back to /api/drive/callback with an answer.
 *      The Worker trades it for a long lived key, scrambles that key
 *      (AES-GCM, with a key made from the Google app's secret, which only
 *      the Worker and the monthly job hold).
 *   3. The admin lands back on Admin, Data, with the scrambled key and the
 *      one time code after a "#" in the address (the part a browser never
 *      sends to any server). The admin's own page hands them to the
 *      database (finish_drive_link), as the signed in admin, takes them off
 *      the address, and says Connected. So the Worker needs no key to the
 *      database, and nobody signed out can reach finish_drive_link.
 *
 * Never: keep, log or show the Google key plain; ask Google for more than
 * the files this app makes and the email address.
 */

export interface DriveEnv {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

const SCOPE = 'openid email https://www.googleapis.com/auth/drive.file'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Back to Admin, Data, saying how it went.
function backToAdmin(origin: string, how: 'connected' | 'failed' | 'expired' | 'not-set-up') {
  return Response.redirect(`${origin}/admin/?tab=data&drive=${how}`, 302)
}

// ===== 1. Scramble the key (the monthly job unscrambles it the same way) =====
// The secret key is SHA-256 of "rhema-drive-key:" and the Google app's
// secret. Out comes base64 of the 12 byte start value and the sealed key.
export async function sealKey(plain: string, clientSecret: string): Promise<string> {
  const raw = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`rhema-drive-key:${clientSecret}`),
  )
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)),
  )
  const all = new Uint8Array(iv.length + sealed.length)
  all.set(iv)
  all.set(sealed, iv.length)
  let text = ''
  for (const byte of all) text += String.fromCharCode(byte)
  return btoa(text)
}

// ===== 2. Off to Google =====
export function driveStart(request: Request, env: DriveEnv): Response {
  const url = new URL(request.url)
  const code = url.searchParams.get('code') ?? ''
  if (!env.GOOGLE_CLIENT_ID) return backToAdmin(url.origin, 'not-set-up')
  if (!UUID.test(code)) return backToAdmin(url.origin, 'expired')
  const google = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  google.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  google.searchParams.set('redirect_uri', `${url.origin}/api/drive/callback`)
  google.searchParams.set('response_type', 'code')
  google.searchParams.set('scope', SCOPE)
  // A key that keeps working month after month, asked for every time.
  google.searchParams.set('access_type', 'offline')
  google.searchParams.set('prompt', 'consent')
  google.searchParams.set('state', code)
  return Response.redirect(google.toString(), 302)
}

// ===== 3. Back from Google =====
export async function driveCallback(
  request: Request,
  env: DriveEnv,
  post: typeof fetch = fetch,
): Promise<Response> {
  const url = new URL(request.url)
  const answer = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
    return backToAdmin(url.origin, 'not-set-up')
  // The admin said no on Google's page, or the code is not ours.
  if (!answer || !UUID.test(state)) return backToAdmin(url.origin, 'failed')

  // Trade Google's answer for the long lived key.
  const traded = await post('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: answer,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/drive/callback`,
      grant_type: 'authorization_code',
    }).toString(),
  })
  if (!traded.ok) return backToAdmin(url.origin, 'failed')
  const tokens = (await traded.json()) as { refresh_token?: string; id_token?: string }
  if (!tokens.refresh_token) return backToAdmin(url.origin, 'failed')

  // The account's email, from the sign in answer Google just gave us.
  let email: string | null = null
  try {
    const part = (tokens.id_token ?? '').split('.')[1] ?? ''
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { email?: string }
    email = json.email ?? null
  } catch {
    email = null
  }

  const sealed = await sealKey(tokens.refresh_token, env.GOOGLE_CLIENT_SECRET)
  // Back to the admin's page, which finishes the link (step 3 above).
  // base64url: plain letters only, so nothing in it breaks the address.
  const handover = btoa(JSON.stringify({ code: state, key: sealed, email }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return Response.redirect(`${url.origin}/admin/?tab=data#drive-link=${handover}`, 302)
}
