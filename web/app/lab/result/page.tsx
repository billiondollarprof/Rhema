/*
 * app/lab/result/page.tsx: Enter results.
 *
 * Why: request 115. The lab opens a request (?r=12) and types one result
 * for each test, then taps Result ready. The results go straight into the
 * patient's record and the person who asked is alerted. With no request,
 * the lab picks the patient and types the test and result (a walk in).
 *
 * Each test can also carry a photo or PDF of the printout (slice 2): a
 * photo is shrunk in the phone before it is sent (lib/lab/files.ts).
 *
 * A test on the lab menu (lib/lab/catalogue.ts) shows its own boxes: a
 * number with its unit and usual range, or a pick such as Negative or +.
 * They are written as plain lines of result text, with the free text box
 * kept as the comment (request 196a, 2026-11-16). A test not on the menu
 * keeps the one free text box, as before.
 *
 * Never: show the patient's medical history here. The lab sees the
 * patient's name and number, the tests and the note, and nothing else.
 */
'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Fragment, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PatientPicker from '../_parts/PatientPicker'
import styles from '../_parts/lab.module.css'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import {
  addResult,
  cancelResult,
  getLabRequest,
  loadRequestResults,
  recordResults,
  type LabRequest,
  type RequestResult,
  type ResultItem,
} from '@/lib/lab/lab'
import { LAB_SECTIONS, composeResult, findLabTest, type LabTest } from '@/lib/lab/catalogue'
import { markOf } from '@/lib/lab/ranges'
import SearchSelect, { type SelectOption } from '@/components/options/SearchSelect'
import { addOption } from '@/lib/options/options'
import { choiceKey, loadAddedChoices, saveAddedChoice } from '@/lib/lab/addedChoices'

// Every test on the lab menu, under its section, for a walk in result.
const MENU_OPTIONS: SelectOption[] = LAB_SECTIONS.flatMap((section) =>
  section.tests.map((test) => ({
    value: test.name,
    label: test.name,
    group: section.name,
    also: test.also,
  })),
)
import { prepareFile, sizeWords, uploadFile, type ReadyFile } from '@/lib/lab/files'
import type { PatientResult } from '@/lib/patients/patients'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

// file: a photo (already shrunk) or PDF chosen for this test, sent when
// Result ready is tapped.
// values: what was filled in each box of a test on the lab menu, by box name.
type Line = { test: string; result: string; values: Record<string, string>; file?: ReadyFile }

// The words saved for one test: the boxes written out, then the comment.
function resultText(line: Line): string {
  const menu = findLabTest(line.test)
  return menu ? composeResult(menu, line.values, line.result) : line.result.trim()
}

