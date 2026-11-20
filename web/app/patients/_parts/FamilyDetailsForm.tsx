/*
 * app/patients/_parts/FamilyDetailsForm.tsx: the family's own details, as a
 * card: the family name (the surname), a phone and the address. Used by
 * Register patient and Register from old file when Family is chosen, and by
 * Edit family details on a member's page.
 *
 * Why: Anthony, 2026-11-19 (request 228b): "when you choose a family, you
 * just fill in the first details of that family... their family name, which
 * is the surname only... Then the family's own address... which include the
 * state and whatever." 2026-11-20: the phone is there but not compulsory;
 * only the family name is.
 *
 * Never: ask for anything personal here (date of birth, sex, next of kin).
 * Those belong to each member.
 */
'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import OptionSelect from '@/components/options/OptionSelect'
import Icon from '@/components/shell/Icon'
import styles from './patients.module.css'
import { cleanPhone, phoneLooksRight, type FamilyDetails } from '@/lib/patients/patients'

// ===== 1. The checks before saving, in words, field by field =====
export function checkFamily(family: FamilyDetails): Record<string, string> {
  const wrong: Record<string, string> = {}
  if (family.name.trim().length < 2) wrong.name = 'Type the family name (the surname).'
  if (family.phone && !phoneLooksRight(cleanPhone(family.phone)))
    wrong.phone = 'Type 11 digits, like 0803 555 0126.'
  return wrong
}

// Empty boxes are saved as nothing; the phone is tidied (spaces, +234).
export function tidyFamily(family: FamilyDetails): FamilyDetails {
  const blank = (value: string | null) => (value && value.trim() ? value.trim() : null)
  return {
    name: family.name.trim().replace(/\s+/g, ' '),
    phone: family.phone ? cleanPhone(family.phone) || null : null,
    address: blank(family.address),
    town: blank(family.town),
    lga: blank(family.lga),
    state: blank(family.state),
    country: blank(family.country) ?? 'Nigeria',
  }
}

type Props = {
  value: FamilyDetails
  onChange: (next: FamilyDetails) => void
  // What is wrong, from checkFamily, shown under each box.
  shown: Record<string, string>
  // For the drop downs (town, local government, State). Without them, boxes.
  client?: SupabaseClient
  staffId?: string
}

// ===== 2. The card =====
export default function FamilyDetailsForm({ value, onChange, shown, client, staffId }: Props) {
  function set<K extends keyof FamilyDetails>(key: K, next: FamilyDetails[K]) {
    onChange({ ...value, [key]: next })
  }

  function text(key: keyof FamilyDetails, label: string, placeholder = '', type = 'text') {
    return (
      <div className={styles.field}>
        <label htmlFor={`family-${key}`}>{label}</label>
        <input
          id={`family-${key}`}
          className={styles.input}
          type={type}
          inputMode={type === 'tel' ? 'tel' : undefined}
          placeholder={placeholder}
          value={value[key] ?? ''}
          aria-invalid={shown[key] ? 'true' : undefined}
          onChange={(event) => set(key, event.target.value)}
        />
        {shown[key] ? <small className={styles.error}>{shown[key]}</small> : null}
      </div>
    )
  }

  function pick(key: 'town' | 'lga' | 'state', label: string, placeholder: string) {
    if (!client || !staffId) return text(key, label)
    return (
      <div className={styles.field}>
        <label htmlFor={`family-${key}`}>{label}</label>
        <OptionSelect
          client={client}
          staffId={staffId}
          list={key}
          id={`family-${key}`}
          value={value[key] ?? ''}
          onChange={(next) => set(key, next)}
          placeholder={placeholder}
          otherLabel={`Type the ${label.toLowerCase()}`}
        />
      </div>
    )
  }

  return (
    <section className={styles.card} aria-label="Family details">
      <div className={styles.sectionHead}>
        <i>
          <Icon name="users" />
        </i>
        <div>
          <b>Family details</b>
          <small>The family name and where the family lives.</small>
        </div>
      </div>
      <div className={styles.fields}>
        {text('name', 'Family name (surname)', 'e.g. James')}
        {text('phone', 'Family phone (optional)', '0803 555 0126', 'tel')}
        {text('address', 'Address', 'House number and street')}
        {pick('town', 'Town / City', 'Choose the town')}
        {pick('lga', 'Local government (LGA)', 'Choose the local government')}
        {pick('state', 'State', 'Choose the State')}
        {text('country', 'Country')}
      </div>
    </section>
  )
}
