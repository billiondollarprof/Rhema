/*
 * app/lab/result/page.tsx: Enter results.
 *
 * Why: request 115. The lab opens a request (?r=12) and types one result
 * for each test, then taps Result ready. The results go straight into the
 * patient's record and the person who asked is alerted. With no request,
 * the lab picks the patient and types the test and result (a walk in).
 *
 * Never: show the patient's medical history here. The lab sees the
 * patient's name and number, the tests and the note, and nothing else.
 */
'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PatientPicker from '../_parts/PatientPicker'
import styles from '../_parts/lab.module.css'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import { getLabRequest, recordResults, type LabRequest } from '@/lib/lab/lab'
import type { PatientResult } from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

type Line = { test: string; result: string }

function EnterResults() {
  const auth = useAuth()
  useRightPage(auth.status, '/lab/result/')
  const params = useSearchParams()
  const requestId = Number(params.get('r')) || null
  const { client, staff } = auth

  const [request, setRequest] = useState<LabRequest | null | undefined>(undefined)
  const [walkIn, setWalkIn] = useState<PatientResult | null>(null)
  const [lines, setLines] = useState<Line[]>([{ test: '', result: '' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // ===== 1. The request, when there is one: one box per test =====
  useEffect(() => {
    if (!client || !requestId || auth.status !== 'ready') return
    let current = true
    getLabRequest(client, requestId).then((found) => {
      if (!current) return
      setRequest(found)
      if (found) setLines(found.tests.map((test) => ({ test, result: '' })))
    })
    return () => {
      current = false
    }
  }, [client, requestId, auth.status])

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 2. Save =====
  const complete = lines.every((line) => line.test.trim().length >= 2 && line.result.trim())
  const patientName = request?.patient?.full_name ?? walkIn?.full_name ?? ''
  const patientNumber = request?.patient?.patient_number ?? walkIn?.patient_number ?? ''

  async function save() {
    if (!client) return
    setBusy(true)
    setError(null)
    const problem = await recordResults(
      client,
      request ? request.id : null,
      request ? null : (walkIn?.id ?? null),
      lines.map((line) => ({ test: line.test.trim(), result: line.result.trim() })),
    )
    setBusy(false)
    if (problem) setError(problem)
    else setSaved(true)
  }

  function change(index: number, part: keyof Line, value: string) {
    setLines((all) => all.map((line, at) => (at === index ? { ...line, [part]: value } : line)))
  }

  const notLab = !staff.can_lab
  const ready = request ? request.status === 'awaiting_test' : Boolean(walkIn)

  return (
    <AppShell>
      <div className={styles.page}>
        <h2>{requestId ? 'Enter results' : 'Add a lab result'}</h2>

        {notLab ? (
          <p className={styles.muted}>Lab results are entered by the Laboratory.</p>
        ) : saved ? (
          // ----- Done -----
          <div className={styles.card}>
            <p className={styles.good}>Saved to {patientName}&apos;s record.</p>
            <p className={styles.muted}>
              {request
                ? 'The person who asked has been told the result is ready.'
                : 'Nobody was alerted, because nobody asked for it.'}
            </p>
            <div className={styles.buttons}>
              <Link className={`${styles.button} ${styles.primary}`} href="/">
                Back to the lab list
              </Link>
            </div>
          </div>
        ) : requestId && request === undefined ? (
          <p className={styles.muted}>Loading the request…</p>
        ) : requestId && request === null ? (
          <p className={styles.muted}>This request was not found.</p>
        ) : !requestId && !walkIn ? (
          <PatientPicker client={client} onPick={setWalkIn} />
        ) : (
          <div className={styles.card}>
            {/* ----- The patient, and the note from the person who asked ----- */}
            <div className={styles.sectionHead}>
              <i>
                <Icon name="lab" size={20} />
              </i>
              <div>
                <b>{patientName}</b>
                <small>
                  {patientNumber}
                  {request?.requester ? ` · asked by ${request.requester.full_name}` : ''}
                </small>
              </div>
            </div>
            {request?.note ? <p className={styles.muted}>Note: {request.note}</p> : null}
            {request && request.status === 'awaiting_payment' ? (
              <p className={styles.error}>
                This test has not been paid for yet. Ask the Front Desk.
              </p>
            ) : null}
            {request && request.status === 'completed' ? (
              <p className={styles.good}>These results are already in the record.</p>
            ) : null}

            {/* ----- One box per test ----- */}
            {ready
              ? lines.map((line, index) => (
                  <div key={index} className={styles.result}>
                    {request ? (
                      <b>{line.test}</b>
                    ) : (
                      <input
                        className={styles.input}
                        aria-label="Test"
                        placeholder="Test, e.g. Malaria test"
                        maxLength={80}
                        value={line.test}
                        onChange={(event) => change(index, 'test', event.target.value)}
                      />
                    )}
                    <textarea
                      className={styles.input}
                      aria-label={`Result for ${line.test || 'this test'}`}
                      placeholder="Result"
                      maxLength={5000}
                      value={line.result}
                      onChange={(event) => change(index, 'result', event.target.value)}
                    />
                  </div>
                ))
              : null}
            {ready && !request ? (
              <button
                className={styles.button}
                onClick={() => setLines((all) => [...all, { test: '', result: '' }])}
                disabled={lines.length >= 20}
              >
                Add another test
              </button>
            ) : null}

            {error ? <p className={styles.error}>{error}</p> : null}
            {ready ? (
              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={save}
                disabled={!complete || busy}
              >
                {busy ? 'Saving…' : 'Result ready'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  )
}

// The address is read in the browser, so the page waits for it.
export default function EnterResultsPage() {
  return (
    <Suspense fallback={null}>
      <EnterResults />
    </Suspense>
  )
}
