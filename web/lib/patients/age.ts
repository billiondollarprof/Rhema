/*
 * lib/patients/age.ts: a patient's age, worked out from the date of birth.
 *
 * Why: Anthony's pick (c), 2026-10-29: nobody types an age. Babies show
 * days or months, everyone else years, the way staff say it.
 *
 * Never: store the age. It changes every day; the date of birth does not.
 */
export function ageFrom(dateOfBirth: string | null, today: Date = new Date()): string {
  // A patient from an old file may have no date of birth yet.
  if (!dateOfBirth) return 'Age not recorded'
  const born = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(born.getTime()) || born > today) return ''

  let years = today.getFullYear() - born.getFullYear()
  let months = today.getMonth() - born.getMonth()
  if (today.getDate() < born.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years >= 2) return `${years} years`
  if (years === 1) return months > 0 ? `1 year ${months} months` : '1 year'
  if (months >= 1) return months === 1 ? '1 month' : `${months} months`
  const days = Math.floor((today.getTime() - born.getTime()) / 86400000)
  return days === 1 ? '1 day' : `${days} days`
}

// "25 min" or "1 hr 10 min", for how long somebody has been waiting.
export function waitedSince(isoTime: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(isoTime).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}
