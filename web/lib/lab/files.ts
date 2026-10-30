/*
 * lib/lab/files.ts: attaching a photo or PDF to a lab result, and opening
 * it again (request 115, slice 2).
 *
 * Why: Anthony, 2026-10-30: "Make sure that the attached files is usually
 * compressed without affecting the quality of the document. PDF for a few
 * pages is usually a few KBs."
 *
 * How:
 *   1. A photo is shrunk in the phone before it is sent: its longest side
 *      becomes 2000 pixels at most (still sharp enough to read every line
 *      of a printout), saved as WebP, or JPEG where the phone cannot make
 *      WebP. A printout photo of 3 to 5 MB becomes about 150 to 400 KB.
 *   2. A PDF is sent as it is. It is already small, and squeezing it again
 *      in a phone could blur it.
 *   3. The file goes to our Worker with the person's own sign in token. The
 *      Worker checks the Laboratory tick with the database before storing.
 *   4. Opening a file asks the Worker with the token too; the database
 *      decides whether this person may see it.
 *
 * Never: keep a file on the device after it is shown, or send a file
 * anywhere but our own Worker.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// ===== 1. Limits =====
export const MOST_BYTES = 10 * 1024 * 1024
const LONGEST_SIDE = 2000

export type ReadyFile = { blob: Blob; name: string; type: string; size: number }

// "340 KB", "1.2 MB".
export function sizeWords(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ===== 2. Getting a chosen file ready: shrink a photo, keep a PDF =====
// Answers the file to send, or the words to show when it cannot be used.
export async function prepareFile(file: File): Promise<ReadyFile | string> {
  if (file.type === 'application/pdf') {
    if (file.size > MOST_BYTES) return 'This PDF is bigger than 10 MB.'
    return { blob: file, name: file.name, type: file.type, size: file.size }
  }
  if (!file.type.startsWith('image/')) return 'Attach a photo or a PDF.'

  let picture: ImageBitmap
  try {
    picture = await createImageBitmap(file)
  } catch {
    return 'This photo could not be opened. Take it again, or attach a PDF.'
  }
  const scale = Math.min(1, LONGEST_SIDE / Math.max(picture.width, picture.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(picture.width * scale)
  canvas.height = Math.round(picture.height * scale)
  const draw = canvas.getContext('2d')
  if (!draw) return 'This photo could not be opened. Take it again, or attach a PDF.'
  // A white page under the photo, so a see-through image never turns black.
  draw.fillStyle = '#fff'
  draw.fillRect(0, 0, canvas.width, canvas.height)
  draw.drawImage(picture, 0, 0, canvas.width, canvas.height)
  picture.close()

  const shrink = (type: string, quality: number) =>
    new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality))
  // WebP where the phone can make it; some older iPhones fall back to PNG,
  // so check what came out and use JPEG instead.
  let blob = await shrink('image/webp', 0.82)
  if (!blob || blob.type !== 'image/webp') blob = await shrink('image/jpeg', 0.85)
  if (!blob) return 'This photo could not be prepared. Try again.'
  if (blob.size > MOST_BYTES)
    return 'This photo is still too big. Take it again a little further away.'

  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const name = file.name.replace(/\.[^.]+$/, '') + '.' + extension
  return { blob, name, type: blob.type, size: blob.size }
}

// ===== 3. Upload =====
async function tokenOf(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession()
  return data.session?.access_token ?? null
}

export async function uploadFile(
  client: SupabaseClient,
  file: ReadyFile,
): Promise<{ key: string } | string> {
  const token = await tokenOf(client)
  if (!token) return 'Please sign in again.'
  let response: Response
  try {
    response = await fetch('/api/files/lab', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
      body: file.blob,
    })
  } catch {
    return 'The file could not be sent. Check the internet and try again.'
  }
  if (!response.ok) {
    const answer = (await response.json().catch(() => ({}))) as { error?: string }
    return answer.error ?? 'The file could not be sent. Try again.'
  }
  const answer = (await response.json()) as { key: string }
  return { key: answer.key }
}

// ===== 4. Open an attached file in a new tab =====
// The window opens at once (inside the tap), then the file fills it, so a
// phone's pop-up blocker does not stop it.
export async function openFile(client: SupabaseClient, key: string): Promise<string | null> {
  const shown = window.open('', '_blank')
  const token = await tokenOf(client)
  if (!token) {
    shown?.close()
    return 'Please sign in again.'
  }
  try {
    const response = await fetch(`/api/files/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      shown?.close()
      return 'This file could not be opened.'
    }
    const address = URL.createObjectURL(await response.blob())
    if (shown) shown.location.href = address
    else window.location.href = address
    // Forget the copy after a minute; the open tab keeps what it shows.
    window.setTimeout(() => URL.revokeObjectURL(address), 60000)
    return null
  } catch {
    shown?.close()
    return 'This file could not be opened. Check the internet and try again.'
  }
}
