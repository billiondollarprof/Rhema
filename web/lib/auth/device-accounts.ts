/*
 * lib/auth/device-accounts.ts: the list of people who have signed in on
 * this computer or phone.
 *
 * Why: on a shared computer (a nursing station, the lab) each person signs
 * in once with an email code. After that the device remembers them, and
 * they switch in by tapping their name and typing their own PIN. This file
 * keeps that list in the browser's storage.
 *
 * What is stored: name, email, role, when they last used the device, and
 * whether their screen is locked. That is shown on the lock screen to
 * anyone at that desk, so it holds nothing else.
 *
 * Never: store patient data, a PIN, or a code here. Every read and write is
 * wrapped in try/catch, because private browsing can block storage, and the
 * app must still work (it simply forgets the list).
 */

// ===== 1. What one remembered person looks like =====
export type DeviceAccount = {
  id: string
  name: string
  email: string
  role: string
  lastActive: number
  locked: boolean
}

const LIST_KEY = 'rhema-device-accounts'
const ACTIVE_KEY = 'rhema-active-account'

// ===== 2. Read and write the whole list =====
export function listAccounts(): DeviceAccount[] {
  try {
    const text = localStorage.getItem(LIST_KEY)
    return text ? (JSON.parse(text) as DeviceAccount[]) : []
  } catch {
    return []
  }
}

function saveList(accounts: DeviceAccount[]) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(accounts))
  } catch {
    // Storage blocked: the device just will not remember anyone.
  }
}

export function getAccount(id: string): DeviceAccount | undefined {
  return listAccounts().find((account) => account.id === id)
}

// Add a person, or update them if they are already on the list.
export function saveAccount(account: DeviceAccount) {
  const others = listAccounts().filter((item) => item.id !== account.id)
  saveList([...others, account])
}

export function updateAccount(id: string, change: Partial<DeviceAccount>) {
  const accounts = listAccounts().map((item) => (item.id === id ? { ...item, ...change } : item))
  saveList(accounts)
}

export function removeAccount(id: string) {
  saveList(listAccounts().filter((item) => item.id !== id))
  if (getActiveId() === id) setActiveId(null)
}

// ===== 3. Who is using the device right now =====
export function getActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // Storage blocked: nothing to do.
  }
}
