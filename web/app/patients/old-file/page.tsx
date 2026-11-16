/*
 * app/patients/old-file/page.tsx: Register from old file.
 *
 * Why: request 128 (Anthony, 2026-11-02), for the patients the hospital
 * already has on paper: "they will just put the patient name, the full name
 * and the phone number. Then they will now upload the patient's documents
 * there." The old card number is not used; the patient gets their own RMC
 * number like everybody else. One patient at a time, never in batches.
 *
 * 2026-11-10: only the name is needed. Anthony: "Phone number and date of
 * birth should not be compulsory for old files only because they do not
 * have such data currently... Name of patient is enough, the rest says
 * (optional), including attachment of file." A phone number that is typed
 * must still be 11 digits. New patients (Register patient) need them all.
 *
 * In order:
 *   1. the Front Desk types the full name, and the phone number, date of
 *      birth, sex and the scans and PDFs of the old file if they have them;
 *   2. if a phone number is typed and a patient with it is already
 *      registered, they see
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
import OptionSelect from '@/components/options/OptionSelect'
import styles from '../_parts/patients.module.css'
import { lastSeenWords } from '../_parts/PatientDetail'
import type { ReadyFile } from '@/lib/files/files'
import { attachFiles } from '@/lib/patients/patientFiles'
import {
  cleanPhone,
  findSamePhone,
  phoneLooksRight,
  registerFromOldFile,
  type Category,
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
  // The front desk asked for it (2026-11-16): individual, family or antenatal.
  const [category, setCategory] = useState<Category>('individual')
  // The rest of the card, folded away until somebody opens it (2026-11-16).
  const [more, setMore] = useState({
    email: '',
    address: '',
    town: '',
    lga: '',
    state: '',
    kinName: '',
    kinRelationship: '',
    kinPhone: '',
  })
  const setMorePart = (key: keyof typeof more) => (value: string) =>
    setMore({ ...more, [key]: value })
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

  // Only the Front Desk registers patients (Anthony, 2026-11-10).
  if (staff.role !== 'front_desk') {
    return (
      <AppShell>
        <div className={styles.page}>
          <p className={styles.muted}>Only the Front Desk registers patients.</p>
          <Link className={styles.button} href="/patients/">
            Find patient
          </Link>
        </div>
      </AppShell>
    )
  }

  // ===== 1. What is wrong with what was typed =====
  const cleanedPhone = cleanPhone(phone)
  const nameWrong = name.trim().length < 2 ? 'Type the full name.' : null
  // Optional: wrong only when something is typed and it is not 11 digits.
  const phoneWrong =
    cleanedPhone !== '' && !phoneLooksRight(cleanedPhone)
      ? 'Type an 11 digit phone number, like 08031234567.'
      : null
  const kinPhone = cleanPhone(more.kinPhone)
  const kinPhoneWrong =
    kinPhone !== '' && !phoneLooksRight(kinPhone)
      ? 'Type an 11 digit phone number, like 08031234567.'
      : null
  const emailWrong =
    more.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(more.email.trim())
      ? 'Check the email.'
      : null
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
    if (!client || !staff || nameWrong || phoneWrong || bornWrong || kinPhoneWrong || emailWrong)
      return
    setBusy(true)
    setProblem(null)
    if (!skipCheck && cleanedPhone !== '') {
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
      cleanedPhone || null,
      staff.id,
      born || null,
      sex,
      category,
      {
        email: more.email.trim().toLowerCase() || null,
        address: more.address.trim() || null,
        town: more.town || null,
        lga: more.lga || null,
        state: more.state || null,
        next_of_kin_name: more.kinName.trim() || null,
        next_of_kin_relationship: more.kinRelationship || null,
        next_of_kin_phone: kinPhone || null,
      },
    )
    if (result.problem || !result.patient) {
      setBusy(false)
      setProblem(result.problem)
      return
    }
    setSaved(result.patient)
    if (files.length > 0) await sendFiles(result.patient, files)
    setBusy(false)
  }

  function startAgain() {
    setName('')
    setPhone('')
    setBorn('')
    setSex(null)
    setCategory('individual')
    setMore({
      email: '',
      address: '',
      town: '',
      lga: '',
      state: '',
      kinName: '',
      kinRelationship: '',
      kinPhone: '',
    })
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
            {saved.phone ? `${saved.full_name} · ${saved.phone}` : saved.full_name}
          </p>
          {progress ? <p className={styles.muted}>{progress}</p> : null}
          {!progress ? (
            <p className={failed.length ? styles.error : styles.muted}>
              {sentCount === 0 && failed.length === 0
                ? 'No file attached.'
                : sentCount === 1
                  ? '1 file attached.'
                  : `${sentCount} files attached.`}
              {failed.length
                ? ` ${failed.length === 1 ? '1 file was' : `${failed.length} files were`} not sent. Check the network and try again.`
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
            <label htmlFor="old-phone">Phone number (optional)</label>
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
            <label>Patient category</label>
            <div className={styles.segments} role="group" aria-label="Patient category">
              {(
                [
                  ['individual', 'Individual'],
                  ['family', 'Family'],
                  ['antenatal', 'Antenatal'],
                ] as [Category, string][]
              ).map(([value, words]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                >
                  {words}
                </button>
              ))}
            </div>
          </div>
          {/* ===== More details, folded (2026-11-16) ===== */}
          <details className={styles.more}>
            <summary>More details (optional): address, next of kin, email</summary>
            <div className={styles.field}>
              <label htmlFor="old-address">Address</label>
              <input
                id="old-address"
                className={styles.input}
                maxLength={200}
                value={more.address}
                onChange={(event) => setMorePart('address')(event.target.value)}
              />
            </div>
            <div className={styles.fields2}>
              <div className={styles.field}>
                <label htmlFor="old-town">Town / City</label>
                <OptionSelect
                  client={client}
                  staffId={staff.id}
                  list="town"
                  id="old-town"
                  value={more.town}
                  onChange={setMorePart('town')}
                  placeholder="Choose the town"
                  otherLabel="Type the town"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="old-lga">Local government (LGA)</label>
                <OptionSelect
                  client={client}
                  staffId={staff.id}
                  list="lga"
                  id="old-lga"
                  value={more.lga}
                  onChange={setMorePart('lga')}
                  placeholder="Choose the local government"
                  otherLabel="Type the local government"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="old-state">State</label>
                <OptionSelect
                  client={client}
                  staffId={staff.id}
                  list="state"
                  id="old-state"
                  value={more.state}
                  onChange={setMorePart('state')}
                  placeholder="Choose the State"
                  otherLabel="Type the State"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="old-email">Email</label>
                <input
                  id="old-email"
                  className={styles.input}
                  type="email"
                  inputMode="email"
                  value={more.email}
                  aria-invalid={tried && emailWrong ? 'true' : undefined}
                  onChange={(event) => setMorePart('email')(event.target.value)}
                />
                {tried && emailWrong ? <small className={styles.error}>{emailWrong}</small> : null}
              </div>
            </div>
            <span className={styles.fieldTitle}>Next of kin</span>
            <div className={styles.fields2}>
              <div className={styles.field}>
                <label htmlFor="old-kin-name">Full name</label>
                <input
                  id="old-kin-name"
                  className={styles.input}
                  maxLength={120}
                  value={more.kinName}
                  onChange={(event) => setMorePart('kinName')(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="old-kin-relationship">Relationship</label>
                <OptionSelect
                  client={client}
                  staffId={staff.id}
                  list="relationship"
                  id="old-kin-relationship"
                  value={more.kinRelationship}
                  onChange={setMorePart('kinRelationship')}
                  placeholder="Choose the relationship"
                  otherLabel="Type the relationship"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="old-kin-phone">Phone</label>
                <input
                  id="old-kin-phone"
                  className={styles.input}
                  inputMode="tel"
                  placeholder="08031234567"
                  value={more.kinPhone}
                  aria-invalid={tried && kinPhoneWrong ? 'true' : undefined}
                  onChange={(event) => setMorePart('kinPhone')(event.target.value)}
                />
                {tried && kinPhoneWrong ? (
                  <small className={styles.error}>{kinPhoneWrong}</small>
                ) : null}
              </div>
            </div>
          </details>
          <div className={styles.field}>
            <span className={styles.fieldTitle}>Old file (optional)</span>
            <FilePicker files={files} onChange={setFiles} disabled={busy} />
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
