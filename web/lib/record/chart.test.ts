// chart.test.ts: the medication chart's sums (request 217c).
import { describe, expect, it } from 'vitest'
import { hoursBetween, isLate, lastDoseOf, nextDue } from './chart'
import { addPhrase } from './phrases'
import type { DoseGiven, Medication } from './record'

const med = (how_often: string | null, id = 1): Medication => ({
  id,
  voided_at: null,
  void_reason: null,
  voider: null,
  medicine: 'Paracetamol 500 mg tablet',
  dose: '1 g',
  how_often,
  status: 'active',
  created_at: '2026-11-16T08:00:00Z',
  author: null,
})
const dose = (given_at: string, medication_id: number | null = 1, voided = false): DoseGiven => ({
  id: Math.random(),
  voided_at: voided ? given_at : null,
  void_reason: voided ? 'wrong' : null,
  voider: null,
  medication_id,
  medicine: 'Paracetamol 500 mg tablet',
  dose: '1 g',
  given_at,
  note: null,
  giver: { full_name: 'Nurse A' },
})

describe('hoursBetween', () => {
  it('reads the pick list words', () => {
    expect(hoursBetween('Every 8 hours')).toBe(8)
    expect(hoursBetween('Twice daily')).toBe(12)
    expect(hoursBetween('Three times daily')).toBe(8)
    expect(hoursBetween('Four times daily')).toBe(6)
    expect(hoursBetween('Once daily')).toBe(24)
    expect(hoursBetween('At night')).toBe(24)
    expect(hoursBetween('Once weekly')).toBe(168)
  })
  it('reads the short forms doctors type', () => {
    expect(hoursBetween('tds')).toBe(8)
    expect(hoursBetween('bd')).toBe(12)
    expect(hoursBetween('6 hourly')).toBe(6)
  })
  it('gives no time for when needed, once only, or nothing', () => {
    expect(hoursBetween('When needed')).toBeNull()
    expect(hoursBetween('Once only (stat)')).toBeNull()
    expect(hoursBetween(null)).toBeNull()
    expect(hoursBetween('as the doctor says')).toBeNull()
  })
})

describe('lastDoseOf and nextDue', () => {
  it('finds the newest dose, skipping voided ones and other medicines', () => {
    const doses = [
      dose('2026-11-16T08:00:00Z'),
      dose('2026-11-16T16:00:00Z', 1, true),
      dose('2026-11-16T12:00:00Z'),
      dose('2026-11-16T14:00:00Z', 2),
    ]
    expect(lastDoseOf(med('Every 8 hours'), doses)?.given_at).toBe('2026-11-16T12:00:00Z')
  })
  it('due now before the first dose, then hours after the last one', () => {
    expect(nextDue(med('Every 8 hours'), null)).toBe('now')
    expect(nextDue(med('When needed'), null)).toBeNull()
    expect(nextDue(med('Once only (stat)'), null)).toBe('now')
    expect(nextDue(med('Once only (stat)'), dose('2026-11-16T08:00:00Z'))).toBeNull()
    const due = nextDue(med('Every 8 hours'), dose('2026-11-16T08:00:00Z'))
    expect(due instanceof Date && due.toISOString()).toBe('2026-11-16T16:00:00.000Z')
  })
  it('late only after 30 minutes past the due time', () => {
    const due = new Date('2026-11-16T16:00:00Z')
    expect(isLate(due, new Date('2026-11-16T16:20:00Z'))).toBe(false)
    expect(isLate(due, new Date('2026-11-16T16:40:00Z'))).toBe(true)
    expect(isLate(null)).toBe(false)
    expect(isLate('now')).toBe(true)
  })
})

describe('addPhrase', () => {
  it('joins tapped words with commas, once each', () => {
    let text = addPhrase('', 'Fever')
    text = addPhrase(text, 'Cough')
    text = addPhrase(text, 'for 2 days')
    expect(text).toBe('Fever, cough, for 2 days')
    expect(addPhrase(text, 'Cough')).toBe(text)
    expect(addPhrase('Seen today.', 'Fever')).toBe('Seen today. Fever')
  })
})
