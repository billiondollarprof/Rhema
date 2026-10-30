/*
 * worker/src/files.ts: lab result files (request 115, slice 2). The lab
 * attaches a photo or PDF of the machine printout; doctors, nurses and the
 * matron open it from the patient's record.
 *
 * Why: Anthony, 2026-10-30: "We can build the attach result infra now...
 * make sure that the attached files is usually compressed without
 * affecting the quality of the document." The screens shrink photos before
 * upload (web/lib/lab/files.ts); PDFs are already small and pass as they
 * are.
 *
 * How it works:
 *   1. Upload (POST /api/files/lab): the person's own sign in token comes
 *      with the file. We ask Supabase who it is and whether they have the
 *      Laboratory tick, using that same token, so the database's own rules
 *      answer. The file must really be a WebP, JPEG or PDF (its first bytes
 *      are checked, not its name), 10 MB at most. It is stored in R2 under a
 *      random name, and the name is returned.
 *   2. Download (GET /api/files/lab/<name>): again with the person's token.
 *      We ask Supabase for the lab result that holds this file, as that
 *      person. The database answers only if they may read that result (the
 *      opened record, or the lab person who typed it). No row, no file.
 *
 * Never: let the bucket be public, serve a file without asking the
 * database, trust a file's name or type label, or log a patient detail.
 */

// ===== 1. What this part is given =====
export interface FilesEnv {
  // The R2 bucket: rhema-files on live, rhema-files-testing on testing.
  FILES?: R2Bucket
  // This site's Supabase address and public key (public by design).
  SUPABASE_URL?: string
  SUPABASE_KEY?: string
}

export const MOST_BYTES = 10 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
}

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
}

// ===== 2. What a file really is, from its first bytes =====
export function realType(bytes: Uint8Array): string | null {
  const starts = (...wanted: number[]) => wanted.every((byte, at) => bytes[at] === byte)
  // %PDF
  if (starts(0x25, 0x50, 0x44, 0x46)) return 'application/pdf'
  // JPEG starts FF D8 FF.
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg'
  // WebP: "RIFF", 4 bytes of size, then "WEBP".
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

// A stored file's name: lab/<random uuid>.<webp|jpg|pdf>. Nothing else.
const NAME = /^lab\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|pdf)$/

// ===== 3. Asking Supabase, as the person =====
type Ask = (path: string, token: string) => Promise<unknown[] | null>

function supabaseAsker(env: FilesEnv, post: typeof fetch): Ask {
  return async (path, token) => {
    const response = await post(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: env.SUPABASE_KEY ?? '', Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null
    const rows = (await response.json()) as unknown
    return Array.isArray(rows) ? rows : null
  }
}

function tokenFrom(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer ([A-Za-z0-9._-]{20,4000})$/)
  return match ? match[1] : null
}

// The person's id, read from their token. Supabase checks the token itself
// on every question we ask with it, so a made up token gets no answers.
function personFrom(token: string): string | null {
  try {
    const body = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(body)) as { sub?: unknown }
    return typeof claims.sub === 'string' && /^[0-9a-f-]{36}$/.test(claims.sub) ? claims.sub : null
  } catch {
    return null
  }
}

const no = (status: number, error: string) => Response.json({ error }, { status })

// ===== 4. Upload =====
export async function uploadLabFile(
  request: Request,
  env: FilesEnv,
  post: typeof fetch = fetch,
): Promise<Response> {
  if (!env.FILES || !env.SUPABASE_URL || !env.SUPABASE_KEY)
    return no(503, 'Files are not set up yet')
  const token = tokenFrom(request)
  const person = token ? personFrom(token) : null
  if (!token || !person) return no(401, 'Please sign in again')

  // The Laboratory tick, as the database sees it for this person.
  const rows = await supabaseAsker(env, post)(
    `staff?select=can_lab&id=eq.${person}&is_active=eq.true`,
    token,
  )
  const row = rows?.[0] as { can_lab?: boolean } | undefined
  if (!row?.can_lab) return no(403, 'Only the Laboratory can attach result files')

  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > MOST_BYTES) return no(413, 'The file is bigger than 10 MB')
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length === 0) return no(400, 'The file is empty')
  if (bytes.length > MOST_BYTES) return no(413, 'The file is bigger than 10 MB')

  const type = realType(bytes)
  if (!type) return no(415, 'Attach a photo or a PDF')

  const key = `lab/${crypto.randomUUID()}.${EXTENSIONS[type]}`
  await env.FILES.put(key, bytes, {
    httpMetadata: { contentType: type },
    customMetadata: { uploadedBy: person },
  })
  // Counts only, never names.
  console.log(`Lab file stored: ${type}, ${bytes.length} bytes`)
  return Response.json({ key, type, size: bytes.length })
}

// ===== 5. Download =====
export async function downloadLabFile(
  request: Request,
  key: string,
  env: FilesEnv,
  post: typeof fetch = fetch,
): Promise<Response> {
  if (!env.FILES || !env.SUPABASE_URL || !env.SUPABASE_KEY)
    return no(503, 'Files are not set up yet')
  if (!NAME.test(key)) return no(404, 'Not found')
  const token = tokenFrom(request)
  if (!token || !personFrom(token)) return no(401, 'Please sign in again')

  // Only if the database lets this person read the result holding the file.
  const rows = await supabaseAsker(env, post)(
    `lab_results?select=id&file_key=eq.${encodeURIComponent(key)}&limit=1`,
    token,
  )
  if (!rows || rows.length === 0) return no(404, 'Not found')

  const stored = await env.FILES.get(key)
  if (!stored) return no(404, 'Not found')
  const extension = key.split('.').pop() ?? ''
  return new Response(stored.body, {
    headers: {
      'Content-Type': TYPES[extension] ?? 'application/octet-stream',
      'Content-Disposition': 'inline',
      // A medical file: never kept by a browser or anything in between.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
