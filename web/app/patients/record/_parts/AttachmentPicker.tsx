/*
 * record/_parts/AttachmentPicker.tsx: choose which attachments to download
 * (request 130, 2026-11-02).
 *
 * Why: Anthony: "show the names of the attachment... select or toggle one
 * button that says select all... download everything once as a zip
 * folder, or they can just choose one and download as a single file."
 * One chosen: saved as it is. Several: one .zip named after the patient.
 *
 * Never: download anything nobody ticked.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import styles from './record.module.css'
import buttons from '../../_parts/patients.module.css'
import { downloadChosen, sizeWords } from '@/lib/files/files'
import type { PatientFile } from '@/lib/patients/patientFiles'

export default function AttachmentPicker({
  client,
  files,
  zipName,
  onClose,
}: {
  client: SupabaseClient
  files: PatientFile[]
  // e.g. "Ngozi Okafor RMC-000077 attachments.zip"
  zipName: string
  onClose: () => void
}) {
  const [chosen, setChosen] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const all = chosen.length === files.length

  function toggle(id: number) {
    setChosen((now) => (now.includes(id) ? now.filter((one) => one !== id) : [...now, id]))
  }

  async function download() {
    setBusy(true)
    setProblem(null)
    const picked = files.filter((file) => chosen.includes(file.id))
    const failed = await downloadChosen(
      client,
      picked.map((file) => ({ key: file.file_key, name: file.file_name })),
      zipName,
    )
    setBusy(false)
    if (failed) setProblem(failed)
    else onClose()
  }

  return (
    <div className={`${styles.choice} ${styles.noPrint}`}>
      <div className={styles.pickTop}>
        <b>Attachments</b>
        <label className={styles.pickAll}>
          <input
            type="checkbox"
            checked={all}
            onChange={() => setChosen(all ? [] : files.map((file) => file.id))}
          />
          Select all
        </label>
      </div>
      <ul className={styles.pickList}>
        {files.map((file) => (
          <li key={file.id}>
            <label>
              <input
                type="checkbox"
                checked={chosen.includes(file.id)}
                onChange={() => toggle(file.id)}
              />
              <span>
                <b>{file.file_name}</b>
                <small>{sizeWords(file.file_size)}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={buttons.buttons}>
        <button
          className={`${buttons.button} ${buttons.primary}`}
          onClick={download}
          disabled={busy || chosen.length === 0}
        >
          {busy
            ? 'Downloading…'
            : chosen.length > 1
              ? `Download ${chosen.length} as zip`
              : 'Download'}
        </button>
        <button className={buttons.button} onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  )
}
