/*
 * lib/record/record.ts: reading and writing a patient's medical record.
 *
 * Why: the record page (and later the nursing station and the doctor's
 * consultation) use the same calls. Kept here, in one place.
 *
 * The order matters: openRecord() must be called first. It writes "who
 * opened this record" to the database, and the database only answers for a
 * record opened by this person in the last 12 hours (see the migration
 * 20261029160000_medical_record.sql). Opening again is harmless.
 *
 * Nothing is ever deleted. voidItem() marks a line as voided with a reason;
 * the line stays, greyed and crossed out.
 *
 * Never: log a value from the record. Errors are reported by table and id.
 */
import type { GlucoseUnit, GlucoseWhen } from './vitals'
import { HOSPITAL_TIME_ZONE } from '../time/zone'
import { serverNow } from '../time/serverTime'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addToOutbox, isNetworkFailure } from '@/lib/offline/outbox'
import { OLD_OPENING, isOldOpening } from './opening'

// ===== 1. Shapes =====
type Voidable = {
  id: number
  voided_at: string | null
  void_reason: string | null
  voider: { full_name: string } | null
}

export type MedicationStatus = 'active' | 'suspended' | 'stopped'

export type Profile = {
  patient_id: number
  blood_group: string | null
  genotype: string | null
  no_known_allergies: boolean
  last_menstrual_period: string | null
  gravida: number | null
  para: number | null
}

export type Allergy = Voidable & {
  allergen: string
  reaction: string | null
  severe: boolean
  created_at: string
  recorder: { full_name: string } | null
}
export type Condition = Voidable & {
  name: string
  status: 'active' | 'resolved'
  created_at: string
  recorder: { full_name: string } | null
}
export type Medication = Voidable & {
  medicine: string
  dose: string | null
  // IV, IM, Oral... (request 224); older lines have none.
  route?: string | null
  how_often: string | null
  // The course (request 240, 2026-11-23): for how many days, how many doses,
  // and the price of one dose for the bill. Older lines have none.
  days?: number | null
  doses?: number | null
  dose_price?: number | null
  status: MedicationStatus
  created_at: string
  author: { full_name: string } | null
}
export type StatusChange = {
  id: number
  medication_id: number
  old_status: MedicationStatus | null
  new_status: MedicationStatus
  reason: string | null
  changed_at: string
  changer: { full_name: string } | null
}
export type DoseGiven = Voidable & {
  // The medicine's line in the chart; null for a dose not on the list.
  medication_id: number | null
  medicine: string
  // A dose that was due and not given, and why (request 219c); null when given.
  not_given_reason: string | null
  // IV, IM, Oral... and the nurse who signed (request 224).
  route?: string | null
  signer?: { full_name: string } | null
  dose: string | null
  given_at: string
  note: string | null
  giver: { full_name: string } | null
}
export type Vitals = Voidable & {
  systolic: number | null
  diastolic: number | null
  pulse: number | null
  temperature_c: number | null
  breathing_rate: number | null
  spo2: number | null
  weight_kg: number | null
  height_cm: number | null
  // Request 235 (2026-11-21): blood glucose with fasting or random and its
  // unit, and a pain score from 0 to 10.
  blood_glucose?: number | null
  glucose_unit?: GlucoseUnit | null
  glucose_when?: GlucoseWhen | null
  pain_score?: number | null
  recorded_at: string
  recorder: { full_name: string } | null
  // The nurse who took them, when another person typed (request 224).
  signer?: { full_name: string } | null
}
export type Note = Voidable & {
  // A short heading for the note (request 214, 2026-11-16); older notes have none.
  title: string | null
  note: string
  created_at: string
  author: { full_name: string } | null
}
export type Consultation = Voidable & {
  title: string | null
  complaint: string | null
  findings: string | null
  assessment: string | null
  plan: string | null
  created_at: string
  author: { full_name: string } | null
  // The clinician who saw the patient (request 224).
  signer?: { full_name: string } | null
  // Who typed it and who it is signed by: only they void or correct it
  // (request 229). Missing in a device copy made before 2026-11-20.
  written_by?: string
  signed_by?: string | null
}

