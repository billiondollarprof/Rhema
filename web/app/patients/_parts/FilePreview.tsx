/*
 * app/patients/_parts/FilePreview.tsx: a file shown inside the app, so
 * staff can check it is the right document (request 128, 2026-11-02:
 * "when you click on what you've uploaded, you can at least preview it").
 *
 * A picture shows as it is. A PDF shows in the browser's own reader with
 * its toolbar hidden. Closes with the X, the Esc key, or a tap outside.
 *
 * Never: offer a download here. Download lives in the medical record.
 */
'use client'

import { useEffect } from 'react'
import styles from './patients.module.css'

export default function FilePreview({
  address,
  type,
  name,
  onClose,
}: {
  // A local address for the file (URL.createObjectURL).
  address: string
  type: string
  name: string
  onClose: () => void
}) {
  // Esc closes it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.preview} role="dialog" aria-label={name} onClick={onClose}>
      <div className={styles.previewBox} onClick={(event) => event.stopPropagation()}>
        <div className={styles.previewTop}>
          <b>{name}</b>
          <button className={styles.previewClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {type === 'application/pdf' ? (
          <iframe className={styles.previewPdf} src={`${address}#toolbar=0`} title={name} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.previewImage} src={address} alt={name} />
        )}
      </div>
    </div>
  )
}
