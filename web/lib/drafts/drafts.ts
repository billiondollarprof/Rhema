/*
 * lib/drafts/drafts.ts: what somebody typed but did not save, kept on this
 * device for 30 minutes, so leaving a screen does not lose it.
 *
 * Why: Anthony, 2026-11-18 (request 227j): "when somebody add medication
 * and they do not save it and go back, can the system save it as draft...
 * for maybe 30 minutes... After that, it wipes, or when their session
 * expires, if they log out, it wipes."
 *
 * How:
 *   1. A form names its draft (for example "consult-12" for patient 12) and
 *      hands over what is typed. useDraft saves it a moment after typing
 *      stops, scrambled (AES-GCM) with a key made on this device that cannot
 *      be read out of the browser, the same lock as the records kept for no
 *      network (lib/offline/recordCopy.ts).
 *   2. Opening the form again within 30 minutes puts the draft back, and the
 *      form says so, with Discard.
 *   3. Saving or cancelling the form clears its draft. Older than 30
 *      minutes: not used, and deleted. Sign out: the key and every draft of
 *      that person go.
 *
 * Never: keep a draft after sign out or for more than 30 minutes, keep it
 * unscrambled, or show one person's draft to another.
 */
import { useEffect, useRef, useState } from 'react'

const MINUTES_30 = 30 * 60 * 1000
const DB_NAME = 'rhema-drafts'

type Sealed = { iv: Uint8Array; sealed: ArrayBuffer; savedAt: number }

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

// Deletes every stored name for which remove(name) answers true.
async function storeDeleteWhere(remove: (name: string) => boolean): Promise<void> {
  const db = await openStore()
  if (!db) return
  await new Promise<void>((done) => {
    const tx = db.transaction('kept', 'readwrite')
    const store = tx.objectStore('kept')
    const names = store.getAllKeys()
    names.onsuccess = () => {
      for (const name of names.result) if (remove(String(name))) store.delete(name)
    }
    tx.oncomplete = () => done()
    tx.onerror = () => done()
  })
}

// ===== 2. The key: made here, never readable, gone at sign out =====
async function keyFor(staffId: string): Promise<CryptoKey | null> {
  const kept = await storeGet<CryptoKey>(`key-${staffId}`)
  if (kept) return kept
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

// ===== 3. Save, read and clear one draft =====
export async function saveDraft(staffId: string, name: string, value: unknown): Promise<void> {
  const key = await keyFor(staffId)
  if (!key) return
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(value))
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  await storePut(`draft-${staffId}-${name}`, { iv, sealed, savedAt: Date.now() } as Sealed)
}

// The draft and when it was saved, or null (none, too old, or unreadable).
export async function readDraft<T>(
  staffId: string,
  name: string,
): Promise<{ value: T; savedAt: number } | null> {
  const kept = await storeGet<Sealed>(`draft-${staffId}-${name}`)
  if (!kept) return null
  if (Date.now() - kept.savedAt > MINUTES_30) {
    await clearDraft(staffId, name)
    return null
  }
  const key = await storeGet<CryptoKey>(`key-${staffId}`)
  if (!key) return null
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: kept.iv as Uint8Array<ArrayBuffer> },
      key,
      kept.sealed,
    )
    return { value: JSON.parse(new TextDecoder().decode(plain)) as T, savedAt: kept.savedAt }
  } catch {
    return null
  }
}

export async function clearDraft(staffId: string, name: string): Promise<void> {
  const full = `draft-${staffId}-${name}`
  await storeDeleteWhere((stored) => stored === full)
}

// ===== 4. Sign out: this person's key and drafts go =====
export async function wipeDrafts(staffId: string): Promise<void> {
  await storeDeleteWhere(
    (stored) => stored === `key-${staffId}` || stored.startsWith(`draft-${staffId}-`),
  )
}

// ===== 5. The hook a form uses =====
// value: what is typed now. isEmpty: true when there is nothing worth
// keeping. restore: puts a found draft back into the form. Answers when the
// draft put back was saved (to tell the person), and clear() for Save,
// Cancel and Discard.
export function useDraft<T>({
  staffId,
  name,
  value,
  isEmpty,
  restore,
}: {
  staffId: string | null | undefined
  name: string | null
  value: T
  isEmpty: (value: T) => boolean
  restore: (value: T) => void
}): { restoredAt: number | null; clear: () => void } {
  const [restoredAt, setRestoredAt] = useState<number | null>(null)
  // Saving waits until the draft has been looked for, so an empty form
  // never overwrites a draft before it is put back.
  const looked = useRef(false)
  const restoreRef = useRef(restore)
  useEffect(() => {
    restoreRef.current = restore
  })

  // Look for a draft once, when the form opens.
  useEffect(() => {
    looked.current = false
    if (!staffId || !name) return
    let current = true
    void readDraft<T>(staffId, name).then((found) => {
      if (!current) return
      if (found) {
        restoreRef.current(found.value)
        setRestoredAt(found.savedAt)
      }
      looked.current = true
    })
    return () => {
      current = false
    }
  }, [staffId, name])

  // Keep what is typed, a moment after typing stops.
  useEffect(() => {
    if (!staffId || !name || !looked.current) return
    const timer = window.setTimeout(() => {
      if (isEmpty(value)) void clearDraft(staffId, name)
      else void saveDraft(staffId, name, value)
    }, 600)
    return () => window.clearTimeout(timer)
    // isEmpty is a plain check that never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, name, value])

  return {
    restoredAt,
    clear: () => {
      setRestoredAt(null)
      if (staffId && name) void clearDraft(staffId, name)
    },
  }
}

// "Draft from 14:05 put back." for the line a form shows.
export function draftWords(savedAt: number, timeZone: string): string {
  const at = new Date(savedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
  return `Your unsaved draft from ${at} is back.`
}
