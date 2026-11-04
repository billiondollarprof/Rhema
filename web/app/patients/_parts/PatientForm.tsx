/*
 * app/patients/_parts/PatientForm.tsx: the patient's registration card, as
 * a form. Used by Register and by Edit, so both always ask the same things.
 *
 * Why: the RHEMA demo's form, in its three sections: Patient (name, date of
 * birth with the age shown under it, sex, category), Contact and address,
 * and Next of kin. Register also shows Payment, the card fee (request 141,
 * Anthony, 2026-11-04: "registration is like they are buying card... they
 * used to pay some amount of money"; "fee can be left empty"). Edit does
 * not: a later payment is taken on the patient's page.
 *
 * Checks before saving: a name, a date of birth (not in the future), sex,
 * and phone numbers written as 11 digits starting with 0 (spaces, dashes
 * and +234 are tidied up automatically).
 *
 * Never: ask for anything clinical here. This card is seen by the front
 * desk; the medical record has its own pages and stricter rules.
 */
'use client'

import { useState } from 'react'
import Icon from '@/components/shell/Icon'
import styles from './patients.module.css'
import { ageFrom } from '@/lib/patients/age'
import { PAYMENT_MODES, type PaymentMode } from '@/lib/lab/lab'
import {
  cleanPhone,
  phoneLooksRight,
  type Category,
  type PatientDetails,
  type Sex,
} from '@/lib/patients/patients'

// ===== 1. Empty form, and what the form holds while typing =====
export const EMPTY_DETAILS: PatientDetails = {
  full_name: '',
  date_of_birth: '',
  sex: 'female',
  category: 'individual',
  phone: null,
  email: null,
  address: null,
  town: null,
  lga: null,
  state: null,
  country: 'Nigeria',
  next_of_kin_name: null,
  next_of_kin_relationship: null,
  next_of_kin_phone: null,
  family_id: null,
}

// The card fee typed at registration. Null when the fee was left empty.
export type CardFee = { amount: number; mode: PaymentMode } | null

type FormProps = {
  initial: PatientDetails
  saveLabel: string
  busy: boolean
  problem: string | null
  // Register only: show the Payment section.
  withPayment?: boolean
  onSave: (details: PatientDetails, fee: CardFee) => void
}

// "7,500" and "7500.50" read as numbers; empty reads as nothing (null);
// anything else reads as NaN, which the check below refuses.
function readFee(typed: string): number | null {
  const plain = typed.replace(/[,\s]/g, '')
  if (!plain) return null
  const value = Number(plain)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN
}

// Text fields are kept as typed; empty ones are saved as nothing (null).
function tidy(details: PatientDetails): PatientDetails {
  const blankToNull = (value: string | null) => (value && value.trim() ? value.trim() : null)
  return {
    ...details,
    full_name: details.full_name.trim().replace(/\s+/g, ' '),
    phone: details.phone ? cleanPhone(details.phone) || null : null,
    next_of_kin_phone: details.next_of_kin_phone
      ? cleanPhone(details.next_of_kin_phone) || null
      : null,
    email: blankToNull(details.email),
    address: blankToNull(details.address),
    town: blankToNull(details.town),
    lga: blankToNull(details.lga),
    state: blankToNull(details.state),
    country: blankToNull(details.country) ?? 'Nigeria',
    next_of_kin_name: blankToNull(details.next_of_kin_name),
    next_of_kin_relationship: blankToNull(details.next_of_kin_relationship),
  }
}

// What is wrong, field by field, in words. Empty when all is well.
function check(details: PatientDetails): Record<string, string> {
  const wrong: Record<string, string> = {}
  if (details.full_name.length < 2) wrong.full_name = 'Type the patient’s full name.'
  if (!details.date_of_birth) wrong.date_of_birth = 'Choose the date of birth.'
  else if (new Date(details.date_of_birth) > new Date())
    wrong.date_of_birth = 'The date of birth cannot be in the future.'
  if (details.phone && !phoneLooksRight(details.phone))
    wrong.phone = 'Type 11 digits, like 0803 555 0126.'
  if (details.next_of_kin_phone && !phoneLooksRight(details.next_of_kin_phone))
    wrong.next_of_kin_phone = 'Type 11 digits, like 0803 555 0126.'
  if (details.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email))
    wrong.email = 'This email does not look right.'
  return wrong
}

