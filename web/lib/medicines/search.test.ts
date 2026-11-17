// search.test.ts: searches show only names that start with the letters
// (Anthony, 2026-11-17, request 220d).
import { describe, expect, it } from 'vitest'
import { findMedicines, type MedicineName } from './medicines'
import { searchLabTests } from '../lab/catalogue'

const names: MedicineName[] = ['Amlodipine', 'Paracetamol', 'Ampicillin', 'Metamizole'].map(
  (name) => ({ name, kind: 'medicine', strengths: [] }),
)

describe('findMedicines', () => {
  it('only names that start with the letters', () => {
    expect(findMedicines(names, 'am').map((n) => n.name)).toEqual(['Amlodipine', 'Ampicillin'])
    // "ta" is inside Paracetamol and Metamizole, but neither starts with it.
    expect(findMedicines(names, 'ta')).toEqual([])
  })
})

describe('searchLabTests', () => {
  it('finds by the start of a name or another name, never the middle', () => {
    expect(searchLabTests('fb').some((t) => /full blood count/i.test(t.name))).toBe(true)
    for (const test of searchLabTests('bl')) {
      const words = [test.name, ...(test.also ?? [])].map((w) => w.toLowerCase())
      expect(words.some((w) => w.startsWith('bl'))).toBe(true)
    }
  })
})
