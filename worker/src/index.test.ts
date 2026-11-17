// Tests for the Worker routes. Run with `npm run check:tests`.
import { describe, expect, it } from 'vitest'
import { handleApi } from './index'

describe('handleApi', () => {
  it('answers the health check', async () => {
    const response = await handleApi(new Request('https://x/api/health'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('returns 404 for an unknown address', async () => {
    const response = await handleApi(new Request('https://x/api/nothing'))
    expect(response.status).toBe(404)
  })
})

// Request 225: the time devices set their clock against.
describe('the time', () => {
  it('answers the server time, never cached', async () => {
    const before = Date.now()
    const response = await handleApi(new Request('https://x.test/api/time'))
    const body = (await response.json()) as { now: number }
    expect(body.now).toBeGreaterThanOrEqual(before)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
