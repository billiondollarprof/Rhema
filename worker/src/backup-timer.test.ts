// backup-timer.test.ts: the timer asks GitHub to start the backup, and only that.
import { describe, expect, it } from 'vitest'
import { driveMonthFor, startBackup, startDriveBackup } from './backup-timer'

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

describe('the monthly Drive backup (226b)', () => {
  it('starts on the last day of the month at 22:17 Nigeria time, for that month', () => {
    expect(driveMonthFor(new Date('2026-11-30T21:17:00Z'))).toBe('2026-11')
    expect(driveMonthFor(new Date('2026-12-31T21:17:00Z'))).toBe('2026-12')
    expect(driveMonthFor(new Date('2027-02-28T21:17:00Z'))).toBe('2027-02')
  })
  it('tries the past month again on the first 2 days, and is quiet otherwise', () => {
    expect(driveMonthFor(new Date('2026-12-01T21:17:00Z'))).toBe('2026-11')
    expect(driveMonthFor(new Date('2027-01-02T21:17:00Z'))).toBe('2026-12')
    expect(driveMonthFor(new Date('2026-12-03T21:17:00Z'))).toBeNull()
    expect(driveMonthFor(new Date('2026-11-29T21:17:00Z'))).toBeNull()
    expect(driveMonthFor(new Date('2026-11-30T19:17:00Z'))).toBeNull()
  })
  it('starts drive-backup.yml with the month', async () => {
    const sent: { url: string; body: string }[] = []
    const send = (async (url: string, init: RequestInit) => {
      sent.push({ url, body: String(init.body) })
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch
    const words = await startDriveBackup(
      { GITHUB_BACKUP_TOKEN: 'k' },
      new Date('2026-11-30T21:17:00Z'),
      send,
    )
    expect(words).toContain('2026-11')
    expect(sent[0].url).toContain('/workflows/drive-backup.yml/dispatches')
    expect(JSON.parse(sent[0].body)).toEqual({ ref: 'main', inputs: { month: '2026-11' } })
  })
})
