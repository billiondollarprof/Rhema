/*
 * lib/export/export.ts: "Download our data" for the admin.
 *
 * Why: Anthony, 2026-11-16 (requests 206 and 217a): "at any point in time,
 * the hospital can decide, okay, they want their data." One ZIP file: a
 * spreadsheet (CSV) for every table, and every uploaded file (scans, photos,
 * lab result files) under files/.
 *
 * The database checks the admin and the PIN, and writes the download in the
 * activity log (export_everything). Files come through the same door as
 * when they are opened in the app.
 *
 * Never: keep a copy anywhere but the admin's own download.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PinResult } from '@/lib/admin/admin'
import { makeZip } from './zip'

// ===== 1. Rows into a spreadsheet (CSV) that Excel opens =====
function csvOf(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return 'No rows\r\n'
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((c) => cell(row[c])).join(',')),
  ]
  // The mark at the start tells Excel the words are UTF-8 (₦, names).
  return '﻿' + lines.join('\r\n') + '\r\n'
}

// ===== 2. The download =====
// progress: words for the screen while it works.
export async function downloadOurData(
  client: SupabaseClient,
  pin: string,
  progress: (words: string) => void,
): Promise<PinResult> {
  progress('Checking your PIN…')
  const { data, error } = await client.rpc('export_everything', { pin })
  if (error) return 'That did not work. Check the internet and try again.'
  const answer = data as { pin: string; tables?: Record<string, Record<string, unknown>[]> }
  if (answer.pin === 'locked') return 'locked'
  if (answer.pin !== 'ok' || !answer.tables) return 'That PIN is not right. Try again.'

  // The spreadsheets.
  const encoder = new TextEncoder()
  const files: { name: string; data: Uint8Array<ArrayBuffer> }[] = []
  for (const [name, rows] of Object.entries(answer.tables)) {
    files.push({ name: `spreadsheets/${name}.csv`, data: encoder.encode(csvOf(rows)) })
  }

  // The uploaded files, one by one.
  const keys = [
    ...(answer.tables.patient_files ?? []).map((row) => row.file_key),
    ...(answer.tables.lab_results ?? []).map((row) => row.file_key),
  ].filter((key): key is string => typeof key === 'string' && key.length > 0)
  const { data: session } = await client.auth.getSession()
  const token = session.session?.access_token
  let missed = 0
  for (const [at, key] of keys.entries()) {
    progress(`Adding the uploaded files: ${at + 1} of ${keys.length}…`)
    try {
      const response = await fetch(`/api/files/${key}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      if (!response.ok) {
        missed += 1
        continue
      }
      files.push({ name: `files/${key}`, data: new Uint8Array(await response.arrayBuffer()) })
    } catch {
      missed += 1
    }
  }
  files.push({
    name: 'READ ME.txt',
    data: encoder.encode(
      `The hospital's data, downloaded ${new Date().toLocaleString('en-GB')}.\r\n` +
        'spreadsheets: one file for each part of the records, opened with Excel.\r\n' +
        'files: the scans, photos and lab result files, named as in the spreadsheets.\r\n' +
        (missed ? `${missed} file(s) could not be fetched; try the download again.\r\n` : '') +
        'This holds every patient. Keep it on a hospital device and never share it.\r\n',
    ),
  })

  // One ZIP, saved by the browser.
  progress('Making the file…')
  const zip = makeZip(files)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(zip)
  link.download = `hospital-data-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 60000)
  progress(missed ? `Downloaded. ${missed} file(s) could not be fetched.` : 'Downloaded.')
  return null
}
