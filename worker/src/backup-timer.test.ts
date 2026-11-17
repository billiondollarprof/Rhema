// backup-timer.test.ts: the timer asks GitHub to start the backup, and only that.
import { describe, expect, it } from 'vitest'
import { startBackup } from './backup-timer'

describe('startBackup', () => {
  it('does nothing without the key', async () => {
    let called = false
    const answer = await startBackup({}, new Date('2026-11-17T03:17:00Z'), (async () => {
      called = true
      return new Response(null, { status: 204 })
    }) as typeof fetch)
    expect(called).toBe(false)
    expect(answer).toContain('not set')
  })

  it('starts the backup on main, night only at 01 UTC', async () => {
    const sent: { url: string; body: string; auth: string }[] = []
    const send = (async (url: string, init: RequestInit) => {
      sent.push({
        url,
        body: String(init.body),
        auth: (init.headers as Record<string, string>).Authorization,
      })
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch
    expect(
      await startBackup({ GITHUB_BACKUP_TOKEN: 'k' }, new Date('2026-11-17T01:17:00Z'), send),
    ).toContain('night')
    await startBackup({ GITHUB_BACKUP_TOKEN: 'k' }, new Date('2026-11-17T03:17:00Z'), send)
    expect(sent[0].url).toContain('/actions/workflows/backup.yml/dispatches')
    expect(JSON.parse(sent[0].body)).toEqual({ ref: 'main', inputs: { night: 'true' } })
    expect(JSON.parse(sent[1].body)).toEqual({ ref: 'main', inputs: { night: 'false' } })
    expect(sent[0].auth).toBe('Bearer k')
  })

  it('says so, without the key, when GitHub refuses', async () => {
    const answer = await startBackup(
      { GITHUB_BACKUP_TOKEN: 'secret-value' },
      new Date(),
      (async () => new Response('no', { status: 403 })) as typeof fetch,
    )
    expect(answer).toContain('403')
    expect(answer).not.toContain('secret-value')
  })
})
