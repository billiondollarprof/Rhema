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
