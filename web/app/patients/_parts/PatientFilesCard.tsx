/*
 * app/patients/_parts/PatientFilesCard.tsx: the patient's files on Edit
 * patient (request 128, 2026-11-02).
 *
 * Why: "when they are about to edit a patient, anybody should be able to
 * see the files that were attached to that patient... They can preview
 * it, but they can't delete it. But only the person who attached it can
 * delete it." And when a wrong file is deleted, "add the correct one", so
 * files can be attached here too.
 *
 * Never: offer a download here; that lives in the medical record.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FilePicker from './FilePicker'
import StoredFile from './StoredFile'
import styles from './patients.module.css'
import Icon from '@/components/shell/Icon'
import { sizeWords, type ReadyFile } from '@/lib/files/files'
import { attachFiles, listPatientFiles, type PatientFile } from '@/lib/patients/patientFiles'

export default function PatientFilesCard({
  client,
  staffId,
  patientId,
  fromOldFile,
}: {
  client: SupabaseClient
  staffId: string
  patientId: number
  fromOldFile: boolean
}) {
  const [files, setFiles] = useState<PatientFile[] | null>(null)
  const [chosen, setChosen] = useState<ReadyFile[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // ===== 1. The list (crossed out files are not shown here) =====
  const load = useCallback(async () => {
    const found = await listPatientFiles(client, patientId)
    setFiles(found.filter((file) => !file.removed_at))
  }, [client, patientId])

  useEffect(() => {
    let current = true
    listPatientFiles(client, patientId).then((found) => {
      if (current) setFiles(found.filter((file) => !file.removed_at))
    })
    return () => {
      current = false
    }
  }, [client, patientId])

  // ===== 2. Attach more =====
  async function attach() {
    setBusy(true)
    setProblem(null)
    const failed = await attachFiles(client, patientId, chosen)
    setBusy(false)
    setChosen(failed)
    if (failed.length) setProblem(`${failed.length} not sent. Check the network and try again.`)
    await load()
  }

  return (
    <section className={styles.card} aria-label="Files">
      <h3 className={styles.cardTitle}>Files</h3>
      {files === null ? <p className={styles.muted}>Loading…</p> : null}
      {files && files.length === 0 ? <p className={styles.muted}>No files yet.</p> : null}
      {files && files.length > 0 ? (
        <ul className={styles.fileList}>
          {files.map((file) => (
            <li key={file.id} className={styles.storedFile}>
              <Icon name={file.file_type === 'application/pdf' ? 'file' : 'camera'} size={16} />
              <span>
                <b>{file.file_name}</b>
                <small>
                  {file.uploader?.full_name ?? 'Staff'} · {sizeWords(file.file_size)}
                </small>
              </span>
              <div className={styles.buttons}>
                <StoredFile
                  client={client}
                  staffId={staffId}
                  file={file}
                  fromOldFile={fromOldFile}
                  buttonClass={styles.button}
                  onDeleted={load}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <FilePicker files={chosen} onChange={setChosen} disabled={busy} />
      {problem ? <p className={styles.error}>{problem}</p> : null}
      {chosen.length > 0 ? (
        <div className={styles.buttons}>
          <button className={`${styles.button} ${styles.primary}`} onClick={attach} disabled={busy}>
            {busy ? 'Sending…' : 'Attach'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
