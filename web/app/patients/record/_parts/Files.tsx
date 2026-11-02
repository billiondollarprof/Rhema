/*
 * record/_parts/Files.tsx: the Files part of the patient's record: scans,
 * ultrasound results, old paper files and documents (request 128).
 * Preview shows a file inside the app; the person who attached it to an
 * old file patient may delete it (2026-11-02).
 *
 * Why: Anthony, 2026-11-02: "every patient's record can carry attachments
 * ... they can click attach, then it will prompt their computer, they'll
 * be able to upload a document." Pictures open straight away in a new tab;
 * a PDF opens in the browser's own reader where it can.
 *
 * A wrong file is removed with a reason. It stays in the list, crossed
 * out, like every other correction in the record.
 *
 * Never: show the files outside the opened record. The database and the
 * Worker both refuse anybody who has not opened it.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FilePicker from '../../_parts/FilePicker'
import StoredFile from '../../_parts/StoredFile'
import Line from './Line'
import ReasonForm from './ReasonForm'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import { sizeWords, type ReadyFile } from '@/lib/files/files'
import {
  attachFiles,
  listPatientFiles,
  removePatientFile,
  type PatientFile,
} from '@/lib/patients/patientFiles'
import { when } from '@/lib/record/record'

const REMOVE_REASONS = ['Wrong patient', 'Wrong file', 'Not clear, added again']

export default function FilesSection({
  client,
  staffId,
  patientId,
  fromOldFile,
  onLoaded,
}: {
  client: SupabaseClient
  staffId: string
  patientId: number
  // A patient registered from an old file: the section opens by itself.
  fromOldFile: boolean
  // Tells the page which files there are, for Download.
  onLoaded: (files: PatientFile[]) => void
}) {
  const [files, setFiles] = useState<PatientFile[] | null>(null)
  const [chosen, setChosen] = useState<ReadyFile[]>([])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  // ===== 1. Load the list =====
  const load = useCallback(async () => {
    const found = await listPatientFiles(client, patientId)
    setFiles(found)
    onLoaded(found)
  }, [client, patientId, onLoaded])

  useEffect(() => {
    let current = true
    listPatientFiles(client, patientId).then((found) => {
      if (!current) return
      setFiles(found)
      onLoaded(found)
    })
    return () => {
      current = false
    }
  }, [client, patientId, onLoaded])

  // ===== 2. Attach the chosen files =====
  async function attach() {
    if (chosen.length === 0) return
    setBusy(true)
    setProblem(null)
    setProgress(`Sending file 1 of ${chosen.length}…`)
    const failed = await attachFiles(client, patientId, chosen, (done) =>
      setProgress(done < chosen.length ? `Sending file ${done + 1} of ${chosen.length}…` : null),
    )
    setProgress(null)
    setBusy(false)
    setChosen(failed)
    if (failed.length) {
      setProblem(`${failed.length} not sent. Check the network and try again.`)
    } else {
      setAdding(false)
    }
    await load()
  }

  const live = (files ?? []).filter((file) => !file.removed_at)
  const open = fromOldFile || adding

  return (
    <div id="files" className={styles.anchor}>
      <Section
        key={open ? 'open' : 'shut'}
        title="Files"
        count={files ? live.length : undefined}
        open={open}
      >
        {/* ----- Add files ----- */}
        {adding ? (
          <div className={styles.form}>
            <FilePicker files={chosen} onChange={setChosen} disabled={busy} />
            {progress ? <p className={styles.muted}>{progress}</p> : null}
            {problem ? <p className={styles.error}>{problem}</p> : null}
            <div className={styles.actions}>
              <button
                className={`${styles.small} ${styles.primary}`}
                disabled={busy || chosen.length === 0}
                onClick={attach}
              >
                {busy ? 'Sending…' : 'Attach'}
              </button>
              <button
                className={styles.small}
                disabled={busy}
                onClick={() => {
                  setAdding(false)
                  setChosen([])
                  setProblem(null)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <button className={styles.small} onClick={() => setAdding(true)}>
              + Attach files
            </button>
          </div>
        )}

        {files === null ? <EmptyLine text="Loading…" /> : null}
        {files && files.length === 0 ? <EmptyLine text="No files yet." /> : null}

        {/* ----- The files, newest first ----- */}
        {(files ?? []).map((file) => (
          <FileLine
            key={file.id}
            client={client}
            staffId={staffId}
            file={file}
            fromOldFile={fromOldFile}
            onDone={load}
          />
        ))}
      </Section>
    </div>
  )
}

// ===== 3. One file: preview it, delete it (the uploader, old files only),
// or remove it with a reason =====
function FileLine({
  client,
  staffId,
  file,
  fromOldFile,
  onDone,
}: {
  client: SupabaseClient
  staffId: string
  file: PatientFile
  fromOldFile: boolean
  onDone: () => void
}) {
  const [removing, setRemoving] = useState(false)
  const kind = file.file_type === 'application/pdf' ? 'PDF' : 'Scan or photo'

  return (
    <Line
      what={<b className={styles.fileName}>{file.file_name}</b>}
      status={<span className={`${styles.pill} ${styles.blue}`}>{kind}</span>}
      meta={`${file.uploader?.full_name ?? 'Staff'} · ${when(file.uploaded_at)} · ${sizeWords(file.file_size)}`}
      voided={file.removed_at ? { reason: file.remove_reason, by: null } : null}
      form={
        removing ? (
          <ReasonForm
            question="Why remove this file?"
            choices={REMOVE_REASONS}
            confirmLabel="Remove"
            onCancel={() => setRemoving(false)}
            onConfirm={async (reason) => {
              const failed = await removePatientFile(client, file.id, reason)
              if (!failed) {
                setRemoving(false)
                onDone()
              }
              return failed
            }}
          />
        ) : undefined
      }
      actions={
        <>
          <StoredFile
            client={client}
            staffId={staffId}
            file={file}
            fromOldFile={fromOldFile}
            buttonClass={styles.small}
            onDeleted={onDone}
          />
          <button className={`${styles.small} ${styles.link}`} onClick={() => setRemoving(true)}>
            Remove
          </button>
        </>
      }
    />
  )
}
