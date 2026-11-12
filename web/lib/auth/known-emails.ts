/*
 * lib/auth/known-emails.ts: the work emails that have signed in on this
 * computer or phone, so a person picks theirs instead of typing it.
 *
 * Why: Anthony, 2026-11-12: "on any computer, make sure that the system
 * remembers the email addresses that have logged into that computer... one
 * person: it is already there. Three: a drop down of the other individuals,
 * so the person can choose their own email and log in."
 *
 * What is stored: only the work email addresses, most recent first, at most
 * 10. They stay after a person signs out (that is the point), until the
 * person removes one on the sign in screen. Nothing else is kept here: no
 * name, no PIN, no code, no patient information.
 *
 * Never: keep anything but the email. Every read and write is wrapped,
 * because private browsing can block storage and sign in must still work.
 */

const KEY = 'rhema-known-emails'
const MOST = 10

const cleaned = (email: string) => email.trim().toLowerCase()

// ===== 1. Read =====
export function knownEmails(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === 'string').slice(0, MOST)
      : []
  } catch {
    return []
  }
}

// ===== 2. Remember one (it moves to the front) =====
export function rememberEmail(email: string) {
  const wanted = cleaned(email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(wanted)) return
  try {
    const others = knownEmails().filter((item) => item !== wanted)
    localStorage.setItem(KEY, JSON.stringify([wanted, ...others].slice(0, MOST)))
  } catch {
    // Storage blocked: this device simply does not remember.
  }
}

// ===== 3. Forget one (a shared computer: "that is not me") =====
export function forgetEmail(email: string) {
  const wanted = cleaned(email)
  try {
    localStorage.setItem(KEY, JSON.stringify(knownEmails().filter((item) => item !== wanted)))
  } catch {
    // Nothing to forget.
  }
}