// An "Other" vital sign: a measure that has no box of its own (Anthony,
// 2026-11-11), such as blood sugar.
export type VitalExtra = Voidable & {
  measure_id: number
  name: string
  unit: string | null
  value: number
  recorded_at: string
  recorder: { full_name: string } | null
}

// A measure this person can type a reading for: their own, and the standard
// ones (a second person typed it, so everybody has it).
export type VitalMeasure = { id: number; name: string; unit: string | null; standard: boolean }

export type MedicalRecord = {
  profile: Profile | null
  allergies: Allergy[]
  conditions: Condition[]
  medications: Medication[]
  statusChanges: StatusChange[]
  doses: DoseGiven[]
  vitals: Vitals[]
  vitalExtras: VitalExtra[]
  nursingNotes: Note[]
  consultations: Consultation[]
}

// The tables a line can be voided in.
export type VoidableTable =
  | 'allergies'
  | 'conditions'
  | 'patient_medications'
  | 'medications_given'
  | 'vital_signs'
  | 'vital_extras'
  | 'nursing_notes'
  | 'consultation_notes'
  // The antenatal booking and the operation consent (request 170).
  | 'antenatal_tests'
  | 'previous_pregnancies'
  | 'operation_consents'
  // The antenatal visit table (2026-11-16).
  | 'antenatal_visits'

const VOID = 'id, voided_at, void_reason, voider:staff!voided_by(full_name)'

// ===== 2. Open, then read =====
// When the record on screen was last opened, by this device's clock (only the difference is
// used, so a wrong clock does not matter).
let openedAt = 0
const TWELVE_HOURS = 12 * 60 * 60 * 1000

// Opening the record page: "this person opened this record, now" (logged
// by the database), and when, for the screen's 12 hours (openingIsOld).
export async function openRecord(client: SupabaseClient, patientId: number): Promise<boolean> {
  const { error } = await client.rpc('open_record', { patient: patientId })
  if (error) console.warn(`Record for patient ${patientId} could not be opened: ${error.code}`)
  else openedAt = Date.now()
  return !error
}

// Is the record on screen past its 12 hours? Then the database answers its
// reads with nothing, and a read again would put empty lists on the screen
// (no medicines, no notes) for a patient who has them. So the screens keep
// what they last read and say they have stopped updating (request 248).
// Ten minutes early, so a slow read never lands on the edge.
export function openingIsOld(): boolean {
  return openedAt > 0 && Date.now() - openedAt > TWELVE_HOURS - 10 * 60 * 1000
}

// ===== 2a. A save that meets an old opening =====
// A record may be written only within 12 hours of opening it, and every
// opening goes in the activity log first. A save past that is refused by
// the database. Anthony, 2026-11-26 (request 252): "We want to only do the
// things that will keep the data trustworthy... redirect the page, the
// staff to go over it again." So the save is NOT tried again by itself:
// it says it was not saved, and the screen sends the person to open the
// record again (2b), so they see the latest and enter it again themselves.
// (From 2026-11-25 to 26 it opened the record again by itself; undone.)
//   run: does the save once, and says whether it wrote (an update that the
//        database may not make answers no row and no error, so it is read
//        back; without that the screen said "Saved" with nothing written).
type Attempt = { error: { code?: string; message?: string } | null; wrote: boolean }

export async function saveAndCheck(
  run: () => Promise<Attempt>,
): Promise<Attempt & { oldOpening: boolean }> {
  const attempt = await run()
  const oldOpening = isOldOpening(attempt.error) || (!attempt.error && !attempt.wrote)
  if (oldOpening) announceOldOpening()
  return { ...attempt, oldOpening }
}

// ===== 2b. Tell the record screen to send the person back =====
// The record page listens for this and shows "Open the record again".
export const OLD_OPENING_EVENT = 'rhema-old-opening'
function announceOldOpening() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OLD_OPENING_EVENT))
}

