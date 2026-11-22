// Tests for glucose and BMI in words (request 235).
import { describe, expect, it } from 'vitest'
import { bmiOf, bmiWords, glucoseWords } from './vitals'

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