// ===== 2. The form =====
export default function PatientForm({
  initial,
  saveLabel,
  busy,
  problem,
  withPayment = false,
  onSave,
}: FormProps) {
  const [details, setDetails] = useState<PatientDetails>(initial)
  const [shown, setShown] = useState<Record<string, string>>({})
  const [fee, setFee] = useState('')
  const [mode, setMode] = useState<PaymentMode>('cash')

  function set<K extends keyof PatientDetails>(key: K, value: PatientDetails[K]) {
    setDetails((now) => ({ ...now, [key]: value }))
  }

  function save() {
    const ready = tidy(details)
    const wrong = check(ready)
    const amount = withPayment ? readFee(fee) : null
    if (amount !== null && !(amount > 0 && amount < 100000000))
      wrong.fee = 'Type the card fee in naira, like 2,000, or leave it empty.'
    setShown(wrong)
    if (Object.keys(wrong).length === 0) onSave(ready, amount ? { amount, mode } : null)
    else document.getElementById(`field-${Object.keys(wrong)[0]}`)?.focus()
  }

  // One text field with its label and, if any, what is wrong with it.
  function text(key: keyof PatientDetails, label: string, placeholder = '', type = 'text') {
    return (
      <div className={styles.field}>
        <label htmlFor={`field-${key}`}>{label}</label>
        <input
          id={`field-${key}`}
          className={styles.input}
          type={type}
          inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : undefined}
          placeholder={placeholder}
          value={(details[key] as string | null) ?? ''}
          aria-invalid={shown[key] ? 'true' : undefined}
          onChange={(event) => set(key, event.target.value as never)}
        />
        {shown[key] ? <small className={styles.error}>{shown[key]}</small> : null}
      </div>
    )
  }

  const age = details.date_of_birth ? ageFrom(details.date_of_birth) : ''

  return (
    <div className={styles.page}>
      <div className={`${styles.twoColumns} ${styles.stack}`}>
        <div className={styles.stack}>
          {/* ===== 3. Patient ===== */}
          <section className={styles.card}>
            <div className={styles.sectionHead}>
              <i>
                <Icon name="reg" />
              </i>
              <div>
                <b>Patient</b>
                <small>Who are we registering?</small>
              </div>
            </div>
            <div className={styles.fields}>
              {text('full_name', 'Full name', 'e.g. Chidinma Okafor')}
              <div className={styles.field}>
                <label htmlFor="field-date_of_birth">Date of birth</label>
                <input
                  id="field-date_of_birth"
                  className={styles.input}
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={details.date_of_birth}
                  aria-invalid={shown.date_of_birth ? 'true' : undefined}
                  onChange={(event) => set('date_of_birth', event.target.value)}
                />
                {age ? <small className={styles.hint}>Age: {age}</small> : null}
                {shown.date_of_birth ? (
                  <small className={styles.error}>{shown.date_of_birth}</small>
                ) : null}
              </div>
              <div className={styles.field}>
                <label>Sex</label>
                <div className={styles.segments} role="group" aria-label="Sex">
                  {(['female', 'male'] as Sex[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={details.sex === value}
                      onClick={() => set('sex', value)}
                    >
                      {value === 'female' ? 'Female' : 'Male'}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label>Patient category</label>
                <div className={styles.segments} role="group" aria-label="Patient category">
                  {(['individual', 'family', 'antenatal'] as Category[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={details.category === value}
                      onClick={() => set('category', value)}
                    >
                      {value[0].toUpperCase() + value.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ===== 4. Contact and address ===== */}
          <section className={styles.card}>
            <div className={styles.sectionHead}>
              <i>
                <Icon name="msg" />
              </i>
              <div>
                <b>Contact and address</b>
                <small>How do we reach the patient?</small>
              </div>
            </div>
            <div className={styles.fields}>
              {text('phone', 'Phone / WhatsApp number', '0803 555 0126', 'tel')}
              {text('email', 'Email (optional)', 'name@example.com', 'email')}
              {text('address', 'Address', 'House number and street')}
              {text('town', 'Town / City', 'e.g. Surulere')}
              {text('lga', 'Local government (LGA)')}
              {text('state', 'State')}
              {text('country', 'Country')}
            </div>
          </section>
        </div>

        {/* ===== 5. Next of kin ===== */}
        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <i>
              <Icon name="users" />
            </i>
            <div>
              <b>Next of kin</b>
              <small>Who should we contact in an emergency?</small>
            </div>
          </div>
          <div className={styles.fields}>
            {text('next_of_kin_name', 'Full name', 'e.g. Ngozi Okoro')}
            {text('next_of_kin_relationship', 'Relationship', 'e.g. Spouse, Parent')}
            {text('next_of_kin_phone', 'Phone / WhatsApp number', '', 'tel')}
          </div>
        </section>
      </div>

      {/* ===== 6. Payment: the card fee (Register only) ===== */}
      {withPayment ? (
        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <i>
              <Icon name="file" />
            </i>
            <div>
              <b>Payment</b>
              <small>The card fee, if the patient is paying now.</small>
            </div>
          </div>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="field-fee">Card fee (optional)</label>
              <div className={styles.money}>
                <span aria-hidden="true">₦</span>
                <input
                  id="field-fee"
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="0"
                  value={fee}
                  aria-invalid={shown.fee ? 'true' : undefined}
                  onChange={(event) => setFee(event.target.value.replace(/[^\d.,\s]/g, ''))}
                />
              </div>
              {shown.fee ? <small className={styles.error}>{shown.fee}</small> : null}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldTitle}>Paid by</span>
              <div className={styles.segments} role="group" aria-label="Paid by">
                {PAYMENT_MODES.map(([value, words]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                  >
                    {words}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ===== 7. Save ===== */}
      {problem ? <p className={styles.error}>{problem}</p> : null}
      <div className={styles.buttons}>
        <button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={save}>
          {busy ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  )
}
