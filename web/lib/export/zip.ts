/*
 * lib/export/zip.ts: put several files into one ZIP file, in the browser.
 *
 * Why: "Download our data" (request 217a, 2026-11-16) gives the admin one
 * file holding every spreadsheet and every uploaded file. Writing this small
 * maker here means nothing new is added to the app's packages.
 *
 * How: the files are stored as they are (no squeezing), which every computer
 * and phone can open. Each file gets its name, size and checksum (CRC-32) in
 * front of it, and a list of them all at the end, as the ZIP format asks.
 *
 * Never: change a file's bytes.
 */

// ===== 1. The checksum (CRC-32) every ZIP entry carries =====
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// ===== 2. Little numbers written byte by byte, as ZIP wants =====
function bytes16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff]
}
function bytes32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
}

// ===== 3. The ZIP itself =====
export function makeZip(files: { name: string; data: Uint8Array<ArrayBuffer> }[]): Blob {
  const parts: BlobPart[] = []
  const directory: number[][] = []
  let offset = 0
  for (const file of files) {
    const name = new TextEncoder().encode(file.name)
    const crc = crc32(file.data)
    const size = file.data.length
    // The header in front of each file: stored (0), UTF-8 names (flag 0x0800).
    const header = [
      ...bytes32(0x04034b50),
      ...bytes16(20),
      ...bytes16(0x0800),
      ...bytes16(0),
      ...bytes16(0),
      ...bytes16(0x21),
      ...bytes32(crc),
      ...bytes32(size),
      ...bytes32(size),
      ...bytes16(name.length),
      ...bytes16(0),
    ]
    parts.push(new Uint8Array(header), name, file.data)
    directory.push([
      ...bytes32(0x02014b50),
      ...bytes16(20),
      ...bytes16(20),
      ...bytes16(0x0800),
      ...bytes16(0),
      ...bytes16(0),
      ...bytes16(0x21),
      ...bytes32(crc),
      ...bytes32(size),
      ...bytes32(size),
      ...bytes16(name.length),
      ...bytes16(0),
      ...bytes16(0),
      ...bytes16(0),
      ...bytes16(0),
      ...bytes32(0),
      ...bytes32(offset),
      ...Array.from(name),
    ])
    offset += header.length + name.length + size
  }
  const listSize = directory.reduce((sum, entry) => sum + entry.length, 0)
  for (const entry of directory) parts.push(new Uint8Array(entry))
  parts.push(
    new Uint8Array([
      ...bytes32(0x06054b50),
      ...bytes16(0),
      ...bytes16(0),
      ...bytes16(files.length),
      ...bytes16(files.length),
      ...bytes32(listSize),
      ...bytes32(offset),
      ...bytes16(0),
    ]),
  )
  return new Blob(parts, { type: 'application/zip' })
}