function EnterResults() {
  const auth = useAuth()
  useRightPage(auth.status, '/lab/result/')
  const params = useSearchParams()
  const requestId = Number(params.get('r')) || null
  const { client, staff } = auth

  const [request, setRequest] = useState<LabRequest | null | undefined>(undefined)
  const [walkIn, setWalkIn] = useState<PatientResult | null>(null)
  const [lines, setLines] = useState<Line[]>([{ test: '', result: '', values: {} }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Words the Laboratory added with Other inside a test's box, kept for
  // everybody (request 209e): "test|box" to the words.
  const [added, setAdded] = useState<Record<string, string[]>>({})
  useEffect(() => {
    if (!client || auth.status !== 'ready') return
    let current = true
    loadAddedChoices(client).then((found) => {
      if (current) setAdded(found)
    })
    return () => {
      current = false
    }
  }, [client, auth.status])

  // Save words typed with Other inside a box, then use them.
  async function addChoice(index: number, test: string, box: string, words: string) {
    setValue(index, box, words)
    if (!client) return
    const saved = await saveAddedChoice(client, test, box, words)
    if (saved) {
      const key = choiceKey(test, box)
      setAdded((all) => ({ ...all, [key]: [...(all[key] ?? []), saved] }))
    }
  }

  // ===== 1. The request, when there is one: one box per test =====
  useEffect(() => {
    if (!client || !requestId || auth.status !== 'ready') return
    let current = true
    getLabRequest(client, requestId).then((found) => {
      if (!current) return
      setRequest(found)
      if (found) setLines(found.tests.map((test) => ({ test, result: '', values: {} })))
    })
    return () => {
      current = false
    }
  }, [client, requestId, auth.status])

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 2. Save =====
  // Each test needs typed words or an attached file (or both).
  // A finished request is corrected: only the lines filled in are added,
  // and at least one is needed (request 214).
  const correcting = Boolean(request && request.status === 'completed')
  const filled = (line: Line) => line.test.trim().length >= 2 && (resultText(line) || line.file)
  const complete = correcting ? lines.some(filled) : lines.every(filled)
  // The tests still without details, named under the button (request 214:
  // "refuse and add warnings that they should add test details").
  const missing = correcting
    ? []
    : lines.filter((line) => !filled(line)).map((line) => line.test || 'A test')
  const patientName = request?.patient?.full_name ?? walkIn?.full_name ?? ''
  const patientNumber = request?.patient?.patient_number ?? walkIn?.patient_number ?? ''

  async function save() {
    if (!client) return
    setBusy(true)
    setError(null)
    // First the files, one by one; then the results that point at them.
    const items: ResultItem[] = []
    for (const line of lines) {
      if (correcting && !filled(line)) continue
      const item: ResultItem = {
        test: line.test.trim(),
        result: resultText(line) || 'See the attached file.',
      }
      if (line.file) {
        const sent = await uploadFile(client, line.file)
        if (typeof sent === 'string') {
          setBusy(false)
          setError(`${line.test}: ${sent}`)
          return
        }
        item.file_key = sent.key
        item.file_name = line.file.name
        item.file_type = line.file.type
        item.file_size = line.file.size
      }
      items.push(item)
    }
    let problem: string | null = null
    if (correcting && request) {
      // Each added or corrected result on its own.
      for (const item of items) {
        problem = await addResult(client, request.id, item)
        if (problem) break
      }
    } else {
      problem = await recordResults(
        client,
        request ? request.id : null,
        request ? null : (walkIn?.id ?? null),
        items,
      )
    }
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    setSaved(true)
  }

  function change(index: number, part: 'test' | 'result', value: string) {
    setLines((all) =>
      all.map((line, at) => {
        if (at !== index) return line
        // A new test starts with empty boxes, so one test's answer (such as
        // AA for Genotype) never shows in another test's box (request 209c).
        if (part === 'test' && value !== line.test) return { ...line, test: value, values: {} }
        return { ...line, [part]: value }
      }),
    )
  }

  function setValue(index: number, box: string, value: string) {
    setLines((all) =>
      all.map((line, at) =>
        at === index ? { ...line, values: { ...line.values, [box]: value } } : line,
      ),
    )
  }

  function setFile(index: number, file: ReadyFile | undefined) {
    setLines((all) => all.map((line, at) => (at === index ? { ...line, file } : line)))
  }

  // The patient whose results were just saved.
  const donePatientId = request ? request.patient_id : (walkIn?.id ?? null)
  const notLab = !staff.can_lab
  // A finished request can be corrected too: add a missed or corrected result.
  // Paid or not (request 232, 2026-11-20): never a cancelled one.
  const ready = request
    ? request.status === 'awaiting_test' ||
      request.status === 'awaiting_payment' ||
      request.status === 'completed'
    : Boolean(walkIn)

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
                ? `${request.requester?.full_name ?? 'The person who asked'} has been told the result is ready.`
                : 'Nobody was alerted, because nobody asked for it.'}{' '}
              Every doctor and nurse who opens the record sees it.
            </p>
            {/* ----- Send the patient on (request 209b): the patient's card
                has Send to room, so the patient goes back to the doctor or
                anywhere else. ----- */}
            <div className={styles.buttons}>
              {donePatientId ? (
                <Link
                  className={`${styles.button} ${styles.primary}`}
                  href={`/patients/?p=${donePatientId}`}
                >
                  Send patient to a room
                </Link>
              ) : null}
              <Link className={styles.button} href="/">
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
            {/* Not paid yet: the result can still be entered (request 232). */}
            {request && request.status === 'awaiting_payment' ? (
              <p className={styles.muted}>Not paid yet. The Front Desk will take the payment.</p>
            ) : null}
            {request && request.status === 'completed' ? (
              <EarlierResults client={client} requestId={request.id} />
            ) : null}

            {/* ----- One box per test ----- */}
            {ready
              ? lines.map((line, index) => (
                  <div key={index} className={styles.result}>
                    {request ? (
                      <b>{line.test}</b>
                    ) : (
                      <SearchSelect
                        id={`test-${index}`}
                        value={line.test}
                        placeholder="Choose the test"
                        options={MENU_OPTIONS}
                        onChange={(name) => change(index, 'test', name)}
                        onOther={(typed) => {
                          change(index, 'test', typed)
                          // A new test is saved for everybody (request 209a).
                          if (client && typed.trim().length >= 2)
                            void addOption(client, 'lab_test', typed.trim(), true)
                        }}
                      />
                    )}
                    {findLabTest(line.test) ? (
                      <ResultBoxes
                        test={findLabTest(line.test) as LabTest}
                        at={index}
                        values={line.values}
                        added={added}
                        onChange={(box, value) => setValue(index, box, value)}
                        onAdd={(box, words) => addChoice(index, line.test, box, words)}
                      />
                    ) : null}
                    <textarea
                      className={styles.input}
                      aria-label={
                        findLabTest(line.test)
                          ? `Comment for ${line.test}`
                          : `Result for ${line.test || 'this test'}`
                      }
                      placeholder={
                        findLabTest(line.test)
                          ? 'Comment (optional)'
                          : line.file
                            ? 'Result (optional with a file)'
                            : 'Result'
                      }
                      maxLength={5000}
                      value={line.result}
                      onChange={(event) => change(index, 'result', event.target.value)}
                    />
                    <AttachFile
                      label={line.test || 'this test'}
                      file={line.file}
                      onChange={(file) => setFile(index, file)}
                    />
                  </div>
                ))
              : null}
            {ready && !request ? (
              <button
                className={styles.button}
                onClick={() => setLines((all) => [...all, { test: '', result: '', values: {} }])}
                disabled={lines.length >= 20}
              >
                Add another test
              </button>
            ) : null}

            {error ? <p className={styles.error}>{error}</p> : null}
            {ready && missing.length > 0 ? (
              <p className={styles.warning}>
                Add the details for {missing.join(', ')} before Result ready.
              </p>
            ) : null}
            {ready ? (
              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={save}
                disabled={!complete || busy}
              >
                {busy ? 'Saving…' : correcting ? 'Add to the record' : 'Result ready'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  )
}

// ===== 3. The boxes for one test on the lab menu =====
// A pick list for a box with choices; a number box with its unit and usual
// range; a short line of text for anything else.
function ResultBoxes({
  test,
  at,
  values,
  added,
  onChange,
  onAdd,
}: {
  test: LabTest
  at: number
  values: Record<string, string>
  added: Record<string, string[]>
  onChange: (box: string, value: string) => void
  onAdd: (box: string, words: string) => void
}) {
  // Picks where "Other" was chosen with nothing typed: they show a box to
  // type in, until "Back to the list" (request 202: "we always include Other").
  const [typing, setTyping] = useState<string[]>([])

  return (
    <div className={styles.fields}>
      {/* The test's fixed note, such as the Widal significant titre value. */}
      {test.note ? (
        <div className={styles.testNote}>
          <b>{test.note.heading}</b>
          <span>{test.note.text}</span>
        </div>
      ) : null}
      {test.fields.map((field, place) => {
        const id = `box-${at}-${place}`
        const value = values[field.name] ?? ''
        const typed = typing.includes(field.name)
        return (
          <Fragment key={field.name}>
            {field.heading ? <b className={styles.fieldsHeading}>{field.heading}</b> : null}
            <div className={styles.field}>
              <label htmlFor={id}>{field.name}</label>
              {field.choices && !typed ? (
                <SearchSelect
                  id={id}
                  value={value}
                  options={[
                    ...field.choices,
                    ...(added[choiceKey(test.name, field.name)] ?? []).filter(
                      (word) => !field.choices?.includes(word),
                    ),
                  ].map((choice) => ({ value: choice, label: choice }))}
                  onChange={(next) => onChange(field.name, next)}
                  onOther={(words) => {
                    // Typed words are kept for this box, for everybody.
                    if (words) onAdd(field.name, words)
                    else setTyping([...typing, field.name])
                  }}
                />
              ) : (
                <div className={styles.unit}>
                  <input
                    id={id}
                    className={styles.input}
                    inputMode={field.unit && !field.choices ? 'decimal' : undefined}
                    maxLength={200}
                    value={value}
                    autoFocus={typed}
                    onChange={(event) => onChange(field.name, event.target.value)}
                    onBlur={() => {
                      // Words typed after Other are kept for this box.
                      if (typed && value.trim()) onAdd(field.name, value.trim())
                    }}
                  />
                  {field.unit && !field.choices ? <span>{field.unit}</span> : null}
                </div>
              )}
              {typed ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setTyping(typing.filter((name) => name !== field.name))}
                >
                  Back to the list
                </button>
              ) : null}
              {field.range ? <small>Normal: {field.range}</small> : null}
              {/* Out of range as it is typed (request 219c, number 3), so a
                  slip of the finger shows at once. Ranges for men and women
                  are marked in the record, where the patient's sex is known. */}
              {field.range && markOf(`${field.name}: ${value} (normal ${field.range})`, null) ? (
                <small className={styles.outOfRange}>
                  {markOf(`${field.name}: ${value} (normal ${field.range})`, null) === 'high'
                    ? '↑ Above the normal range'
                    : '↓ Below the normal range'}
                </small>
              ) : null}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

// ===== 4. Attach a photo or PDF to one test =====
// The photo is shrunk straight away, so the size shown is what will be sent.
function AttachFile({
  label,
  file,
  onChange,
}: {
  label: string
  file: ReadyFile | undefined
  onChange: (file: ReadyFile | undefined) => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function chosen(picked: File | undefined) {
    if (!picked) return
    setBusy(true)
    setProblem(null)
    const ready = await prepareFile(picked)
    setBusy(false)
    if (typeof ready === 'string') setProblem(ready)
    else onChange(ready)
  }

  if (file) {
    return (
      <div className={styles.attached}>
        <span>
          Attached: {file.name} · {sizeWords(file.size)}
        </span>
        <button className={styles.button} onClick={() => onChange(undefined)}>
          Remove
        </button>
      </div>
    )
  }
  return (
    <>
      <label className={styles.attach}>
        {busy ? 'Preparing…' : 'Attach photo or PDF'}
        <input
          type="file"
          accept="image/*,application/pdf"
          aria-label={`Attach a photo or PDF for ${label}`}
          disabled={busy}
          onChange={(event) => {
            void chosen(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>
      {problem ? <p className={styles.error}>{problem}</p> : null}
    </>
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

// ===== 5. Results already on a finished request, each can be cancelled =====
// A wrong result is cancelled with a reason; it stays in the record crossed
// out. The correct one is added with the boxes below (request 214).
function EarlierResults({ client, requestId }: { client: SupabaseClient; requestId: number }) {
  const [results, setResults] = useState<RequestResult[] | null>(null)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    loadRequestResults(client, requestId).then((found) => {
      if (current) setResults(found)
    })
    return () => {
      current = false
    }
  }, [client, requestId])

  async function cancel(id: number) {
    const answer = await cancelResult(client, id, reason)
    if (answer) {
      setProblem(answer)
      return
    }
    setCancelling(null)
    setReason('')
    setProblem(null)
    setResults(await loadRequestResults(client, requestId))
  }

  return (
    <div className={styles.earlier}>
      <p className={styles.good}>
        These results are in the record. To correct one, cancel it with a reason, then add the right
        one below.
      </p>
      {results === null ? <p className={styles.muted}>Loading the results…</p> : null}
      {(results ?? []).map((line) => (
        <div key={line.id} className={styles.earlierLine}>
          <div className={line.voided_at ? styles.cancelled : undefined}>
            <b>{line.test}</b>
            <span className={styles.resultLines}>{line.result}</span>
            {line.voided_at ? <small>Cancelled: {line.void_reason}</small> : null}
          </div>
          {!line.voided_at && cancelling !== line.id ? (
            <button className={styles.button} onClick={() => setCancelling(line.id)}>
              Cancel this result
            </button>
          ) : null}
          {cancelling === line.id ? (
            <div className={styles.row}>
              <input
                className={styles.input}
                aria-label={`Why ${line.test} is cancelled`}
                placeholder="Why, e.g. wrong sample read"
                maxLength={300}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <button className={styles.button} onClick={() => cancel(line.id)}>
                Cancel it
              </button>
              <button className={styles.button} onClick={() => setCancelling(null)}>
                Keep
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {problem ? <p className={styles.error}>{problem}</p> : null}
    </div>
  )
}
