// Tests for the lab result files (request 115, slice 2). Run with
// `npm run check:tests`. Supabase and R2 are stand-ins, so nothing real is
// touched.
import { describe, expect, it } from 'vitest'
import {
  downloadFile,
  deleteRecordFile,
  downloadLabFile,
  kindOf,
  realType,
  uploadLabFile,
  uploadRecordFile,
  type FilesEnv,
} from './files'

// ===== 1. Stand-ins =====
const PERSON = '00000000-0000-0000-0000-0000000000c4'
const base64Url = (text: string) =>
  btoa(text).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const TOKEN = `${base64Url('{"alg":"HS256"}')}.${base64Url(JSON.stringify({ sub: PERSON }))}.signature-not-real`

function fakeBucket() {
  const stored = new Map<string, Uint8Array>()
  const bucket = {
    put: async (key: string, bytes: Uint8Array) => {
      stored.set(key, bytes)
      return null
    },
    get: async (key: string) => (stored.has(key) ? { body: stored.get(key) } : null),
  }
  return { bucket: bucket as unknown as R2Bucket, stored }
}

// Supabase answers with these rows to whatever we ask.
const supabase = (rows: unknown[] | null) =>
  (async () =>
    rows === null
      ? new Response('{}', { status: 401 })
      : Response.json(rows)) as unknown as typeof fetch

const PDF = new TextEncoder().encode('%PDF-1.7 made up')
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const TEXT = new TextEncoder().encode('<script>not a file</script>')

