/*
 * lib/files/zip.ts: put several files into one .zip, in the browser.
 *
 * Why: Anthony, 2026-11-02: choose the attachments, or "select all", and
 * "download everything once as a zip folder". Scans (WebP, JPEG) and PDFs
 * are already squeezed, so they go in as they are (the zip "stored"
 * method): nothing is gained by squeezing again, and the code stays short
 * enough to read in one go, with no outside library.
 *
 * The zip layout, in order: for each file a local header then its bytes;
 * then a central list of every file; then an end record pointing at it.
 * All numbers are little endian (lowest byte first), as the zip format says.
 *
 * Never: change a file's bytes. Each one comes out exactly as it went in.
 */

// ===== 1. CRC32: the checksum every zip entry carries =====
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// ===== 2. Small helpers for writing numbers =====
function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff]
}
function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
}

// Two files with the same name would hide each other: add (2), (3).
function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    if (count === 1) return name
    const dot = name.lastIndexOf('.')
    return dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`
  })
}

// ===== 3. Build the zip =====
export function makeZip(files: { name: string; bytes: Uint8Array }[]): Blob {
  const encoder = new TextEncoder()
  const names = uniqueNames(files.map((file) => file.name))
  const parts: Uint8Array[] = []
  const central: number[] = []
  let offset = 0

  files.forEach((file, at) => {
    const name = encoder.encode(names[at])
    const crc = crc32(file.bytes)
    const size = file.bytes.length
    // Version 20, flag 0x0800 (the name is UTF-8), method 0 (stored), no date.
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21)]
    const sizes = [...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)]

    const local = new Uint8Array([...u32(0x04034b50), ...common, ...sizes])
    parts.push(local, name, file.bytes)

    central.push(...u32(0x02014b50), ...u16(20), ...common, ...sizes)
    // No comment, disk 0, no attributes, then where this file's header starts.
    central.push(...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name)

    offset += local.length + name.length + size
  })

  const centralBytes = new Uint8Array(central)
  const end = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centralBytes.length),
    ...u32(offset),
    ...u16(0),
  ])
  return new Blob([...parts, centralBytes, end] as BlobPart[], { type: 'application/zip' })
}
