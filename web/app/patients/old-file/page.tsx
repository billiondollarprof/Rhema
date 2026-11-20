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
 * Antenatal and Family (request 227o, 2026-11-19): choosing Antenatal shows
 * the antenatal card's details (saved into the antenatal booking); a Family
 * patient gets "Add family member" after saving, which starts the family
 * and opens a fresh old file form that joins it (?family=12).
 *
 * Category first (request 228b, 2026-11-20), as on Register patient: a drop
 * down at the top. Family shows the Family details card, then Add family
 * member opens this old file form for the first member, with the family's
 * address; Save registers the family and that member together.
 *
 * Never: register silently over a patient with the same phone. Never show
 * the old file's contents here: only somebody with the medical record may
 * open it.
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import Icon from '@/components/shell/Icon'
import FilePicker from '../_parts/FilePicker'
import FamilyDetailsForm, { checkFamily, tidyFamily } from '../_parts/FamilyDetailsForm'
import OptionSelect from '@/components/options/OptionSelect'
import SearchSelect from '@/components/options/SearchSelect'
import styles from '../_parts/patients.module.css'
import { lastSeenWords } from '../_parts/PatientDetail'
import type { ReadyFile } from '@/lib/files/files'
import { attachFiles } from '@/lib/patients/patientFiles'
import {
  ANTENATAL_EDUCATION,
  ANTENATAL_MARITAL,
  ANTENATAL_RELIGION,
  cleanPhone,
  EMPTY_FAMILY,
  familyNumber,
  findSamePhone,
  loadFamily,
  phoneLooksRight,
  registerFamily,
  registerFromOldFile,
  type Family,
  type FamilyDetails,
  saveAntenatalDetails,
  startFamily,
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
  // 2026-11-20 (request 228b): chosen first, in a drop down; empty until then.
  const [category, setCategory] = useState<Category | ''>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('family')
      ? 'family'
      : '',
  )
  // A new family: its details, what is wrong with them, whether the first
  // member's form is open, and the family once saved (request 228b).
  const [family, setFamily] = useState<FamilyDetails>(EMPTY_FAMILY)
  const [familyShown, setFamilyShown] = useState<Record<string, string>>({})
  const [addingMember, setAddingMember] = useState(false)
  const [savedFamily, setSavedFamily] = useState<Family | null>(null)
  // The month the old file was first opened (Anthony, 2026-11-16: "they're
  // registering the patients month by month"). Kept after Register another,
  // because the next file is usually from the same month.
  const [month, setMonth] = useState('')
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

  // ===== 0a. The antenatal card's details (request 227o, 2026-11-19: "when
  // the person selects antenatal, did the person have the extra field...").
  // Saved into the antenatal booking, as on Register patient. =====
  const emptyAntenatal = {
    client_marital_status: '',
    client_religion: '',
    client_education: '',
    client_occupation: '',
    kin_occupation: '',
    kin_religion: '',
    kin_education: '',
    kin_age: '',
  }
  const [antenatal, setAntenatal] = useState(emptyAntenatal)
  const setAnte = (key: keyof typeof emptyAntenatal) => (value: string) =>
    setAntenatal((now) => ({ ...now, [key]: value }))

  // ===== 0b. A family started on another old file (request 227o: "adding
  // extra family members on the register from old file"). The address says
  // which family (?family=12); this patient joins it. =====
  const [familyId, setFamilyId] = useState<number | null>(() =>
    typeof window === 'undefined'
      ? null
      : Number(new URLSearchParams(window.location.search).get('family')) || null,
  )
  const [familyCard, setFamilyCard] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const newFamily = !familyId && category === 'family'
  useEffect(() => {
    if (!client || !familyId) return
    let current = true
    void familyNumber(client, familyId).then((found) => {
      if (current) setFamilyCard(found)
    })
    return () => {
      current = false
    }
  }, [client, familyId])

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
    if (!category) return
    // A new family: the family name must be there (request 228b).
    if (newFamily) {
      const wrong = checkFamily(family)
      setFamilyShown(wrong)
      if (Object.keys(wrong).length > 0) {
        setProblem('Fill in the family details first.')
        document.getElementById(`family-${Object.keys(wrong)[0]}`)?.focus()
        return
      }
    }
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
    const extras = {
      email: more.email.trim().toLowerCase() || null,
      address: more.address.trim() || null,
      town: more.town || null,
      lga: more.lga || null,
      state: more.state || null,
      next_of_kin_name: more.kinName.trim() || null,
      next_of_kin_relationship: more.kinRelationship || null,
      next_of_kin_phone: kinPhone || null,
      first_registered_on: month ? `${month}-01` : null,
    }
    // A new family: the family and this first member, saved together.
    const result = newFamily
      ? await registerFamily(
          client,
          tidyFamily(family),
          {
            full_name: name.trim().replace(/\s+/g, ' '),
            phone: cleanedPhone || null,
            date_of_birth: born || null,
            sex,
            ...extras,
            from_old_file: true,
          },
          staff.id,
          // Its files need the network, so it does not wait on the device.
          false,
        )
      : await registerFromOldFile(
          client,
          name,
          cleanedPhone || null,
          staff.id,
          born || null,
          sex,
          category,
          {
            ...extras,
            ...(familyId && category === 'family' ? { family_id: familyId } : {}),
          },
        )
    const newFamilyId = 'familyId' in result ? (result.familyId as number | null) : null
    if (newFamilyId) {
      const found = await loadFamily(client, newFamilyId)
      setSavedFamily(found)
      setFamilyCard(found?.family_number ?? null)
    }
    if (result.problem || !result.patient) {
      setBusy(false)
      setProblem(result.problem)
      return
    }
    // The antenatal card's details go into the booking (request 227o).
    if (category === 'antenatal') {
      const typed = Object.fromEntries(
        Object.entries(antenatal).map(([key, value]) => [
          key,
          key === 'kin_age' ? (value ? Number(value) : null) : value.trim() || null,
        ]),
      )
      const problem = await saveAntenatalDetails(client, result.patient.id, typed)
      if (problem) setProblem(problem)
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
    setCategory(familyId ? 'family' : '')
    setFamily(EMPTY_FAMILY)
    setFamilyShown({})
    setAddingMember(false)
    setSavedFamily(null)
    setAntenatal(emptyAntenatal)
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
            <h2>{savedFamily ? 'Family registered' : 'Patient registered'}</h2>
          </div>
          {/* A new family: its name, number and the day it was registered. */}
          {savedFamily ? (
            <div className={styles.familyBanner}>
              <Icon name="users" size={18} />
              <span>
                <b>{savedFamily.name}</b> family · {savedFamily.family_number} · registered{' '}
                {new Date(savedFamily.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          ) : null}
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
            {/* A family: add the next member from their old file too
                (request 227o), the same as on Register patient. */}
            {saved.category === 'family' ? (
              <button
                className={`${styles.button} ${styles.primary}`}
                disabled={busy || joining}
                onClick={async () => {
                  setJoining(true)
                  const family = await startFamily(client, saved.id)
                  setJoining(false)
                  if (!family) {
                    setProblem('The family could not be started. Check the network and try again.')
                    return
                  }
                  router.push(`/patients/old-file/?family=${family}`)
                  setFamilyId(family)
                  startAgain()
                  setCategory('family')
                }}
              >
                <Icon name="users" size={16} />{' '}
                {joining
                  ? 'Starting…'
                  : savedFamily
                    ? 'Add another family member'
                    : 'Add family member'}
              </button>
            ) : null}
            {problem ? <p className={styles.error}>{problem}</p> : null}
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

        {/* ===== 5b. The category, before anything else (request 228b) ===== */}
        {!familyId ? (
          <div className={`${styles.field} ${styles.categoryPick}`}>
            <label htmlFor="old-category">Category</label>
            <select
              id="old-category"
              className={styles.input}
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as Category | '')
                setProblem(null)
                setAddingMember(false)
              }}
            >
              <option value="">Select category</option>
              <option value="individual">Individual</option>
              <option value="family">Family</option>
              <option value="antenatal">Antenatal</option>
            </select>
          </div>
        ) : null}

        {/* ===== 5c. A new family: its details, then its first member ===== */}
        {newFamily ? (
          <>
            <FamilyDetailsForm
              value={family}
              onChange={(next) => {
                setFamily(next)
                setFamilyShown({})
              }}
              shown={familyShown}
              client={client}
              staffId={staff.id}
            />
            {!addingMember ? (
              <>
                <p className={styles.familyNote}>A family needs at least one member.</p>
                <div className={styles.buttons}>
                  <button
                    className={`${styles.button} ${styles.familyButton}`}
                    onClick={() => {
                      const wrong = checkFamily(family)
                      setFamilyShown(wrong)
                      if (Object.keys(wrong).length > 0) {
                        document.getElementById(`family-${Object.keys(wrong)[0]}`)?.focus()
                        return
                      }
                      // The member starts with the family's address.
                      setMore((now) => ({
                        ...now,
                        address: family.address ?? '',
                        town: family.town ?? '',
                        lga: family.lga ?? '',
                        state: family.state ?? '',
                      }))
                      setProblem(null)
                      setAddingMember(true)
                    }}
                  >
                    <Icon name="users" size={16} /> Add family member
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.familyBanner}>
                <Icon name="users" size={18} />
                <span>
                  First member of the <b>{family.name.trim()}</b> family
                </span>
              </div>
            )}
          </>
        ) : null}

        {/* ===== 6. Name, phone, and the old file ===== */}
        {!category || (newFamily && !addingMember) ? null : (
          <div className={styles.card}>
            {/* The month the file was first opened, first, because files are
              entered a month at a time (request 211). */}
            <div className={styles.field}>
              <label htmlFor="old-month">Month first registered (optional)</label>
              <input
                id="old-month"
                className={styles.input}
                type="month"
                min="1950-01"
                max={new Date().toISOString().slice(0, 7)}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
              <small className={styles.muted}>
                Stays the same for the next file, until you change it.
              </small>
            </div>
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
            {/* Joining a family that exists: the category can still change
              here, to register this person on their own. */}
            {familyId ? (
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
            ) : null}
            {familyCard ? (
              <p className={styles.familyNote}>
                Joining family <b>{familyCard}</b>. Choose another category to register this person
                on their own.
              </p>
            ) : null}
            {/* ===== The antenatal card's details, when Antenatal is chosen
              (request 227o) ===== */}
            {category === 'antenatal' ? (
              <div className={styles.anteBox}>
                <b>Antenatal details</b>
                <div className={styles.fields2}>
                  {(
                    [
                      ['client_marital_status', 'Marital status', ANTENATAL_MARITAL, false],
                      ['client_religion', 'Religion', ANTENATAL_RELIGION, true],
                      ['client_education', 'Level of education', ANTENATAL_EDUCATION, true],
                    ] as [keyof typeof emptyAntenatal, string, string[], boolean][]
                  ).map(([key, label, answers, other]) => (
                    <div key={key} className={styles.field}>
                      <label htmlFor={`old-${key}`}>{label}</label>
                      <SearchSelect
                        id={`old-${key}`}
                        value={antenatal[key]}
                        placeholder="Choose"
                        options={answers.map((answer) => ({ value: answer, label: answer }))}
                        onChange={setAnte(key)}
                        onOther={other ? (typed) => typed && setAnte(key)(typed) : undefined}
                      />
                    </div>
                  ))}
                  <div className={styles.field}>
                    <label htmlFor="old-client_occupation">Occupation</label>
                    <input
                      id="old-client_occupation"
                      className={styles.input}
                      maxLength={80}
                      placeholder="e.g. Trader"
                      value={antenatal.client_occupation}
                      onChange={(event) => setAnte('client_occupation')(event.target.value)}
                    />
                  </div>
                </div>
                <b>Next of kin</b>
                <div className={styles.fields2}>
                  <div className={styles.field}>
                    <label htmlFor="old-kin_occupation">Occupation</label>
                    <input
                      id="old-kin_occupation"
                      className={styles.input}
                      maxLength={80}
                      placeholder="e.g. Driver"
                      value={antenatal.kin_occupation}
                      onChange={(event) => setAnte('kin_occupation')(event.target.value)}
                    />
                  </div>
                  {(
                    [
                      ['kin_religion', 'Religion', ANTENATAL_RELIGION],
                      ['kin_education', 'Level of education', ANTENATAL_EDUCATION],
                    ] as [keyof typeof emptyAntenatal, string, string[]][]
                  ).map(([key, label, answers]) => (
                    <div key={key} className={styles.field}>
                      <label htmlFor={`old-${key}`}>{label}</label>
                      <SearchSelect
                        id={`old-${key}`}
                        value={antenatal[key]}
                        placeholder="Choose"
                        options={answers.map((answer) => ({ value: answer, label: answer }))}
                        onChange={setAnte(key)}
                        onOther={(typed) => typed && setAnte(key)(typed)}
                      />
                    </div>
                  ))}
                  <div className={styles.field}>
                    <label htmlFor="old-kin_age">Age</label>
                    <input
                      id="old-kin_age"
                      className={styles.input}
                      inputMode="numeric"
                      placeholder="e.g. 40"
                      value={antenatal.kin_age}
                      onChange={(event) =>
                        setAnte('kin_age')(event.target.value.replace(/\D/g, '').slice(0, 3))
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}
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
                  {tried && emailWrong ? (
                    <small className={styles.error}>{emailWrong}</small>
                  ) : null}
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
                {busy ? 'Saving…' : newFamily ? 'Save family and member' : 'Save patient'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
