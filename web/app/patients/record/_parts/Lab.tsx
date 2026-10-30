/*
 * record/_parts/Lab.tsx: the lab part of the patient's record: tests still
 * waiting, and every result, newest first (request 115).
 *
 * Why: Anthony, 2026-10-30: "The results should just be part of the
 * patient's record/med history." A result is here the moment the lab saves
 * it, for every doctor, nurse and matron who opens the record. Request lab
 * opens with this patient already chosen.
 *
 * A result with an attached printout (slice 2) has an "Open attached file"
 * button; the Worker asks the database before it hands the file over.
 *
 * Never: show a result anywhere outside the opened record. Opening the
 * record is what puts the reading in the activity log.
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Line from './Line'
import Section, { EmptyLine } from './Section'
import styles from './record.module.css'
import { STATUS_WORDS, loadPatientLab, type LabRequest, type LabResult } from '@/lib/lab/lab'
import { when } from '@/lib/record/record'
import { openFile } from '@/lib/lab/files'

export default function LabSection({
  client,
  patientId,
}: {
  client: SupabaseClient
  patientId: number
}) {
  // fresh: a test is waiting, or a result came in within a day. Then the
  // section opens by itself.
  const [lab, setLab] = useState<{
    results: LabResult[]
    open: LabRequest[]
    fresh: boolean
  } | null>(null)

  useEffect(() => {
    let current = true
    loadPatientLab(client, patientId).then((found) => {
      if (!current) return
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000
      const fresh =
        found.open.length > 0 ||
        found.results.some((result) => new Date(result.recorded_at).getTime() > dayAgo)
      setLab({ ...found, fresh })
    })
    return () => {
      current = false
    }
  }, [client, patientId])

  const count = lab ? lab.results.length + lab.open.length : undefined
  const fresh = Boolean(lab?.fresh)

  // Arriving from "Lab results ready" (the address ends #lab): bring the
  // section into view once it has loaded.
  useEffect(() => {
    if (lab && window.location.hash === '#lab') {
      document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [lab])

  return (
    <div id="lab" className={styles.anchor}>
      <Section key={fresh ? 'fresh' : 'old'} title="Lab results" count={count} open={fresh}>
        <div className={styles.actions}>
          <Link className={styles.small} href={`/lab/request/?p=${patientId}`}>
            Request lab
          </Link>
        </div>
        {lab === null ? <EmptyLine text="Loading…" /> : null}
        {lab && count === 0 ? <EmptyLine text="No lab tests yet." /> : null}

        {/* ----- Still waiting ----- */}
        {(lab?.open ?? []).map((request) => (
          <Line
            key={`open-${request.id}`}
            what={<b>{request.tests.join(', ')}</b>}
            status={
              <span className={`${styles.pill} ${styles.orange}`}>
                {STATUS_WORDS[request.status]}
              </span>
            }
            meta={`Asked by ${request.requester?.full_name ?? 'staff'} · ${when(request.requested_at)}`}
            voided={null}
          />
        ))}

        {/* ----- Results ----- */}
        {(lab?.results ?? []).map((result) => (
          <Line
            key={result.id}
            what={<b>{result.test}</b>}
            status={<span className={`${styles.pill} ${styles.green}`}>Result</span>}
            meta={`${result.recorder?.full_name ?? 'Laboratory'} · ${when(result.recorded_at)}`}
            voided={null}
          >
            <p className={styles.resultText}>{result.result}</p>
            {result.file_key ? (
              <OpenFile client={client} fileKey={result.file_key} name={result.file_name} />
            ) : null}
          </Line>
        ))}
      </Section>
    </div>
  )
}

// ===== The attached printout, opened in a new tab =====
// The database decides, through the Worker, whether this person may see it.
function OpenFile({
  client,
  fileKey,
  name,
}: {
  client: SupabaseClient
  fileKey: string
  name: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function open() {
    setBusy(true)
    setProblem(null)
    const failed = await openFile(client, fileKey)
    setBusy(false)
    setProblem(failed)
  }

  return (
    <div className={styles.actions}>
      <button className={styles.small} onClick={open} disabled={busy}>
        {busy ? 'Opening…' : `Open attached file${name ? `: ${name}` : ''}`}
      </button>
      {problem ? <span className={styles.error}>{problem}</span> : null}
    </div>
  )
}
