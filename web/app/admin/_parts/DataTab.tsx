/*
 * app/admin/_parts/DataTab.tsx: "Data" tab: download our data. The admin downloads everything
 * the hospital holds, in one ZIP file.
 *
 * Why: Anthony, 2026-11-16 (requests 206 and 217a): "at any point in time,
 * the hospital can decide, okay, they want their data."
 *
 * How it goes:
 *   1. The admin reads the warning and taps "Download our data".
 *   2. They type their PIN again. The database checks it, and writes the
 *      download in the activity log.
 *   3. The browser saves one file: a spreadsheet for each part of the
 *      records, and every uploaded file.
 *
 * Never: keep a copy, or send it anywhere but the admin's own device.
 */
'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import PinCheck from './PinCheck'
import styles from './admin.module.css'
import { downloadOurData } from '@/lib/export/export'

export default function DataTab({ client }: { client: SupabaseClient }) {
  const [asking, setAsking] = useState(false)
  const [words, setWords] = useState<string | null>(null)

  return (
    <div className={styles.split}>
      {/* ===== 1. What it is, and the warning ===== */}
      <div className={styles.card}>
        <h3>Download our data</h3>
        <p className={styles.muted}>
          One ZIP file with everything the hospital holds: patients, visits, notes, vital signs,
          medicines, lab results, payments and staff, as spreadsheets that open in Excel. The scans,
          photos and lab result files are in it too.
        </p>
        <p className={styles.error}>
          This file holds every patient. Keep it on a hospital device and never share it.
        </p>
        <p className={styles.muted}>
          You type your PIN again, and the download is written in Activity.
        </p>
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={() => {
              setWords(null)
              setAsking(true)
            }}
          >
            Download our data
          </button>
        </div>
        {words ? <p className={styles.good}>{words}</p> : null}
      </div>

      {/* ===== 2. The PIN, then the download ===== */}
      {asking ? (
        <PinCheck
          title="Download our data?"
          explain="The file is saved on this device. It can take a minute when there are many files."
          action="Download"
          serious={false}
          run={(pin) => downloadOurData(client, pin, setWords)}
          onDone={() => setAsking(false)}
          onCancel={() => setAsking(false)}
        />
      ) : null}
    </div>
  )
}
