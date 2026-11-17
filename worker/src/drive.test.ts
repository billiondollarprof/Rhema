// drive.test.ts: Connect Google Drive (request 226b).
import { describe, expect, it } from 'vitest'
import { driveCallback, driveStart, sealKey } from './drive'

const env = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
}
const CODE = '11111111-2222-3333-4444-555555555555'

// A made up Google sign in answer, carrying an email.
const idToken = `x.${btoa(JSON.stringify({ email: 'hospital@example.com' }))}.y`

describe('driveStart', () => {
  it('sends the admin to Google, asking only for files it makes and the email', () => {
    const response = driveStart(new Request(`https://h.test/api/drive/start?code=${CODE}`), env)
    const to = new URL(response.headers.get('Location') ?? '')
    expect(to.host).toBe('accounts.google.com')
    expect(to.searchParams.get('scope')).toBe(
      'openid email https://www.googleapis.com/auth/drive.file',
    )
    expect(to.searchParams.get('redirect_uri')).toBe('https://h.test/api/drive/callback')
    expect(to.searchParams.get('state')).toBe(CODE)
    expect(to.searchParams.get('access_type')).toBe('offline')
  })
  it('refuses a code that is not ours, and says when Google is not set up', () => {
    const bad = driveStart(new Request('https://h.test/api/drive/start?code=nope'), env)
    expect(bad.headers.get('Location')).toContain('drive=expired')
    const none = driveStart(new Request(`https://h.test/api/drive/start?code=${CODE}`), {})
    expect(none.headers.get('Location')).toContain('drive=not-set-up')
  })
})

describe('driveCallback', () => {
  it('trades the answer and hands the scrambled key back to the admin page', async () => {
    const sent: string[] = []
    const post = (async (url: string) => {
      sent.push(url)
      return Response.json({ refresh_token: 'the-real-key', id_token: idToken })
    }) as unknown as typeof fetch
    const response = await driveCallback(
      new Request(`https://h.test/api/drive/callback?code=g-answer&state=${CODE}`),
      env,
      post,
    )
    // Only Google is called: the Worker never talks to the database here.
    expect(sent).toEqual(['https://oauth2.googleapis.com/token'])
    const where = response.headers.get('Location') ?? ''
    expect(where.startsWith('https://h.test/admin/?tab=data#drive-link=')).toBe(true)
    const part = where.split('#drive-link=')[1]
    expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
    const handed = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    expect(handed.code).toBe(CODE)
    expect(handed.email).toBe('hospital@example.com')
    // Never the key plain.
    expect(where).not.toContain('the-real-key')
    expect(atob(part.replace(/-/g, '+').replace(/_/g, '/'))).not.toContain('the-real-key')
    expect(handed.key.length).toBeGreaterThan(20)
  })
  it('says failed when the admin says no on Google, or Google refuses', async () => {
    const no = await driveCallback(
      new Request(`https://h.test/api/drive/callback?state=${CODE}`),
      env,
    )
    expect(no.headers.get('Location')).toContain('drive=failed')
    const refused = await driveCallback(
      new Request(`https://h.test/api/drive/callback?code=x&state=${CODE}`),
      env,
      (async () => new Response('no', { status: 400 })) as unknown as typeof fetch,
    )
    expect(refused.headers.get('Location')).toContain('drive=failed')
  })
})

describe('sealKey', () => {
  it('can be opened with the same secret, and comes out different each time', async () => {
    const one = await sealKey('the-real-key', 'client-secret')
    const two = await sealKey('the-real-key', 'client-secret')
    expect(one).not.toBe(two)
    const bytes = Uint8Array.from(atob(one), (c) => c.charCodeAt(0))
    const raw = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('rhema-drive-key:client-secret'),
    )
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt'])
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12),
    )
    expect(new TextDecoder().decode(plain)).toBe('the-real-key')
  })
})