export async function loadRecord(
  client: SupabaseClient,
  patientId: number,
): Promise<MedicalRecord | null> {
  const byPatient = (table: string, columns: string, order: string) =>
    client
      .from(table)
      .select(columns)
      .eq('patient_id', patientId)
      .order(order, { ascending: false })

  const [
    profile,
    allergies,
    conditions,
    medications,
    statusChanges,
    doses,
    vitals,
    nursing,
    consultations,
    vitalExtras,
  ] = await Promise.all([
    client
      .from('medical_profiles')
      .select(
        'patient_id, blood_group, genotype, no_known_allergies, last_menstrual_period, gravida, para',
      )
      .eq('patient_id', patientId)
      .maybeSingle(),
    byPatient(
      'allergies',
      `${VOID}, allergen, reaction, severe, created_at, recorder:staff!recorded_by(full_name)`,
      'created_at',
    ),
    byPatient(
      'conditions',
      `${VOID}, name, status, created_at, recorder:staff!recorded_by(full_name)`,
      'created_at',
    ),
    byPatient(
      'patient_medications',
      `${VOID}, medicine, dose, route, how_often, days, doses, dose_price, status, created_at, author:staff!added_by(full_name)`,
      'created_at',
    ),
    byPatient(
      'medication_status_log',
      'id, medication_id, old_status, new_status, reason, changed_at, changer:staff!changed_by(full_name)',
      'changed_at',
    ),
    byPatient(
      'medications_given',
      `${VOID}, medication_id, medicine, dose, route, given_at, note, not_given_reason, giver:staff!given_by(full_name), signer:staff!signed_by(full_name)`,
      'given_at',
    ).limit(200),
    byPatient(
      'vital_signs',
      `${VOID}, systolic, diastolic, pulse, temperature_c, breathing_rate, spo2, weight_kg, height_cm, blood_glucose, glucose_unit, glucose_when, pain_score, recorded_at, recorder:staff!recorded_by(full_name), signer:staff!signed_by(full_name)`,
      'recorded_at',
    ).limit(100),
    byPatient(
      'nursing_notes',
      `${VOID}, title, note, created_at, author:staff!written_by(full_name)`,
      'created_at',
    ).limit(50),
    byPatient(
      'consultation_notes',
      `${VOID}, title, complaint, findings, assessment, plan, created_at, written_by, signed_by, author:staff!written_by(full_name), signer:staff!signed_by(full_name)`,
      'created_at',
    ).limit(30),
    byPatient(
      'vital_extras',
      `${VOID}, measure_id, name, unit, value, recorded_at, recorder:staff!recorded_by(full_name)`,
      'recorded_at',
    ).limit(60),
  ])

  // Any part that could not be read (no network): nothing, so a screen
  // keeps what it already shows instead of going empty.
  if (
    [
      profile,
      allergies,
      conditions,
      medications,
      statusChanges,
      doses,
      vitals,
      nursing,
      consultations,
    ].some((result) => result.error)
  )
    return null
  const list = <T>(result: { data: unknown }) => (result.data as T[] | null) ?? []
  return {
    profile: (profile.data as Profile | null) ?? null,
    allergies: list<Allergy>(allergies),
    conditions: list<Condition>(conditions),
    medications: list<Medication>(medications),
    statusChanges: list<StatusChange>(statusChanges),
    doses: list<DoseGiven>(doses),
    vitals: list<Vitals>(vitals),
    // Not part of the all-or-nothing check above: if this part is not set up
    // yet, the rest of the record still opens.
    vitalExtras: list<VitalExtra>(vitalExtras),
    nursingNotes: list<Note>(nursing),
    consultations: list<Consultation>(consultations),
  }
}

// What each kind of entry is called, for "Not sent yet" lines.
const ENTRY_WORDS: Record<string, string> = {
  allergies: 'Allergy',
  conditions: 'Condition',
  patient_medications: 'Medicine',
  medications_given: 'Dose given',
  vital_signs: 'Vital signs',
  vital_extras: 'Other vital sign',
  nursing_notes: 'Nursing note',
  consultation_notes: 'Consultation note',
  antenatal_tests: 'Antenatal test',
  previous_pregnancies: 'Previous pregnancy',
  operation_consents: 'Operation consent',
  antenatal_visits: 'Antenatal visit',
}