function upload(bytes: Uint8Array, token: string | null = TOKEN) {
  return new Request('https://x/api/files/lab', {
    method: 'POST',
    body: new Blob([bytes as BlobPart]),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

function env(bucket: R2Bucket): FilesEnv {
  return { FILES: bucket, SUPABASE_URL: 'https://db.invalid', SUPABASE_KEY: 'public-key' }
}

// ===== 2. What a file really is =====
describe('realType', () => {
  it('knows PDF, JPEG and WebP by their first bytes', () => {
    expect(realType(PDF)).toBe('application/pdf')
    expect(realType(JPEG)).toBe('image/jpeg')
    expect(realType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
  })
  it('refuses anything else, whatever it is called', () => {
    expect(realType(TEXT)).toBeNull()
    expect(realType(new Uint8Array([]))).toBeNull()
  })
})

// ===== 3. Upload =====
describe('uploadLabFile', () => {
  it('refuses somebody not signed in', async () => {
    const { bucket } = fakeBucket()
    const response = await uploadLabFile(
      upload(PDF, null),
      env(bucket),
      supabase([{ can_lab: true }]),
    )
    expect(response.status).toBe(401)
  })
  it('refuses somebody without the Laboratory tick', async () => {
    const { bucket, stored } = fakeBucket()
    const response = await uploadLabFile(upload(PDF), env(bucket), supabase([{ can_lab: false }]))
    expect(response.status).toBe(403)
    expect(stored.size).toBe(0)
  })
  it('refuses a token Supabase does not accept', async () => {
    const { bucket, stored } = fakeBucket()
    const response = await uploadLabFile(upload(PDF), env(bucket), supabase(null))
    expect(response.status).toBe(403)
    expect(stored.size).toBe(0)
  })
  it('refuses a file that is not really a photo or a PDF', async () => {
    const { bucket, stored } = fakeBucket()
    const response = await uploadLabFile(upload(TEXT), env(bucket), supabase([{ can_lab: true }]))
    expect(response.status).toBe(415)
    expect(stored.size).toBe(0)
  })
  it('stores a real PDF under a random name for the lab', async () => {
    const { bucket, stored } = fakeBucket()
    const response = await uploadLabFile(upload(PDF), env(bucket), supabase([{ can_lab: true }]))
    expect(response.status).toBe(200)
    const answer = (await response.json()) as { key: string; type: string; size: number }
    expect(answer.key).toMatch(/^lab\/[0-9a-f-]{36}\.pdf$/)
    expect(answer.type).toBe('application/pdf')
    expect(stored.has(answer.key)).toBe(true)
  })
  it('says not set up when the bucket is missing', async () => {
    const response = await uploadLabFile(upload(PDF), {}, supabase([{ can_lab: true }]))
    expect(response.status).toBe(503)
  })
})

// ===== 4. Download =====
describe('downloadLabFile', () => {
  const KEY = 'lab/12345678-1234-1234-1234-123456789abc.pdf'
  const get = (token: string | null = TOKEN) =>
    new Request(`https://x/api/files/${KEY}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

  it('serves the file only when the database lets this person read its result', async () => {
    const { bucket, stored } = fakeBucket()
    stored.set(KEY, PDF)
    const allowed = await downloadLabFile(get(), KEY, env(bucket), supabase([{ id: 1 }]))
    expect(allowed.status).toBe(200)
    expect(allowed.headers.get('Content-Type')).toBe('application/pdf')
    expect(allowed.headers.get('Cache-Control')).toBe('private, no-store')
    const refused = await downloadLabFile(get(), KEY, env(bucket), supabase([]))
    expect(refused.status).toBe(404)
  })
  it('refuses somebody not signed in', async () => {
    const { bucket, stored } = fakeBucket()
    stored.set(KEY, PDF)
    const response = await downloadLabFile(get(null), KEY, env(bucket), supabase([{ id: 1 }]))
    expect(response.status).toBe(401)
  })
  it('refuses a name that is not one of ours, even if a file sits there', async () => {
    const { bucket, stored } = fakeBucket()
    stored.set('lab/../../secret.txt', TEXT)
    const response = await downloadLabFile(
      get(),
      'lab/../../secret.txt',
      env(bucket),
      supabase([{ id: 1 }]),
    )
    expect(response.status).toBe(404)
  })
})

// ===== 5. Files on the record itself (request 128) =====
// A stand-in for a database function: answers `value`, notes the address.
const askingAnswer = (value: unknown) => {
  const asked: string[] = []
  const post = (async (url: string) => {
    asked.push(url)
    return Response.json(value)
  }) as unknown as typeof fetch
  return { post, asked }
}

describe('record files', () => {
  it('lets somebody who may register patients store a scan', async () => {
    const { bucket, stored } = fakeBucket()
    const response = await uploadRecordFile(
      upload(JPEG),
      env(bucket),
      supabase([{ can_patients: true, can_medical: false }]),
    )
    expect(response.status).toBe(200)
    const answer = (await response.json()) as { key: string }
    expect(answer.key).toMatch(/^record\/[0-9a-f-]{36}\.jpg$/)
    expect(stored.has(answer.key)).toBe(true)
  })
  it('refuses somebody with neither tick', async () => {
    const { bucket, stored } = fakeBucket()
    const response = await uploadRecordFile(
      upload(PDF),
      env(bucket),
      supabase([{ can_patients: false, can_medical: false }]),
    )
    expect(response.status).toBe(403)
    expect(stored.size).toBe(0)
  })
  it('asks the database to open (and log) a record file, not the lab', async () => {
    const KEY = 'record/12345678-1234-1234-1234-123456789abc.pdf'
    const { bucket, stored } = fakeBucket()
    stored.set(KEY, PDF)
    const { post, asked } = askingAnswer(true)
    const request = new Request(`https://x/api/files/${KEY}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const response = await downloadFile(request, KEY, env(bucket), post)
    expect(response.status).toBe(200)
    expect(asked[0]).toContain('rpc/open_patient_file')
    const refused = await downloadFile(request, KEY, env(bucket), askingAnswer(false).post)
    expect(refused.status).toBe(404)
  })
  it('knows our two kinds of name and nothing else', () => {
    expect(kindOf('lab/12345678-1234-1234-1234-123456789abc.webp')).toBe('lab')
    expect(kindOf('record/12345678-1234-1234-1234-123456789abc.pdf')).toBe('record')
    expect(kindOf('record/../secret.pdf')).toBeNull()
    expect(kindOf('other/12345678-1234-1234-1234-123456789abc.pdf')).toBeNull()
    expect(kindOf('record/12345678-1234-1234-1234-123456789abcXpdf')).toBeNull()
  })
})

describe('deleteRecordFile', () => {
  const KEY = 'record/12345678-1234-1234-1234-123456789abc.pdf'
  const del = (token: string | null = TOKEN) =>
    new Request(`https://x/api/files/${KEY}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  const bucketWith = () => {
    const stored = new Map<string, Uint8Array>([[KEY, PDF]])
    const bucket = {
      delete: async (key: string) => {
        stored.delete(key)
      },
    } as unknown as R2Bucket
    return { bucket, stored }
  }

  it('deletes the stored file only after the database says deleted', async () => {
    const { bucket, stored } = bucketWith()
    const { post, asked } = askingAnswer('deleted')
    const response = await deleteRecordFile(del(), KEY, env(bucket), post)
    expect(response.status).toBe(200)
    expect(asked[0]).toContain('rpc/delete_patient_file')
    expect(stored.has(KEY)).toBe(false)
  })
  it('keeps the file when the database refuses', async () => {
    const { bucket, stored } = bucketWith()
    const refused = (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch
    const response = await deleteRecordFile(del(), KEY, env(bucket), refused)
    expect(response.status).toBe(403)
    expect(stored.has(KEY)).toBe(true)
  })
  it('refuses somebody not signed in, and lab files', async () => {
    const { bucket, stored } = bucketWith()
    expect(
      (await deleteRecordFile(del(null), KEY, env(bucket), askingAnswer('deleted').post)).status,
    ).toBe(401)
    const lab = 'lab/12345678-1234-1234-1234-123456789abc.pdf'
    expect(
      (await deleteRecordFile(del(), lab, env(bucket), askingAnswer('deleted').post)).status,
    ).toBe(404)
    expect(stored.has(KEY)).toBe(true)
  })
})
