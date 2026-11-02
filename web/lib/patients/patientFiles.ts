/*
 * lib/patients/patientFiles.ts: the files on a patient's record (request
 * 128): listing them, attaching new ones, and removing a wrong one.
 *
 * Why: Anthony, 2026-11-02: "we can attach a document like scanned a
 * patient scan, ABI ultrasound scan results and other stuff. And you can
 * also attach normal written documents." Register from old file and the
 * record's Files section both attach this way.
 *
 * How attaching works, for each file in turn:
 *   1. the Worker stores it and answers its stored name (lib/files);
 *   2. the database records it on the patient (add_patient_file).
 * A file that fails either step is handed back, so the screen can offer
 * Try again for just that file.
 *
 * Who may see or remove a file is decided by the database
 * (supabase/migrations/20261102083654_patient_files.sql).
 *
 * Never: log a file's name or the patient's name. Counts only.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadFile, type ReadyFile } from '@/lib/files/files'

// ===== 1. Shape =====
export type PatientFile = {
  id: number
  file_key: string
  file_name: string
  file_type: string
  file_size: number
  uploaded_at: string
  removed_at: string | null
  remove_reason: string | null
  uploader: { full_name: string } | null
}

const COLUMNS =
  'id, file_key, file_name, file_type, file_size, uploaded_at, removed_at, remove_reason, ' +
  'uploader:staff!patient_files_uploaded_by_fkey(full_name)'

// ===== 2. List, newest first =====
// Empty for anybody who may not read the record: the database says so.
export async function listPatientFiles(
  client: SupabaseClient,
  patientId: number,
): Promise<PatientFile[]> {
  const { data } = await client
    .from('patient_files')
    .select(COLUMNS)
    .eq('patient_id', patientId)
    .order('uploaded_at', { ascending: false })
  return (data as unknown as PatientFile[] | null) ?? []
}

// ===== 3. Attach, one file after another =====
export async function attachFiles(
  client: SupabaseClient,
  patientId: number,
  files: ReadyFile[],
  onProgress: (done: number) => void = () => {},
): Promise<ReadyFile[]> {
  const failed: ReadyFile[] = []
  let done = 0
  for (const file of files) {
    const stored = await uploadFile(client, file, 'record')
    if (typeof stored === 'string') {
      failed.push(file)
    } else {
      const { data, error } = await client.rpc('add_patient_file', {
        patient: patientId,
        key: stored.key,
        name: file.name,
        type: file.type,
        size: file.size,
      })
      if (error || (data !== 'added' && data !== 'already_added')) failed.push(file)
    }
    done += 1
    onProgress(done)
  }
  if (failed.length) console.warn(`${failed.length} of ${files.length} files were not attached`)
  return failed
}

// ===== 4. Remove a wrong file, with a reason =====
export async function removePatientFile(
  client: SupabaseClient,
  fileId: number,
  reason: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('remove_patient_file', { file: fileId, reason })
  if (error || (data !== 'removed' && data !== 'already_removed')) {
    return 'The file could not be removed. Check the internet and try again.'
  }
  return null
}
