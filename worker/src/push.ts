/*
 * worker/src/push.ts: sends a Call attention notification to phones and
 * computers, even when the app is closed (Web Push).
 *
 * Why: Call attention step 2 (Anthony, 2026-10-29). The database decides
 * who is called and sends us their push addresses (migration
 * 20261029200000_push_devices.sql). This file turns that into one encrypted
 * message per device.
 *
 * How one message is sent, in order:
 *   1. Encrypt the words for that one device, with the two keys the device
 *      gave when alerts were turned on (RFC 8291, "aes128gcm"). Google and
 *      Apple carry the message but cannot read it.
 *   2. Sign a short token with our VAPID key (RFC 8292), which proves to
 *      the push service that the message comes from us.
 *   3. Post it to the device's push address.
 *
 * Sections:
 *   1. Small helpers for bytes and base64url
 *   2. Encrypting for one device
 *   3. The VAPID token
 *   4. Sending to every device
 *
 * Never: log a push address, a key or the words. Never send without the
 * shared secret having been checked (see index.ts).
 */

// ===== 1. Small helpers =====
// Plain bytes, held in an ordinary ArrayBuffer (what Web Crypto expects).
export type Bytes = Uint8Array<ArrayBuffer>

const encoder = new TextEncoder()
const text = (words: string): Bytes => new Uint8Array(encoder.encode(words))

export function fromBase64Url(encoded: string): Bytes {
  const base64 =
    encoded.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((encoded.length + 3) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function toBase64Url(bytes: Bytes): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function join(...parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

async function hmac(key: Bytes, data: Bytes): Promise<Bytes> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data))
}

// ===== 2. Encrypting for one device (RFC 8291) =====
export type Device = { endpoint: string; p256dh: string; auth: string }

export async function encryptFor(device: Device, words: string): Promise<Bytes> {
  const deviceKey = fromBase64Url(device.p256dh) // the device's public key, 65 bytes
  const authSecret = fromBase64Url(device.auth) // the device's 16 byte secret

  // A fresh key pair for this one message.
  const ours = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const ourPublic = new Uint8Array(
    (await crypto.subtle.exportKey('raw', ours.publicKey)) as ArrayBuffer,
  )
  const theirs = await crypto.subtle.importKey(
    'raw',
    deviceKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, ours.privateKey, 256),
  )

  // Mix the shared secret with the device's secret, then make the content
  // key and the nonce (HKDF with SHA-256, written out step by step).
  const keyInfo = join(text('WebPush: info\0'), deviceKey, ourPublic)
  const ikm = await hmac(await hmac(authSecret, shared), join(keyInfo, new Uint8Array([1])))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(salt, ikm)
  const contentKey = (
    await hmac(prk, join(text('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))
  ).slice(0, 16)
  const nonce = (
    await hmac(prk, join(text('Content-Encoding: nonce\0'), new Uint8Array([1])))
  ).slice(0, 12)

  // One record: the words, then the byte 2 that marks the last record.
  const aes = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aes,
      join(text(words), new Uint8Array([2])),
    ),
  )

  // The header: salt, record size (4096), our public key, then the record.
  const recordSize = new Uint8Array([0, 0, 0x10, 0])
  return join(salt, recordSize, new Uint8Array([ourPublic.length]), ourPublic, sealed)
}

// ===== 3. The VAPID token (RFC 8292) =====
export type VapidKeys = { publicKey: string; privateJwk: JsonWebKey; subject: string }

export async function vapidHeader(endpoint: string, keys: VapidKeys): Promise<string> {
  const audience = new URL(endpoint).origin
  const header = toBase64Url(text(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = toBase64Url(
    text(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: keys.subject,
      }),
    ),
  )
  const signingKey = await crypto.subtle.importKey(
    'jwk',
    keys.privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      text(`${header}.${claims}`),
    ),
  )
  return `vapid t=${header}.${claims}.${toBase64Url(signature)}, k=${keys.publicKey}`
}

// ===== 4. The tag and the screen a notification may carry =====
// A tag says which notification this one replaces. Short and plain only.
export function safeTag(tag: unknown): string | undefined {
  return typeof tag === 'string' && /^[a-z0-9-]{1,40}$/.test(tag) ? tag : undefined
}

// The screen a tap opens: a path inside this app only. "//somewhere" would
// leave the app for another website, so a second slash at the start fails.
export function safeAppPath(path: unknown): string | undefined {
  return typeof path === 'string' && /^\/(?!\/)[A-Za-z0-9/?=&_.-]{0,200}$/.test(path)
    ? path
    : undefined
}

// ===== 5. Sending to every device =====
export type PushResult = { sent: number; gone: number; failed: number }

export async function sendToAll(
  devices: Device[],
  // tag and url (Laboratory, 2026-10-30): which notification this replaces,
  // and which screen a tap opens. Both are optional.
  message: { title: string; body: string; call_id: number; tag?: string; url?: string },
  keys: VapidKeys,
  post: typeof fetch = fetch,
): Promise<PushResult> {
  const words = JSON.stringify(message)
  const result: PushResult = { sent: 0, gone: 0, failed: 0 }
  await Promise.all(
    devices.map(async (device) => {
      try {
        const response = await post(device.endpoint, {
          method: 'POST',
          headers: {
            Authorization: await vapidHeader(device.endpoint, keys),
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            // Keep trying for 2 minutes at most; an old call is no use.
            TTL: '120',
            Urgency: 'high',
          },
          body: await encryptFor(device, words),
        })
        if (response.ok) result.sent += 1
        // 404 or 410: the device turned alerts off or the browser was reset.
        else if (response.status === 404 || response.status === 410) result.gone += 1
        else result.failed += 1
      } catch {
        result.failed += 1
      }
    }),
  )
  return result
}