// ===== 3. Adding a line =====
// Each add sends the signed in person as the writer; the database refuses
// any other name.
// Correct a current medicine's name, dose and how often (Anthony,
// 2026-11-10). The database refuses it for a stopped or removed medicine.
export async function editMedication(
  client: SupabaseClient,
  id: number,
  values: { medicine: string; dose: string | null; how_often: string | null },
): Promise<string | null> {
  const { error, oldOpening } = await saveAndCheck(async () => {
    const { data, error } = await client
      .from('patient_medications')
      .update(values)
      .eq('id', id)
      .select('id')
    return { error, wrote: !error && (data?.length ?? 0) > 0 }
  })
  if (oldOpening) return OLD_OPENING
  if (error) {
    console.warn(`A medicine could not be edited: ${error.code}`)
    return error.code === '23514'
      ? 'A stopped medicine cannot be edited.'
      : 'It could not be saved. Check the internet and try again.'
  }
  return null
}

// The column holding when a line happened, for lines saved with no network.
const TIME_COLUMN: Partial<Record<VoidableTable, string>> = {
  medications_given: 'given_at',
  vital_signs: 'recorded_at',
  vital_extras: 'recorded_at',
  nursing_notes: 'created_at',
  consultation_notes: 'created_at',
}

export async function addLine(
  client: SupabaseClient,
  table: Exclude<VoidableTable, never> | 'medical_profiles',
  values: Record<string, unknown>,
): Promise<string | null> {
  // An insert that the double tap guard skips answers no error and no
  // row, and counts as written: the first one is in already.
  const { error, oldOpening } = await saveAndCheck(async () => {
    const { error } = await client.from(table).insert(values)
    return { error, wrote: !error }
  })
  // No network: the entry waits on this device, marked not sent, and goes
  // when the network is back (request 128, step 3: "show that it has not
  // saved. But let it save").
  if (isNetworkFailure(error) && table !== 'medical_profiles') {
    const { data } = await client.auth.getSession()
    const staffId = data.session?.user.id
    if (staffId) {
      // Sent later, so the time it happened is written now, from the
      // corrected clock (request 225), unless a time was given.
      const timeColumn = TIME_COLUMN[table]
      const timed =
        timeColumn && values[timeColumn] === undefined
          ? { ...values, [timeColumn]: serverNow().toISOString() }
          : values
      addToOutbox(staffId, {
        kind: 'record',
        label: ENTRY_WORDS[table] ?? 'Entry',
        patientId: Number(values.patient_id),
        table,
        values: timed,
      })
      return null
    }
  }
  if (error) {
    console.warn(`A line could not be added to ${table}: ${error.code}`)
    if (oldOpening) return OLD_OPENING
    return error.code === '23514'
      ? 'One of the values is outside the normal range. Check it and try again.'
      : 'That could not be saved. Try again.'
  }
  return null
}

export async function saveProfile(
  client: SupabaseClient,
  profile: Omit<Profile, 'patient_id'>,
  patientId: number,
  staffId: string,
  exists: boolean,
): Promise<string | null> {
  const values = { ...profile, updated_by: staffId }
  // Read back: an update the database may not make answers no row and no
  // error, which used to show as saved (request 248, 2026-11-25).
  // Read back, so an old opening is not reported as saved (2a).
  const { error, oldOpening } = await saveAndCheck(async () => {
    const { data, error } = exists
      ? await client
          .from('medical_profiles')
          .update(values)
          .eq('patient_id', patientId)
          .select('patient_id')
      : await client
          .from('medical_profiles')
          .insert({ ...values, patient_id: patientId })
          .select('patient_id')
    return { error, wrote: !error && (data?.length ?? 0) > 0 }
  })
  if (oldOpening) return OLD_OPENING
  if (error) {
    console.warn(`The profile for patient ${patientId} could not be saved: ${error.code}`)
    return 'That could not be saved. Try again.'
  }
  return null
}

