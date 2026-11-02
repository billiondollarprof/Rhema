/*
 * app/patients/_parts/StoredFile.tsx: what can be done with a file already
 * on a patient: Preview, and, for the person who attached it to a patient
 * registered from an old file, Delete (request 128, 2026-11-02).
 *
 * Why: "anybody should be able to see the files that were attached to
 * that patient... They can preview it, but they can't delete it. But only
 * the person who attached it can delete it." Delete is only for old files,
 * because the hospital keeps the paper. A red warning comes first.
 *
 * Used by Edit patient and by the Files section of the record.
 *
 * Never: show Delete to anybody but the uploader, or on a patient who was
 * not registered from an old file. The database refuses them too.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FilePreview from './FilePreview'
import styles from './patients.module.css'
import { deleteFile, fetchFile } from '@/lib/files/files'
import type { PatientFile } from '@/lib/patients/patientFiles'

export default function StoredFile({
  client,
  staffId,
  file,
  fromOldFile,
  buttonClass,
  onDeleted,
}: {
  client: SupabaseClient
  staffId: string
  file: PatientFile
  fromOldFile: boolean
  // The small button look of the screen it sits on.
  buttonClass: string
  onDeleted: () => void
}) {
  const [address, setAddress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const mayDelete = fromOldFile && file.uploaded_by === staffId && !file.removed_at

  // ===== 1. Preview: fetch it, show it, forget it on close =====
  async function preview() {
    setBusy(true)
    setProblem(null)
    const found = await fetchFile(client, file.file_key)
    setBusy(false)
    if (typeof found === 'string') setProblem(found)
    else setAddress(URL.createObjectURL(found))
  }

  function close() {
    if (address) URL.revokeObjectURL(address)
    setAddress(null)
  }

  // ===== 2. Delete, after the warning =====
  async function remove() {
    setBusy(true)
    setProblem(null)
    const failed = await deleteFile(client, file.file_key)
    setBusy(false)
    if (failed) setProblem(failed)
    else onDeleted()
  }

  if (asking) {
    return (
      <div className={styles.danger} role="alert">
        <b>Delete this file?</b>
        <small>It is gone for good. Keep the paper copy.</small>
        <div className={styles.buttons}>
          <button
            className={`${buttonClass} ${styles.dangerButton}`}
            onClick={remove}
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
          <button className={buttonClass} onClick={() => setAsking(false)} disabled={busy}>
            Cancel
          </button>
        </div>
        {problem ? <small>{problem}</small> : null}
      </div>
    )
  }

  return (
    <>
      <button className={buttonClass} onClick={preview} disabled={busy || Boolean(file.removed_at)}>
        {busy ? 'Opening…' : 'Preview'}
      </button>
      {mayDelete ? (
        <button className={buttonClass} onClick={() => setAsking(true)}>
          Delete
        </button>
      ) : null}
      {problem ? <small className={styles.error}>{problem}</small> : null}
      {address ? (
        <FilePreview
          address={address}
          type={file.file_type}
          name={file.file_name}
          onClose={close}
        />
      ) : null}
    </>
  )
}
