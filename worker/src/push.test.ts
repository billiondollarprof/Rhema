// Tests for worker/src/push.ts and the push routes. Run with `npm run check:tests`.
// Each test plays the part of a phone: it makes the keys a browser would
// make, then checks it can open the message and trust the signature.
import { describe, expect, it } from 'vitest'
import { handleApi } from './index'
import { encryptFor, fromBase64Url, sendToAll, toBase64Url, vapidHeader, type Bytes } from './push'

const encoder = new TextEncoder()
const text = (words: string): Bytes => new Uint8Array(encoder.encode(words))

async function hmac(key: Bytes, data: Bytes) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}
const join = (...parts: Bytes[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

// A made up phone: its key pair and its 16 byte secret, as a browser makes them.
async function makePhone() {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const publicRaw = new Uint8Array(
    (await crypto.subtle.exportKey('raw', keys.publicKey)) as ArrayBuffer,
  )
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return {
    keys,
    publicRaw,
    auth,
    device: {
      endpoint: 'https://push.example/abc',
      p256dh: toBase64Url(publicRaw),
      auth: toBase64Url(auth),
    },
  }
}

// What the phone does with the message (RFC 8291, the receiving side).
async function phoneOpens(phone: Awaited<ReturnType<typeof makePhone>>, message: Bytes) {
  const salt = message.slice(0, 16)
  const idLength = message[20]
  const senderKey = message.slice(21, 21 + idLength)
  const sealed = message.slice(21 + idLength)
  const sender = await crypto.subtle.importKey(
    'raw',
    senderKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: sender }, phone.keys.privateKey, 256),
  )
  const info = join(text('WebPush: info\0'), phone.publicRaw, senderKey)
  const ikm = await hmac(await hmac(phone.auth, shared), join(info, new Uint8Array([1])))
  const prk = await hmac(salt, ikm)
  const cek = (
    await hmac(prk, join(text('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))
  ).slice(0, 16)
  const nonce = (
    await hmac(prk, join(text('Content-Encoding: nonce\0'), new Uint8Array([1])))
  ).slice(0, 12)
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, sealed),
  )
  expect(plain[plain.length - 1]).toBe(2)
  return new TextDecoder().decode(plain.slice(0, -1))
}

async function makeVapid() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const publicRaw = new Uint8Array(
    (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer,
  )
  const privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey
  return {
    pair,
    keys: { publicKey: toBase64Url(publicRaw), privateJwk, subject: 'mailto:test@example.com' },
  }
}

describe('encryptFor', () => {
  it('makes a message only that phone can open, with the words intact', async () => {
    const phone = await makePhone()
    const words = JSON.stringify({
      title: 'Call attention',
      body: 'Laboratory is calling Front Desk',
      call_id: 7,
    })
    const message = await encryptFor(phone.device, words)
    expect(await phoneOpens(phone, message)).toBe(words)
  })

  it('cannot be opened by another phone', async () => {
    const phone = await makePhone()
    const other = await makePhone()
    const message = await encryptFor(phone.device, 'hello')
    await expect(phoneOpens(other, message)).rejects.toThrow()
  })
})

describe('vapidHeader', () => {
  it('signs a token the push service can check with our public key', async () => {
    const { pair, keys } = await makeVapid()
    const header = await vapidHeader('https://fcm.googleapis.com/fcm/send/xyz', keys)
    const token = header.match(/^vapid t=([^,]+), k=(.+)$/)
    expect(token?.[2]).toBe(keys.publicKey)
    const [head, claims, signature] = token![1].split('.')
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      fromBase64Url(signature),
      text(`${head}.${claims}`),
    )
    expect(ok).toBe(true)
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(claims))).aud).toBe(
      'https://fcm.googleapis.com',
    )
  })
})

describe('sendToAll', () => {
  it('counts sent, gone and failed devices', async () => {
    const { keys } = await makeVapid()
    const phones = await Promise.all([makePhone(), makePhone(), makePhone()])
    const answers = [201, 410, 500]
    let i = 0
    const post = (async () =>
      new Response(null, { status: answers[i++] })) as unknown as typeof fetch
    const result = await sendToAll(
      phones.map((p) => p.device),
      { title: 't', body: 'b', call_id: 1 },
      keys,
      post,
    )
    expect(result).toEqual({ sent: 1, gone: 1, failed: 1 })
  })
})

describe('push routes', () => {
  const request = (secret: string, body: unknown) =>
    new Request('https://x/api/push/attention', {
      method: 'POST',
      headers: { 'X-Rhema-Push-Secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('says not set up, and sends nothing, before the keys exist', async () => {
    expect((await handleApi(request('anything', {}))).status).toBe(503)
    expect((await handleApi(new Request('https://x/api/push/key'))).status).toBe(503)
  })

  it('refuses a wrong secret', async () => {
    const { keys } = await makeVapid()
    const env = {
      PUSH_SECRET: 'right-secret',
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_JWK: JSON.stringify(keys.privateJwk),
    }
    expect(
      (await handleApi(request('wrong-secret', { call_id: 1, body: 'x', targets: [] }), env))
        .status,
    ).toBe(401)
    expect((await handleApi(request('', { call_id: 1, body: 'x', targets: [] }), env)).status).toBe(
      401,
    )
  })

  it('refuses a request with no good devices', async () => {
    const { keys } = await makeVapid()
    const env = {
      PUSH_SECRET: 's',
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_JWK: JSON.stringify(keys.privateJwk),
    }
    const bad = {
      call_id: 1,
      body: 'x',
      targets: [{ endpoint: 'http://not-https', p256dh: 'a', auth: 'b' }],
    }
    expect((await handleApi(request('s', bad), env)).status).toBe(400)
  })

  it('hands out the public key only', async () => {
    const response = await handleApi(new Request('https://x/api/push/key'), {
      VAPID_PUBLIC_KEY: 'public-part',
    })
    expect(await response.json()).toEqual({ publicKey: 'public-part' })
  })
})
