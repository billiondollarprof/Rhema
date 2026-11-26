// Tests for glucose and BMI in words (request 235).
import { describe, expect, it } from 'vitest'
import { bmiOf, bmiWords, glucoseWords, vitalsProblem } from './vitals'

describe('glucoseWords', () => {
  it('shows mmol/L with mg/dL beside it', () => {
    expect(glucoseWords(5.4, 'mmol/L', 'fasting')).toBe('Fasting glucose 5.4 mmol/L (97 mg/dL)')
  })
  it('shows mg/dL with mmol/L beside it', () => {
    expect(glucoseWords(180, 'mg/dL', 'random')).toBe('Random glucose 180 mg/dL (10.0 mmol/L)')
  })
  it('says nothing without fasting or random, or the unit', () => {
    expect(glucoseWords(5.4, 'mmol/L', null)).toBeNull()
    expect(glucoseWords(5.4, null, 'random')).toBeNull()
  })
})

describe('bmi', () => {
  it('works it out from kg and cm', () => {
    expect(bmiOf(70, 170)).toBe(24.2)
    expect(bmiWords(24.2)).toBe('BMI 24.2 (healthy)')
  })
  it('rounds a half up (80 kg at 160 cm is 31.25)', () => {
    expect(bmiOf(80, 160)).toBe(31.3)
  })
  it('needs both', () => {
    expect(bmiOf(70, null)).toBeNull()
    expect(bmiWords(null)).toBeNull()
  })
  it('names the bands', () => {
    expect(bmiWords(17)).toBe('BMI 17 (underweight)')
    expect(bmiWords(31)).toBe('BMI 31 (obese)')
  })
})

// Request 248: the live log showed a BP top refused with no word of which.
describe('vitalsProblem', () => {
  it('names a reading the database would refuse', () => {
    expect(vitalsProblem({ systolic: 12080 })).toEqual({
      key: 'systolic',
      words: 'BP top must be between 40 and 300.',
    })
    expect(vitalsProblem({ pulse: 84.5 })).toEqual({
      key: 'pulse',
      words: 'Pulse must be a whole number.',
    })
    expect(vitalsProblem({ spo2: 101 })?.words).toBe('Oxygen (SpO2) must be between 50 and 100.')
  })
  it('lets normal readings through', () => {
    expect(
      vitalsProblem({ systolic: 120, diastolic: 80, temperature_c: 36.8, weight_kg: 68.5 }),
    ).toBe(null)
    expect(vitalsProblem({ systolic: null })).toBe(null)
  })
})
