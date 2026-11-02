/*
 * worker/src/files.ts: files on the patient's record. Two kinds:
 *   lab      a photo or PDF of the lab printout (request 115, slice 2),
 *            attached by the Laboratory.
 *   record   scans, photos and PDFs on the record itself (request 128,
 *            2026-11-02), attached by anybody who may register patients
 *            (the Front Desk brings in old files) or use the record.
 * Doctors, nurses and the matron open both from the patient's record.
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

// A stored file's name: <kind>/<random uuid>.<webp|jpg|pdf>. Nothing else.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

// ===== 2b. The two kinds of file, and who may do what with each =====
export type FileKind = 'lab' | 'record'

type KindRules = {
  // Stored names look like this, and nothing else is served.
  name: RegExp
  // What to ask Supabase about the person (as them) before storing.
  whoAsk: (person: string) => string
  // Whether that answer allows storing.
  mayStore: (row: Record<string, unknown> | undefined) => boolean
  refused: string
  // Asks Supabase (as the person) before serving a stored file: true means
  // the database lets this person read it.
  mayRead: (key: string, token: string, env: FilesEnv, post: typeof fetch) => Promise<boolean>
  // For the log: counts only, never names.
  label: string
}

const KINDS: Record<FileKind, KindRules> = {
  lab: {
    name: new RegExp(`^lab/${UUID}\\.(webp|jpg|pdf)$`),
    whoAsk: (person) => `staff?select=can_lab&id=eq.${person}&is_active=eq.true`,
    mayStore: (row) => row?.can_lab === true,
    refused: 'Only the Laboratory can attach result files',
    mayRead: async (key, token, env, post) => {
      const rows = await supabaseAsker(env, post)(
        `lab_results?select=id&file_key=eq.${encodeURIComponent(key)}&limit=1`,
        token,
      )
      return Boolean(rows && rows.length > 0)
    },
    label: 'Lab file',
  },
  record: {
    name: new RegExp(`^record/${UUID}\\.(webp|jpg|pdf)$`),
    whoAsk: (person) => `staff?select=can_patients,can_medical&id=eq.${person}&is_active=eq.true`,
    mayStore: (row) => row?.can_patients === true || row?.can_medical === true,
    refused: 'You cannot attach files to patients',
    // The database checks, refuses a crossed out file, and writes the
    // opening in the activity log (open_patient_file, 2026-11-02).
    mayRead: async (key, token, env, post) =>
      (await callFunction(env, post, 'open_patient_file', { key }, token)) === true,
    label: 'Record file',
  },
}

// Which kind a stored name belongs to, or null if it is not one of ours.
export function kindOf(key: string): FileKind | null {
  if (KINDS.lab.name.test(key)) return 'lab'
  if (KINDS.record.name.test(key)) return 'record'
  return null
}

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

// Call a database function as the person. Answers what it returned, or
// null when Supabase refused.
async function callFunction(
  env: FilesEnv,
  post: typeof fetch,
  name: string,
  body: Record<string, unknown>,
  token: string,
): Promise<unknown> {
  const response = await post(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_KEY ?? '',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) return null
  return (await response.json()) as unknown
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
export async function uploadFile(
  request: Request,
  env: FilesEnv,
  kind: FileKind,
  post: typeof fetch = fetch,
): Promise<Response> {
  const rules = KINDS[kind]
  if (!env.FILES || !env.SUPABASE_URL || !env.SUPABASE_KEY)
    return no(503, 'Files are not set up yet')
  const token = tokenFrom(request)
  const person = token ? personFrom(token) : null
  if (!token || !person) return no(401, 'Please sign in again')

  // The person's ticks, as the database sees them for this person.
  const rows = await supabaseAsker(env, post)(rules.whoAsk(person), token)
  if (!rules.mayStore(rows?.[0] as Record<string, unknown> | undefined))
    return no(403, rules.refused)

  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > MOST_BYTES) return no(413, 'The file is bigger than 10 MB')
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length === 0) return no(400, 'The file is empty')
  if (bytes.length > MOST_BYTES) return no(413, 'The file is bigger than 10 MB')

  const type = realType(bytes)
  if (!type) return no(415, 'Attach a photo or a PDF')

  const key = `${kind}/${crypto.randomUUID()}.${EXTENSIONS[type]}`
  await env.FILES.put(key, bytes, {
    httpMetadata: { contentType: type },
    customMetadata: { uploadedBy: person },
  })
  // Counts only, never names.
  console.log(`${rules.label} stored: ${type}, ${bytes.length} bytes`)
  return Response.json({ key, type, size: bytes.length })
}

// The lab's own names, kept so the lab screens and tests read as before.
export const uploadLabFile = (request: Request, env: FilesEnv, post: typeof fetch = fetch) =>
  uploadFile(request, env, 'lab', post)
export const uploadRecordFile = (request: Request, env: FilesEnv, post: typeof fetch = fetch) =>
  uploadFile(request, env, 'record', post)

// ===== 5. Download =====
// Serves lab/... and record/... names alike; each asks its own table.
export async function downloadFile(
  request: Request,
  key: string,
  env: FilesEnv,
  post: typeof fetch = fetch,
): Promise<Response> {
  if (!env.FILES || !env.SUPABASE_URL || !env.SUPABASE_KEY)
    return no(503, 'Files are not set up yet')
  const kind = kindOf(key)
  if (!kind) return no(404, 'Not found')
  const token = tokenFrom(request)
  if (!token || !personFrom(token)) return no(401, 'Please sign in again')

  // Only if the database lets this person read the row holding the file.
  if (!(await KINDS[kind].mayRead(key, token, env, post))) return no(404, 'Not found')

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

export const downloadLabFile = downloadFile

// ===== 6. Delete a record file attached by mistake =====
// Only the person who attached it, on a patient registered from an old
// file (Anthony, 2026-11-02). The database decides and forgets the row
// first; only then is the stored file deleted, so storage is freed.
export async function deleteRecordFile(
  request: Request,
  key: string,
  env: FilesEnv,
  post: typeof fetch = fetch,
): Promise<Response> {
  if (!env.FILES || !env.SUPABASE_URL || !env.SUPABASE_KEY)
    return no(503, 'Files are not set up yet')
  if (kindOf(key) !== 'record') return no(404, 'Not found')
  const token = tokenFrom(request)
  if (!token || !personFrom(token)) return no(401, 'Please sign in again')

  const answer = await callFunction(env, post, 'delete_patient_file', { key }, token)
  if (answer === 'not_found') return no(404, 'Not found')
  if (answer !== 'deleted') return no(403, 'Only the person who attached it can delete it')
  await env.FILES.delete(key)
  console.log('Record file deleted')
  return Response.json({ deleted: true })
}
