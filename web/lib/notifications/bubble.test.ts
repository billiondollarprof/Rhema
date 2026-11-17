// bubble.test.ts: seen things leave the bubble, work never does (request 222).
import { describe, expect, it } from 'vitest'
import { bubbleOf } from './seen'
import type { Notice } from './notifications'

const item = (key: string) => ({
  key,
  title: '',
  detail: null,
  time: '',
  action: { label: '', href: '' },
})

describe('bubbleOf', () => {
  const notices: Notice[] = [
    {
      key: 'announcements',
      info: true,
      count: 2,
      words: '',
      items: [item('announcement-1'), item('announcement-2')],
    },
    { key: 'results', info: true, count: 1, words: '', items: [item('lab-9')] },
    {
      key: 'room-queue',
      count: 3,
      words: '',
      items: [item('queue-1'), item('queue-2'), item('queue-3')],
    },
    { key: 'pay-tests', count: 1, words: '', items: [item('lab-9')] },
  ]
  it('counts everything before anything is seen', () => {
    expect(bubbleOf(notices, new Set())).toBe(7)
  })
  it('drops what was seen, but never work waiting, even with the same key', () => {
    expect(bubbleOf(notices, new Set(['announcement-1', 'lab-9', 'queue-1']))).toBe(5)
  })
})
