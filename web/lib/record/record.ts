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
import type { SupabaseClient } from '@supabase/supabase-js'
import { addToOutbox, isNetworkFailure } from '@/lib/offline/outbox'

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
  how_often: string | null
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
  medicine: string
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
  recorded_at: string
  recorder: { full_name: string } | null
}
export type Note = Voidable & {
  note: string
  created_at: string
  author: { full_name: string } | null
}
export type Consultation = Voidable & {
  complaint: string | null
  findings: string | null
  assessment: string | null
  plan: string | null
  created_at: string
  author: { full_name: string } | null
}

export type MedicalRecord = {
  profile: Profile | null
  allergies: Allergy[]
  conditions: Condition[]
  medications: Medication[]
  statusChanges: StatusChange[]
  doses: DoseGiven[]
  vitals: Vitals[]
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
  | 'nursing_notes'
  | 'consultation_notes'

const VOID = 'id, voided_at, void_reason, voider:staff!voided_by(full_name)'

// ===== 2. Open, then read =====
export async function openRecord(client: SupabaseClient, patientId: number): Promise<boolean> {
  const { error } = await client.rpc('open_record', { patient: patientId })
  if (error) console.warn(`Record for patient ${patientId} could not be opened: ${error.code}`)
  return !error
}

export async function loadRecord(
  client: SupabaseClient,
  patientId: number,
): Promise<MedicalRecord> {
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
      `${VOID}, medicine, dose, how_often, status, created_at, author:staff!added_by(full_name)`,
      'created_at',
    ),
    byPatient(
      'medication_status_log',
      'id, medication_id, old_status, new_status, reason, changed_at, changer:staff!changed_by(full_name)',
      'changed_at',
    ),
    byPatient(
      'medications_given',
      `${VOID}, medicine, dose, given_at, note, giver:staff!given_by(full_name)`,
      'given_at',
    ).limit(50),
    byPatient(
      'vital_signs',
      `${VOID}, systolic, diastolic, pulse, temperature_c, breathing_rate, spo2, weight_kg, height_cm, recorded_at, recorder:staff!recorded_by(full_name)`,
      'recorded_at',
    ).limit(30),
    byPatient(
      'nursing_notes',
      `${VOID}, note, created_at, author:staff!written_by(full_name)`,
      'created_at',
    ).limit(50),
    byPatient(
      'consultation_notes',
      `${VOID}, complaint, findings, assessment, plan, created_at, author:staff!written_by(full_name)`,
      'created_at',
    ).limit(30),
  ])

  const list = <T>(result: { data: unknown }) => (result.data as T[] | null) ?? []
  return {
    profile: (profile.data as Profile | null) ?? null,
    allergies: list<Allergy>(allergies),
    conditions: list<Condition>(conditions),
    medications: list<Medication>(medications),
    statusChanges: list<StatusChange>(statusChanges),
    doses: list<DoseGiven>(doses),
    vitals: list<Vitals>(vitals),
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
  nursing_notes: 'Nursing note',
  consultation_notes: 'Consultation note',
}

// ===== 3. Adding a line =====
// Each add sends the signed in person as the writer; the database refuses
// any other name.
export async function addLine(
  client: SupabaseClient,
  table: Exclude<VoidableTable, never> | 'medical_profiles',
  values: Record<string, unknown>,
): Promise<string | null> {
  const { error } = await client.from(table).insert(values)
  // No network: the entry waits on this device, marked not sent, and goes
  // when the network is back (request 128, step 3: "show that it has not
  // saved. But let it save").
  if (isNetworkFailure(error) && table !== 'medical_profiles') {
    const { data } = await client.auth.getSession()
    const staffId = data.session?.user.id
    if (staffId) {
      addToOutbox(staffId, {
        kind: 'record',
        label: ENTRY_WORDS[table] ?? 'Entry',
        patientId: Number(values.patient_id),
        table,
        values,
      })
      return null
    }
  }
  if (error) {
    console.warn(`A line could not be added to ${table}: ${error.code}`)
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
  const { error } = exists
    ? await client.from('medical_profiles').update(values).eq('patient_id', patientId)
    : await client.from('medical_profiles').insert({ ...values, patient_id: patientId })
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
  const { error } = await client
    .from(table)
    .update({ voided_at: new Date().toISOString(), voided_by: staffId, void_reason: reason.trim() })
    .eq('id', id)
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
  const { error } = await client.rpc('change_medication_status', {
    medication: medicationId,
    status,
    reason: reason.trim(),
  })
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
  const { error } = await client.from('conditions').update({ status }).eq('id', conditionId)
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

export const VOID_REASONS = [
  'Entered by mistake',
  'Wrong patient',
  'Wrong dose or value',
  'Duplicate',
]

export function when(isoTime: string): string {
  return new Date(isoTime).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
