/*
 * lib/patients/patients.ts: finding, registering and updating patients.
 *
 * Why: the patients pages, Home (Send to room) and later the lab and
 * pharmacy all need the same patient questions. They live here so every
 * part asks the database the same way, and no part reaches into another's
 * folder.
 *
 * What a patient row holds here is the registration card only (name, date
 * of birth, contact, next of kin). The medical record is separate, with
 * stricter rules, in a later file.
 *
 * Who may do what is decided by the database (patients RLS: the "patients"
 * permission). These functions never widen that.
 *
 * Never: log a patient's name, phone or address. Errors are reported by
 * patient number or error code only.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { addToOutbox, isNetworkFailure } from '../offline/outbox'
import { readCopy, searchCopy } from '../offline/patientCopy'

// ===== 1. Shapes =====
export type Sex = 'female' | 'male'
export type Category = 'individual' | 'family' | 'antenatal'

export type PatientCard = {
  id: number
  patient_number: string
  full_name: string
  // Empty only for a patient registered from an old file (request 128),
  // until somebody fills them in.
  date_of_birth: string | null
  sex: Sex | null
  category: Category
  phone: string | null
  email: string | null
  address: string | null
  town: string | null
  lga: string | null
  state: string | null
  country: string
  next_of_kin_name: string | null
  next_of_kin_relationship: string | null
  next_of_kin_phone: string | null
  // Registered with only a name, a phone and the old paper file.
  from_old_file: boolean
  // The family this patient belongs to, and its card number (FAM-000012).
  family_id: number | null
  family: { family_number: string } | null
  created_at: string
}

// What the full form fills in. The number, the author and the times are
// never typed: the database sets them. The full form always asks for the
// date of birth and sex.
export type PatientDetails = Omit<
  PatientCard,
  'id' | 'patient_number' | 'created_at' | 'from_old_file' | 'date_of_birth' | 'sex' | 'family'
> & { date_of_birth: string; sex: Sex }

// A search result also says when the patient was last seen (their last
// visit in the queue), and whether they are in the hospital now.
export type PatientResult = PatientCard & {
  last_seen: string | null
  open_visit: { id: number; status: string; room: string } | null
  // Today's visits, oldest first: where they were, from when to when, and
  // how each one ended (requests 140 and 147).
  today: TodayVisit[]
}

export type TodayVisit = {
  room: string
  from: string
  to: string | null
  reason: string | null
}

// Also used for the device copy (lib/offline/patientCopy).
export const CARD_COLUMNS =
  'id, patient_number, full_name, date_of_birth, sex, category, phone, email, address, town, lga, state, country, next_of_kin_name, next_of_kin_relationship, next_of_kin_phone, from_old_file, family_id, family:families(family_number), created_at'

// "Female", "Male", or that it is not recorded yet (an old file).
export function sexWords(sex: Sex | null): string {
  if (sex === 'female') return 'Female'
  if (sex === 'male') return 'Male'
  return 'Sex not recorded'
}

// The signed in person, read from this device (works with no network).
async function myId(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession()
  return data.session?.user.id ?? null
}

// A copied patient, shaped like a search result (no visit details offline).
const offline = (patient: PatientCard): PatientResult => ({
  ...patient,
  last_seen: null,
  open_visit: null,
  today: [],
})

// ===== 2. Phone numbers: one way of writing them =====
// The database keeps 11 digits starting with 0, like 08035550126. People
// type spaces, dashes or +234, so this turns all of those into that form.
export function cleanPhone(typed: string): string {
  const digits = typed.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length === 13) return '0' + digits.slice(3)
  return digits
}

export function phoneLooksRight(phone: string): boolean {
  return /^0[0-9]{10}$/.test(phone)
}

// ===== 3. Searching =====
// By name (any part), patient number, or phone. Newest first.
export async function searchPatients(
  client: SupabaseClient,
  typed: string,
): Promise<PatientResult[]> {
  const words = typed.trim()
  let query = client
    .from('patients')
    .select(CARD_COLUMNS)
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(30)

  // A family card number (FAM-000012, or just FAM-12): every member.
  const familyNumber = words.toUpperCase().match(/^FAM-?0*(\d{1,6})$/)
  if (familyNumber) {
    const wanted = 'FAM-' + familyNumber[1].padStart(6, '0')
    const { data: family } = await client
      .from('families')
      .select('id')
      .eq('family_number', wanted)
      .maybeSingle()
    if (!family) return []
    const { data } = await client
      .from('patients')
      .select(CARD_COLUMNS)
      .is('voided_at', null)
      .eq('family_id', (family as { id: number }).id)
      .order('created_at')
    return withVisits(client, (data as unknown as PatientCard[] | null) ?? [])
  }

  if (words) {
    const phone = cleanPhone(words)
    const number = words.toUpperCase()
    // Commas and brackets would break the search filter, so they are taken
    // out of what was typed.
    const safe = words.replace(/[,()]/g, ' ')
    const parts = [
      `full_name.ilike.%${safe}%`,
      `patient_number.ilike.%${number.replace(/[,()]/g, '')}%`,
    ]
    if (phone.length >= 4) parts.push(`phone.like.%${phone}%`)
    query = query.or(parts.join(','))
  }

  const { data, error } = await query
  // No network: search the copy on this device (request 128, step 3).
  if (isNetworkFailure(error)) {
    const me = await myId(client)
    return me ? searchCopy(me, typed).map(offline) : []
  }
  if (error || !data) return []
  return withVisits(client, data as unknown as PatientCard[])
}

// Add "last seen" and "in the hospital now" to a list of patients.
async function withVisits(
  client: SupabaseClient,
  patients: PatientCard[],
): Promise<PatientResult[]> {
  if (patients.length === 0) return []
  const { data } = await client
    .from('queue_entries')
    .select('id, patient_id, status, created_at, finished_at, finish_reason, room:rooms(name)')
    .in(
      'patient_id',
      patients.map((patient) => patient.id),
    )
    .order('created_at', { ascending: false })

  type Visit = {
    id: number
    patient_id: number
    status: string
    created_at: string
    finished_at: string | null
    finish_reason: string | null
    room: { name: string } | null
  }
  const visits = (data as unknown as Visit[] | null) ?? []
  return patients.map((patient) => {
    const mine = visits.filter((visit) => visit.patient_id === patient.id)
    const open = mine.find((visit) => visit.status !== 'done')
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    return {
      ...patient,
      last_seen: mine[0]?.created_at ?? null,
      open_visit: open ? { id: open.id, status: open.status, room: open.room?.name ?? '' } : null,
      today: mine
        .filter((visit) => new Date(visit.created_at) >= midnight)
        .reverse()
        .map((visit) => ({
          room: visit.room?.name ?? 'A room',
          from: visit.created_at,
          to: visit.finished_at,
          reason: visit.finish_reason,
        })),
    }
  })
}

export async function getPatient(
  client: SupabaseClient,
  id: number,
): Promise<PatientResult | null> {
  const { data, error } = await client
    .from('patients')
    .select(CARD_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  // No network: the copy on this device, if this patient is in it.
  if (isNetworkFailure(error)) {
    const me = await myId(client)
    const copied = me ? readCopy(me).find((patient) => patient.id === id) : undefined
    return copied ? offline(copied) : null
  }
  if (!data) return null
  const [withVisit] = await withVisits(client, [data as unknown as PatientCard])
  return withVisit ?? null
}

// ===== 4. "Is this patient already registered?" =====
// Same name (ignoring capitals and spaces) and same date of birth. The
// phone is shown with each match so the front desk can tell.
export async function findPossibleDuplicates(
  client: SupabaseClient,
  name: string,
  dateOfBirth: string,
): Promise<PatientResult[]> {
  const cleanName = name.trim().replace(/\s+/g, ' ')
  if (cleanName.length < 2 || !dateOfBirth) return []
  const { data } = await client
    .from('patients')
    .select(CARD_COLUMNS)
    .is('voided_at', null)
    .eq('date_of_birth', dateOfBirth)
    .ilike('full_name', cleanName.replace(/[%_]/g, ''))
    .limit(5)
  return withVisits(client, (data as unknown as PatientCard[] | null) ?? [])
}

// ===== 5. Registering and updating =====
// A double tap (or a slow network sending twice) is refused by the database
// with "already registered" (request 131). The first tap saved the patient,
// so this finds that patient, by this person, with this name, just now.
function isDoubleTap(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' && (error.message ?? '').includes('already registered')
}

async function justRegistered(
  client: SupabaseClient,
  staffId: string,
  fullName: string,
): Promise<PatientCard | null> {
  const { data } = await client
    .from('patients')
    .select(CARD_COLUMNS)
    .eq('created_by', staffId)
    .eq('full_name', fullName)
    .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as unknown as PatientCard | null) ?? null
}

export async function registerPatient(
  client: SupabaseClient,
  details: PatientDetails,
  staffId: string,
): Promise<{ patient: PatientCard | null; problem: string | null; queued?: boolean }> {
  const { data, error } = await client
    .from('patients')
    .insert({ ...details, created_by: staffId })
    .select(CARD_COLUMNS)
    .single()
  if (error && isDoubleTap(error)) {
    const first = await justRegistered(client, staffId, details.full_name)
    if (first) return { patient: first, problem: null }
  }
  // No network: keep it on this device; it registers when the network is
  // back (request 128, step 3).
  if (isNetworkFailure(error)) {
    addToOutbox(staffId, {
      kind: 'register',
      label: details.full_name,
      values: { ...details, created_by: staffId },
    })
    return { patient: null, problem: null, queued: true }
  }
  if (error) {
    console.warn(`Patient could not be registered: ${error.code}`)
    return {
      patient: null,
      problem: 'The patient could not be saved. Check the details and try again.',
    }
  }
  return { patient: data as unknown as PatientCard, problem: null }
}

// Register from old file (request 128): the name and the phone, and the
// date of birth and sex if the old file has them (Anthony, 2026-11-02:
// "they can add or skip it"). The database still gives the patient their
// own RMC number.
export async function registerFromOldFile(
  client: SupabaseClient,
  fullName: string,
  phone: string | null,
  staffId: string,
  dateOfBirth: string | null = null,
  sex: Sex | null = null,
): Promise<{ patient: PatientCard | null; problem: string | null }> {
  const cleanName = fullName.trim().replace(/\s+/g, ' ')
  const { data, error } = await client
    .from('patients')
    .insert({
      full_name: cleanName,
      phone,
      date_of_birth: dateOfBirth,
      sex,
      from_old_file: true,
      created_by: staffId,
    })
    .select(CARD_COLUMNS)
    .single()
  if (error && isDoubleTap(error)) {
    const first = await justRegistered(client, staffId, cleanName)
    if (first) return { patient: first, problem: null }
  }
  if (error) {
    console.warn(`Old file patient could not be registered: ${error.code}`)
    return {
      patient: null,
      problem: 'The patient could not be saved. Check the internet and try again.',
    }
  }
  return { patient: data as unknown as PatientCard, problem: null }
}

// Patients already registered with this phone number, so the Front Desk
// does not register the same person twice from an old file.
export async function findSamePhone(
  client: SupabaseClient,
  phone: string,
): Promise<PatientResult[]> {
  if (!phoneLooksRight(phone)) return []
  const { data } = await client
    .from('patients')
    .select(CARD_COLUMNS)
    .is('voided_at', null)
    .eq('phone', phone)
    .limit(5)
  return withVisits(client, (data as unknown as PatientCard[] | null) ?? [])
}

// ===== 6. Families (request 128, step 2) =====
// Start a family from a registered patient; answers the family's id. Tapped
// twice, the database answers the same family.
export async function startFamily(
  client: SupabaseClient,
  patientId: number,
): Promise<number | null> {
  const { data, error } = await client.rpc('start_family', { patient: patientId })
  if (error || typeof data !== 'number') return null
  return data
}

// Everybody in a family, oldest registration first.
export async function familyMembers(
  client: SupabaseClient,
  familyId: number,
): Promise<PatientCard[]> {
  const { data } = await client
    .from('patients')
    .select(CARD_COLUMNS)
    .is('voided_at', null)
    .eq('family_id', familyId)
    .order('created_at')
  return (data as unknown as PatientCard[] | null) ?? []
}

export async function familyNumber(
  client: SupabaseClient,
  familyId: number,
): Promise<string | null> {
  const { data } = await client
    .from('families')
    .select('family_number')
    .eq('id', familyId)
    .maybeSingle()
  return (data as { family_number: string } | null)?.family_number ?? null
}

export async function updatePatient(
  client: SupabaseClient,
  id: number,
  details: PatientDetails,
): Promise<string | null> {
  const { error } = await client.from('patients').update(details).eq('id', id)
  if (error) {
    console.warn(`Patient ${id} could not be updated: ${error.code}`)
    return 'The changes could not be saved. Check the details and try again.'
  }
  return null
}

// ===== 6. Sending a patient to a room =====
export async function sendToRoom(
  client: SupabaseClient,
  patientId: number,
  roomId: number,
  note: string,
  staffId: string,
): Promise<string | null> {
  const { error } = await client.from('queue_entries').insert({
    patient_id: patientId,
    room_id: roomId,
    note: note.trim() || null,
    sent_by: staffId,
  })
  if (!error) return null
  if (error.code === '23505')
    return 'This patient is already waiting in a room. Finish that visit first.'
  console.warn(`Patient ${patientId} could not be sent to a room: ${error.code}`)
  return 'The patient could not be sent. Try again.'
}

export async function loadRooms(
  client: SupabaseClient,
): Promise<{ id: number; name: string; kind: string }[]> {
  const { data } = await client
    .from('rooms')
    .select('id, name, kind')
    .eq('is_active', true)
    .order('id', { ascending: true })
  return (data as { id: number; name: string; kind: string }[] | null) ?? []
}
