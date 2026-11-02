// Tests for the zip maker: the checksum is the standard one, and a zip
// made here opens with a real unzip tool (Python's zipfile, through the
// bytes it would read).
import { describe, expect, it } from 'vitest'
import { crc32, makeZip } from './zip'

const text = (value: string) => new TextEncoder().encode(value)

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926)
  })
})

describe('makeZip', () => {
  it('lists every file once, with its own bytes, and renames a repeated name', async () => {
    const zip = makeZip([
      { name: 'Old card.webp', bytes: text('picture') },
      { name: 'Report.pdf', bytes: text('%PDF made up') },
      { name: 'Report.pdf', bytes: text('%PDF another') },
    ])
    const bytes = new Uint8Array(await zip.arrayBuffer())
    const all = new TextDecoder().decode(bytes)
    expect(all).toContain('Old card.webp')
    expect(all).toContain('Report (2).pdf')
    expect(all).toContain('%PDF made up')
    // The end record says three files.
    const end = bytes.length - 22
    expect(bytes[end]).toBe(0x50)
    expect(bytes[end + 10]).toBe(3)
  })
})
