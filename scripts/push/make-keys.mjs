/*
 * scripts/push/make-keys.mjs: makes the keys for Call attention alerts.
 *
 * Why: run only by .github/workflows/push-keys.yml, which saves the keys
 * straight into Cloudflare and Vault. Nobody sees them, and they never
 * reach the chat or the code.
 *
 * It writes three files into the folder given (default: the current one):
 *   vapid-public.txt    the public VAPID key (safe to share; browsers get it)
 *   vapid-private.json  the private VAPID key (secret)
 *   push-secret.txt     the shared secret between the database and Worker
 *
 * Never: print a key. Never commit the files.
 */
import { webcrypto } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const folder = process.argv[2] ?? '.'
const base64Url = (bytes) => Buffer.from(bytes).toString('base64url')

// ===== 1. The VAPID key pair (P-256, the curve Web Push uses) =====
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const publicRaw = new Uint8Array(await webcrypto.subtle.exportKey('raw', pair.publicKey))
const privateJwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey)

// ===== 2. The shared secret: 32 random bytes =====
const secret = webcrypto.getRandomValues(new Uint8Array(32))

writeFileSync(join(folder, 'vapid-public.txt'), base64Url(publicRaw), { mode: 0o600 })
writeFileSync(join(folder, 'vapid-private.json'), JSON.stringify(privateJwk), { mode: 0o600 })
writeFileSync(join(folder, 'push-secret.txt'), base64Url(secret), { mode: 0o600 })
console.log('Keys made.')
