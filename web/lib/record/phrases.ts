/*
 * lib/record/phrases.ts: the short lists a doctor taps instead of typing,
 * one list for each box of the consultation note.
 *
 * Why: the director, 2026-11-16 (request 217c): "there is no proper place
 * where I can write my medical findings... symptoms, examination findings,
 * then diagnosis, then treatment plan." Big systems (Epic's SmartLists,
 * OpenMRS and Bahmni's coded answers) give the common answers as a tap and
 * keep free typing for the rest. A tap adds the words to the box; the doctor
 * can still change anything.
 *
 * Never: save anything on its own. These are only words to put in a box.
 */

// ===== 1. The four boxes, in the order a doctor thinks =====
export const NOTE_PARTS = [
  {
    key: 'complaint',
    label: 'Symptoms and history',
    hint: 'What the patient came with, and for how long',
  },
  { key: 'findings', label: 'Examination findings', hint: 'What you found on examination' },
  { key: 'assessment', label: 'Diagnosis', hint: 'What you think it is' },
  { key: 'plan', label: 'Treatment plan', hint: 'What the nurses should do, tests, next review' },
] as const

export type NotePart = (typeof NOTE_PARTS)[number]['key']

// ===== 2. The words to tap for each box =====
export const PHRASES: Record<NotePart, string[]> = {
  complaint: [
    'Fever',
    'Headache',
    'Body pains',
    'Weakness',
    'Cough',
    'Catarrh',
    'Sore throat',
    'Vomiting',
    'Diarrhoea',
    'Abdominal pain',
    'Loss of appetite',
    'Chest pain',
    'Difficulty breathing',
    'Painful urination',
    'Dizziness',
    'for 2 days',
    'for 1 week',
  ],
  findings: [
    'Conscious and alert',
    'Not in distress',
    'Febrile',
    'Afebrile',
    'Pale',
    'Not pale',
    'Anicteric',
    'Jaundiced',
    'Well hydrated',
    'Dehydrated',
    'Chest clear',
    'Crepitations',
    'Heart sounds normal',
    'Abdomen soft, not tender',
    'Epigastric tenderness',
    'No pedal oedema',
  ],
  assessment: [
    'Malaria',
    'Typhoid fever',
    'Upper respiratory tract infection',
    'Pneumonia',
    'Urinary tract infection',
    'Gastroenteritis',
    'Peptic ulcer disease',
    'Hypertension',
    'Diabetes mellitus',
    'Anaemia',
    'Sepsis',
    'Asthma',
    'To rule out',
  ],
  plan: [
    'Out-patient treatment',
    'Admit',
    'IV fluids',
    'Monitor vital signs 4 hourly',
    'Check blood sugar',
    'Lab tests requested',
    'Give medicines as charted',
    'Encourage oral fluids',
    'Counselled',
    'Review in 48 hours',
    'Review in 1 week',
    'Refer',
  ],
}

// ===== 3. Add a tapped phrase to what is already in the box =====
// "Fever" then "Cough" gives "Fever, cough". A phrase already there is not
// added twice.
export function addPhrase(text: string, phrase: string): string {
  const now = text.trimEnd()
  if (now.toLowerCase().includes(phrase.toLowerCase())) return text
  if (!now) return phrase
  const join = /[.,;:]$/.test(now) ? ' ' : ', '
  const next = phrase.startsWith('for ') ? phrase : phrase.charAt(0).toLowerCase() + phrase.slice(1)
  // A new box starts with a capital; after a full stop, the next one does too.
  return now + join + (now.endsWith('.') ? phrase : next)
}