// ===== 4. Voiding, and medicine status =====
export async function voidItem(
  client: SupabaseClient,
  table: VoidableTable,
  id: number,
  reason: string,
  staffId: string,
): Promise<string | null> {
  if (!reason.trim()) return 'Give a short reason.'
  const { error, oldOpening } = await saveAndCheck(async () => {
    const { data, error } = await client
      .from(table)
      .update({
        voided_at: serverNow().toISOString(),
        voided_by: staffId,
        void_reason: reason.trim(),
      })
      .eq('id', id)
      .select('id')
    return { error, wrote: !error && (data?.length ?? 0) > 0 }
  })
  if (oldOpening) return OLD_OPENING
  if (error) {
    console.warn(`${table} ${id} could not be voided: ${error.code}`)
    return 'That could not be voided. Try again.'
  }
  return null
}

export async function changeMedicationStatus(
  client: SupabaseClient,
  medicationId: number,
  status: MedicationStatus,
  reason: string,
): Promise<string | null> {
  // The database answers "not found, or this record is not open" for an old
  // opening; that counts as not written, and the screen sends the person
  // back to open the record again (2a).
  const { error, oldOpening } = await saveAndCheck(async () => {
    const { error } = await client.rpc('change_medication_status', {
      medication: medicationId,
      status,
      reason: reason.trim(),
    })
    const notOpen = (error?.message ?? '').includes('this record is not open')
    return { error: notOpen ? null : error, wrote: !error }
  })
  if (oldOpening) return OLD_OPENING
  if (error) {
    console.warn(`Medication ${medicationId} status could not be changed: ${error.code}`)
    return 'That could not be saved. Try again.'
  }
  return null
}

// A condition is marked resolved (or active again). No reason is asked:
// the change and its author go in the activity log.
export async function setConditionStatus(
  client: SupabaseClient,
  conditionId: number,
  status: 'active' | 'resolved',
): Promise<string | null> {
  const { error, oldOpening } = await saveAndCheck(async () => {
    const { data, error } = await client
      .from('conditions')
      .update({ status })
      .eq('id', conditionId)
      .select('id')
    return { error, wrote: !error && (data?.length ?? 0) > 0 }
  })
  if (oldOpening) return OLD_OPENING
  if (error) {
    console.warn(`Condition ${conditionId} status could not be changed: ${error.code}`)
    return 'That could not be saved. Try again.'
  }
  return null
}

// ===== 5. Words and colours =====
export const MEDICATION_STATUS: Record<MedicationStatus, { label: string; colour: string }> = {
  active: { label: 'Active', colour: 'green' },
  suspended: { label: 'Suspended', colour: 'orange' },
  stopped: { label: 'Stopped', colour: 'red' },
}

// Correct is offered for 15 minutes after a note is written; after that,
// only Void (Anthony, 2026-11-19, request 227j: "in case the nurses are
// already working on it, you can't change it again... maybe 15 minutes").
export const CORRECT_MINUTES = 15
export function stillCorrectable(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < CORRECT_MINUTES * 60 * 1000
}

export const VOID_REASONS = [
  'Entered by mistake',
  'Wrong patient',
  'Wrong dose or value',
  'Duplicate',
]

export function when(isoTime: string): string {
  return new Date(isoTime).toLocaleString('en-GB', {
    timeZone: HOSPITAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ===== 9. "Other" vital signs: my measures, and typing a new one =====
// Typed once, they stay on this person's own screen; when a second person
// types the same one it becomes standard for everybody (in the database).
export async function loadVitalMeasures(client: SupabaseClient): Promise<VitalMeasure[] | null> {
  const { data, error } = await client
    .from('vital_measures')
    .select('id, name, unit, standard')
    .order('name')
  if (error || !data) return null
  return data as unknown as VitalMeasure[]
}

// Returns the measure's number, or null when it could not be saved.
export async function saveVitalMeasure(
  client: SupabaseClient,
  name: string,
  unit: string | null,
): Promise<number | null> {
  const { data, error } = await client.rpc('use_vital_measure', { p_name: name, p_unit: unit })
  if (error || typeof data !== 'number') return null
  return data
}
