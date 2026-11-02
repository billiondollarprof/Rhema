/*
 * app/patients/_parts/FilePicker.tsx: choosing scans, photos and PDF files
 * for a patient, before they are sent.
 *
 * Why: request 128 (Anthony, 2026-11-02). Two buttons, so staff know what
 * goes where: "Add scan or photo" and "Add PDF file". A Word document must
 * be saved as PDF first; the screen says so. Up to 5 files at once, 10 MB
 * each. A photo is shrunk to WebP here, before it is sent, and stays clear.
 *
 * Tapping a chosen file shows it (FilePreview), straight from the device,
 * so staff can check it is the right document before sending it.
 *
 * Used by Register from old file and by the Files section of the record.
 *
 * Never: send anything. This only gets files ready; the page sends them.
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import FilePreview from './FilePreview'
import styles from './patients.module.css'
import Icon from '@/components/shell/Icon'
import { MOST_AT_ONCE, prepareFile, sizeWords, type ReadyFile } from '@/lib/files/files'

export default function FilePicker({
  files,
  onChange,
  disabled = false,
}: {
  files: ReadyFile[]
  onChange: (files: ReadyFile[]) => void
  disabled?: boolean
}) {
  const photoInput = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [shown, setShown] = useState<number | null>(null)

  // A local address for each chosen file, for the small picture and the
  // preview. Let go of them when the list changes, so nothing piles up.
  const addresses = useMemo(() => files.map((file) => URL.createObjectURL(file.blob)), [files])
  useEffect(() => () => addresses.forEach((address) => URL.revokeObjectURL(address)), [addresses])

  const full = files.length >= MOST_AT_ONCE

  // ===== 1. Get the chosen files ready, up to 5 in all =====
  async function take(list: FileList | null, input: HTMLInputElement | null) {
    if (!list || list.length === 0) return
    setWorking(true)
    setProblem(null)
    const room = MOST_AT_ONCE - files.length
    const chosen = Array.from(list)
    const ready: ReadyFile[] = []
    const problems: string[] = []
    for (const file of chosen.slice(0, room)) {
      const result = await prepareFile(file)
      if (typeof result === 'string') problems.push(`${file.name}: ${result}`)
      else ready.push(result)
    }
    if (chosen.length > room) problems.push(`Only ${MOST_AT_ONCE} files at a time.`)
    onChange([...files, ...ready])
    setProblem(problems.length ? problems.join(' ') : null)
    setWorking(false)
    // Let the same file be chosen again after it was removed.
    if (input) input.value = ''
  }

  return (
    <div className={styles.filePicker}>
      {/* ===== 2. The two buttons ===== */}
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          disabled={disabled || working || full}
          onClick={() => photoInput.current?.click()}
        >
          <Icon name="camera" size={16} /> Add scan or photo
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={disabled || working || full}
          onClick={() => pdfInput.current?.click()}
        >
          <Icon name="file" size={16} /> Add PDF file
        </button>
      </div>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => take(event.target.files, event.target)}
      />
      <input
        ref={pdfInput}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(event) => take(event.target.files, event.target)}
      />
      <small className={styles.muted}>
        Up to {MOST_AT_ONCE} files, 10 MB each. Word files: save as PDF first.
      </small>
      {working ? <small className={styles.muted}>Preparing…</small> : null}
      {problem ? <small className={styles.error}>{problem}</small> : null}

      {/* ===== 3. What is chosen so far ===== */}
      {files.length > 0 ? (
        <ul className={styles.fileList}>
          {files.map((file, at) => (
            <li key={`${file.name}-${at}`}>
              {file.type !== 'application/pdf' && addresses[at] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.thumb} src={addresses[at]} alt="" />
              ) : (
                <Icon name="file" size={16} />
              )}
              <button
                type="button"
                className={styles.fileOpen}
                onClick={() => setShown(at)}
                aria-label={`Preview ${file.name}`}
              >
                <b>{file.name}</b>
                <small>{sizeWords(file.size)}</small>
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, index) => index !== at))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {shown !== null && files[shown] && addresses[shown] ? (
        <FilePreview
          address={addresses[shown]}
          type={files[shown].type}
          name={files[shown].name}
          onClose={() => setShown(null)}
        />
      ) : null}
    </div>
  )
}
