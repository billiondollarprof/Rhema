/*
 * lib/offline/recordCopy.ts: the medical records of the patients seen in
 * this person's own room in the last 7 days (the newest 50), kept on this
 * device so doctors and nurses can read them with no network.
 *
 * Why: Anthony, 2026-11-17 (request 224, his yes): "anyone with a visit now";
 * text only, files shown as there but opened with the network; "front desk
 * keeps what is their business and let the nurses and doctors keep theirs";
 * "we just don't want them to lose data"; it may not slow the system.
 *
 * How:
 *   1. For staff with medical access only. The database lists the patients
 *      seen in their own room in the last 7 days, newest first, at most 50,
 *      and writes each copy in the activity log (copy_room_visits; request
 *      230c, 2026-11-20: "7 days for both doctors and nurses, and it should
 *      be their own room... to keep everything light"). Before that it was
 *      every visit open anywhere (copy_open_visits, request 224).
 *   2. Each record is read the normal way (the same screens' loaders), then
 *      the whole set is scrambled (AES-GCM) with a key made on this device
 *      that cannot be read out of the browser, and kept in IndexedDB.
 *   3. Refreshed after sign in and every 30 minutes. Older than 24 hours:
 *      not used and wiped. At sign out the key and the copy are deleted,
 *      so nothing left behind can be read.
 *   4. A record opened from the copy is noted with its time, and written in
 *      the activity log when the network is back (log_offline_view).
 *
 * Never: keep a file or a picture (only their names); keep the copy after
 * sign out or for more than 24 hours; copy for anybody without medical
 * access.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadPatientLab, type LabRequest, type LabResult } from '@/lib/lab/lab'
import { getPatient, type PatientResult } from '@/lib/patients/patients'
import { listPatientFiles, type PatientFile } from '@/lib/patients/patientFiles'
import { loadRecord, type MedicalRecord } from '@/lib/record/record'
import { isNetworkFailure } from './outbox'

export type SavedRecord = {
  patient: PatientResult
  record: MedicalRecord
  lab: { results: LabResult[]; open: LabRequest[] }
  files: PatientFile[]
}
type SavedSet = { savedAt: number; records: Record<number, SavedRecord> }

const DAY = 24 * 60 * 60 * 1000
const DB_NAME = 'rhema-records'

// ===== 1. The device store (IndexedDB), opened safely =====
function openStore(): Promise<IDBDatabase | null> {
  return new Promise((done) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('kept')
      request.onsuccess = () => done(request.result)
      request.onerror = () => done(null)
    } catch {
      done(null)
    }
  })
}

async function storeGet<T>(name: string): Promise<T | null> {
  const db = await openStore()
  if (!db) return null
  return new Promise((done) => {
    const ask = db.transaction('kept').objectStore('kept').get(name)
    ask.onsuccess = () => done((ask.result as T) ?? null)
    ask.onerror = () => done(null)
  })
}

async function storePut(name: string, value: unknown): Promise<void> {
  const db = await openStore()
  if (!db) return
  await new Promise<void>((done) => {
    const tx = db.transaction('kept', 'readwrite')
    tx.objectStore('kept').put(value, name)
    tx.oncomplete = () => done()
    tx.onerror = () => done()
  })
}

async function storeDelete(names: string[]): Promise<void> {
  const db = await openStore()
  if (!db) return
  await new Promise<void>((done) => {
    const tx = db.transaction('kept', 'readwrite')
    for (const name of names) tx.objectStore('kept').delete(name)
    tx.oncomplete = () => done()
    tx.onerror = () => done()
  })
}

// ===== 2. The key: made here, never readable, gone at sign out =====
async function keyFor(staffId: string, make: boolean): Promise<CryptoKey | null> {
  const kept = await storeGet<CryptoKey>(`key-${staffId}`)
  if (kept || !make) return kept
  try {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ])
    await storePut(`key-${staffId}`, key)
    return key
  } catch {
    return null
  }
}

// ===== 3. Save and read the scrambled set =====
async function saveSet(staffId: string, set: SavedSet): Promise<void> {
  const key = await keyFor(staffId, true)
  if (!key) return
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(set))
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  await storePut(`copy-${staffId}`, { iv, sealed })
}

async function readSet(staffId: string): Promise<SavedSet | null> {
  const key = await keyFor(staffId, false)
  const kept = await storeGet<{ iv: Uint8Array; sealed: ArrayBuffer }>(`copy-${staffId}`)
  if (!key || !kept) return null
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: kept.iv as Uint8Array<ArrayBuffer> },
      key,
      kept.sealed,
    )
    const set = JSON.parse(new TextDecoder().decode(plain)) as SavedSet
    // Older than a day: not used, and wiped.
    if (Date.now() - set.savedAt > DAY) {
      await wipeRecordCopy(staffId)
      return null
    }
    return set
  } catch {
    return null
  }
}

// ===== 4. Refresh: my room's last 7 days, read the normal way =====
// Quiet: any failure leaves the last copy as it is. One at a time, so it
// never competes with the screen the person is using.
export async function refreshRecordCopy(client: SupabaseClient, staffId: string): Promise<void> {
  const { data, error } = await client.rpc('copy_room_visits')
  if (error || !Array.isArray(data)) return
  const records: Record<number, SavedRecord> = {}
  for (const patientId of data as number[]) {
    const patient = await getPatient(client, patientId)
    if (!patient) continue
    // The copy itself was logged by copy_room_visits; this keeps the
    // record readable for the next 12 hours like any opening.
    const record = await loadRecord(client, patientId)
    if (!record) continue
    const [lab, files] = await Promise.all([
      loadPatientLab(client, patientId),
      listPatientFiles(client, patientId),
    ])
    records[patientId] = { patient, record, lab, files }
  }
  await saveSet(staffId, { savedAt: Date.now(), records })
}

export async function readSavedRecord(
  staffId: string,
  patientId: number,
): Promise<(SavedRecord & { savedAt: number }) | null> {
  const set = await readSet(staffId)
  const found = set?.records[patientId]
  return set && found ? { ...found, savedAt: set.savedAt } : null
}

// ===== 5. Openings from the copy, logged when the network is back =====
const viewsKey = (staffId: string) => `rhema-offline-views-${staffId}`

export function noteOfflineView(staffId: string, patientId: number) {
  try {
    const views = JSON.parse(localStorage.getItem(viewsKey(staffId)) ?? '[]') as [number, string][]
    views.push([patientId, new Date().toISOString()])
    localStorage.setItem(viewsKey(staffId), JSON.stringify(views.slice(-200)))
  } catch {
    // No storage: nothing to note.
  }
}

export async function sendOfflineViews(client: SupabaseClient, staffId: string): Promise<void> {
  let views: [number, string][] = []
  try {
    views = JSON.parse(localStorage.getItem(viewsKey(staffId)) ?? '[]')
  } catch {
    return
  }
  const left: [number, string][] = []
  for (const [patient, at] of views) {
    const { error } = await client.rpc('log_offline_view', { patient, seen_at: at })
    // Network still down: try later. Refused (too old): drop it.
    if (error && isNetworkFailure(error)) left.push([patient, at])
  }
  try {
    localStorage.setItem(viewsKey(staffId), JSON.stringify(left))
  } catch {
    // Kept as it was.
  }
}

// ===== 6. Sign out: the key and the copy go =====
export async function wipeRecordCopy(staffId: string): Promise<void> {
  await storeDelete([`key-${staffId}`, `copy-${staffId}`])
}
