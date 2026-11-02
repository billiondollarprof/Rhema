/*
 * app/patients/old-file/page.tsx: Register from old file.
 *
 * Why: request 128 (Anthony, 2026-11-02), for the patients the hospital
 * already has on paper: "they will just put the patient name, the full name
 * and the phone number. Then they will now upload the patient's documents
 * there." The old card number is not used; the patient gets their own RMC
 * number like everybody else. One patient at a time, never in batches.
 *
 * In order:
 *   1. the Front Desk types the full name and the phone number, adds the
 *      date of birth and sex if the old file has them (optional, 2026-11-02),
 *      and picks the scans and PDFs of the old file;
 *   2. if a patient with this phone number is already registered, they see
 *      them first and can use that patient instead (a family may share a
 *      phone, so "register a new patient" stays possible);
 *   3. the patient is saved, then each file is sent and recorded. A file
 *      that fails can be sent again without saving the patient twice.
 *
 * Never: register silently over a patient with the same phone. Never show
 * the old file's contents here: only somebody with the medical record may
 * open it.
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import FilePicker from '../_parts/FilePicker'
import styles from '../_parts/patients.module.css'
import { lastSeenWords } from '../_parts/PatientDetail'
import type { ReadyFile } from '@/lib/files/files'
import { attachFiles } from '@/lib/patients/patientFiles'
import {
  cleanPhone,
  findSamePhone,
  phoneLooksRight,
  registerFromOldFile,
  type PatientCard,
  type PatientResult,
  type Sex,
} from '@/lib/patients/patients'
import { ageFrom } from '@/lib/patients/age'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

export default function OldFilePage() {
  const auth = useAuth()
  useRightPage(auth.status, '/patients/old-file/')
  const router = useRouter()
  const { client, staff } = auth

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  // Optional: only if the old file has them.
  const [born, setBorn] = useState('')
  const [sex, setSex] = useState<Sex | null>(null)
  const [files, setFiles] = useState<ReadyFile[]>([])
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [matches, setMatches] = useState<PatientResult[]>([])
  const [saved, setSaved] = useState<PatientCard | null>(null)
  const [failed, setFailed] = useState<ReadyFile[]>([])
  const [sentCount, setSentCount] = useState(0)

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 1. What is wrong with what was typed =====
  const cleanedPhone = cleanPhone(phone)
  const nameWrong = name.trim().length < 2 ? 'Type the full name.' : null
  const phoneWrong = !phoneLooksRight(cleanedPhone)
    ? 'Type an 11 digit phone number, like 08031234567.'
    : null
  const filesWrong = files.length === 0 ? 'Add the old file.' : null
  const bornWrong =
    born && new Date(born) > new Date() ? 'The date of birth cannot be in the future.' : null

  // ===== 2. Send the files for a saved patient =====
  async function sendFiles(patient: PatientCard, list: ReadyFile[]) {
    if (!client) return
    setProgress(`Sending file 1 of ${list.length}…`)
    const notSent = await attachFiles(client, patient.id, list, (done) =>
      setProgress(done < list.length ? `Sending file ${done + 1} of ${list.length}…` : null),
    )
    setProgress(null)
    setSentCount((count) => count + list.length - notSent.length)
    setFailed(notSent)
  }

  // ===== 3. Save: look for the same phone first =====
  async function save(skipCheck = false) {
    setTried(true)
    if (!client || !staff || nameWrong || phoneWrong || filesWrong || bornWrong) return
    setBusy(true)
    setProblem(null)
    if (!skipCheck) {
      const found = await findSamePhone(client, cleanedPhone)
      if (found.length > 0) {
        setBusy(false)
        setMatches(found)
        return
      }
    }
    setMatches([])
    const result = await registerFromOldFile(
      client,
      name,
      cleanedPhone,
      staff.id,
      born || null,
      sex,
    )
    if (result.problem || !result.patient) {
      setBusy(false)
      setProblem(result.problem)
      return
    }
    setSaved(result.patient)
    await sendFiles(result.patient, files)
    setBusy(false)
  }

  function startAgain() {
    setName('')
    setPhone('')
    setBorn('')
    setSex(null)
    setFiles([])
    setTried(false)
    setSaved(null)
    setFailed([])
    setSentCount(0)
    setProblem(null)
  }

  // ===== 4. After saving: the number, and the files =====
  if (saved) {
    return (
      <AppShell>
        <div className={styles.page}>
          <div className={styles.head}>
            <h2>Patient registered</h2>
          </div>
          <div className={styles.ok}>
            <Icon name="file" size={22} />
            <div>
              <small className={styles.muted}>Patient number</small>
              <br />
              <b>{saved.patient_number}</b>
            </div>
          </div>
          <p className={styles.muted}>
            {saved.full_name} · {saved.phone}
          </p>
          {progress ? <p className={styles.muted}>{progress}</p> : null}
          {!progress ? (
            <p className={failed.length ? styles.error : styles.muted}>
              {sentCount === 1 ? '1 file attached.' : `${sentCount} files attached.`}
              {failed.length
                ? ` ${failed.length} not sent. Check the network and try again.`
                : ''}
            </p>
          ) : null}
          <div className={styles.buttons}>
            {failed.length && !progress ? (
              <button
                className={`${styles.button} ${styles.primary}`}
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await sendFiles(saved, failed)
                  setBusy(false)
                }}
              >
                Try again
              </button>
            ) : null}
            <button className={styles.button} disabled={busy} onClick={startAgain}>
              Register another old file
            </button>
            <Link className={styles.button} href={`/patients/?p=${saved.id}`}>
              Open patient
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.head}>
          <h2>Register from old file</h2>
          <Link className={styles.button} href="/patients/register/">
            <Icon name="reg" size={16} /> Register patient
          </Link>
        </div>

        {/* ===== 5. A patient with this phone number already ===== */}
        {matches.length > 0 ? (
          <div className={styles.warn} role="alert">
            <b>This phone number is already registered</b>
            <p className={styles.muted}>
              Use this patient, unless it is someone else on the same phone.
            </p>
            {matches.map((match) => (
              <div
                key={match.id}
                className={`${styles.result} ${styles.match}`}
                style={{ cursor: 'default' }}
              >
                <div>
                  <b>{match.full_name}</b>
                  <small>
                    {match.patient_number} · {match.phone}
                  </small>
                  <small>Last seen: {lastSeenWords(match.last_seen)}</small>
                </div>
                <button
                  className={`${styles.button} ${styles.primary}`}
                  onClick={() => router.push(`/patients/?p=${match.id}`)}
                >
                  Use this patient
                </button>
              </div>
            ))}
            <div className={styles.buttons}>
              <button className={styles.button} disabled={busy} onClick={() => save(true)}>
                No, register a new patient
              </button>
            </div>
          </div>
        ) : null}

        {/* ===== 6. Name, phone, and the old file ===== */}
        <div className={styles.card}>
          <div className={styles.field}>
            <label htmlFor="old-name">Full name</label>
            <input
              id="old-name"
              className={styles.input}
              maxLength={120}
              autoComplete="off"
              value={name}
              aria-invalid={tried && nameWrong ? 'true' : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            {tried && nameWrong ? <small className={styles.error}>{nameWrong}</small> : null}
          </div>
          <div className={styles.field}>
            <label htmlFor="old-phone">Phone number</label>
            <input
              id="old-phone"
              className={styles.input}
              inputMode="tel"
              autoComplete="off"
              placeholder="08031234567"
              value={phone}
              aria-invalid={tried && phoneWrong ? 'true' : undefined}
              onChange={(event) => setPhone(event.target.value)}
            />
            {tried && phoneWrong ? <small className={styles.error}>{phoneWrong}</small> : null}
          </div>
          <div className={styles.fields2}>
            <div className={styles.field}>
              <label htmlFor="old-born">Date of birth (optional)</label>
              <input
                id="old-born"
                type="date"
                className={styles.input}
                max={new Date().toISOString().slice(0, 10)}
                value={born}
                aria-invalid={bornWrong ? 'true' : undefined}
                onChange={(event) => setBorn(event.target.value)}
              />
              {bornWrong ? <small className={styles.error}>{bornWrong}</small> : null}
              {born && !bornWrong ? (
                <small className={styles.hint}>Age: {ageFrom(born)}</small>
              ) : null}
            </div>
            <div className={styles.field}>
              <label>Sex (optional)</label>
              <div className={styles.segments} role="group" aria-label="Sex">
                {(['female', 'male'] as Sex[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={sex === value}
                    onClick={() => setSex(sex === value ? null : value)}
                  >
                    {value === 'female' ? 'Female' : 'Male'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldTitle}>Old file</span>
            <FilePicker files={files} onChange={setFiles} disabled={busy} />
            {tried && filesWrong ? <small className={styles.error}>{filesWrong}</small> : null}
          </div>
          {problem ? <p className={styles.error}>{problem}</p> : null}
          <div className={styles.buttons}>
            <button
              className={`${styles.button} ${styles.primary}`}
              disabled={busy}
              onClick={() => save()}
            >
              {busy ? 'Saving…' : 'Save patient'}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
