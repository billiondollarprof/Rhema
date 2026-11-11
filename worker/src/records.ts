/*
 * worker/src/records.ts: emails a patient their medical record.
 *
 * Why: Anthony, 2026-11-10: "the nurse should be able to forward medical
 * records to email if the patient's email is included... this is only with
 * the patient's consent, which means the patient provided their email.
 * Doctors and nurses should be able to as well." The Privacy Policy was
 * changed in the same release (PrivacyText.tsx, section 6).
 *
 * How it works:
 *   1. The staff member's own sign in token comes with the patient's number.
 *   2. We read everything AS THAT PERSON. The database shows the medical
 *      record only to staff with medical record access who have opened it,
 *      so anybody else gets nothing and no email goes.
 *   3. The email goes to the email on the patient's own record, never to an
 *      address typed in the request. No email on the record: nothing is sent.
 *   4. Before it goes, the send is written to the activity log (the table
 *      record_emails, by the staff member). If that cannot be written, the
 *      email is not sent.
 *
 * What it holds: the profile, allergies, conditions, medicines, doses given,
 * vital signs, nursing and consultation notes, and lab results. Not the
 * scanned files.
 *
 * Never: send to any address but the patient's own email on their record,
 * or log the address, the name or anything medical.
 */

// ===== 1. What this part is given =====
export interface RecordsEnv {
  SUPABASE_URL?: string
  SUPABASE_KEY?: string
  RESEND_API_KEY?: string
}

const FROM = 'Rhema Medical Centre <no-reply@rhemamedical.app>'
const REPLY_TO = 'info@rhemamedical.app'
const ADDRESS = 'Former License Office by Ojolu Junction, Sapele, Delta State, Nigeria'

const no = (status: number, error: string) => Response.json({ error }, { status })

type Patient = {
  id: number
  full_name: string
  patient_number: string
  date_of_birth: string | null
  sex: string | null
  email: string | null
}
type Who = { full_name: string } | null
export type RecordData = {
  patient: Patient
  profile: {
    blood_group: string | null
    genotype: string | null
    no_known_allergies: boolean | null
    last_menstrual_period: string | null
    gravida: number | null
    para: number | null
  } | null
  allergies: { allergen: string; reaction: string | null; severe: boolean }[]
  conditions: { name: string; status: string }[]
  medications: {
    medicine: string
    dose: string | null
    how_often: string | null
    status: string
  }[]
  doses: { medicine: string; dose: string | null; given_at: string }[]
  vitals: {
    recorded_at: string
    systolic: number | null
    diastolic: number | null
    pulse: number | null
    temperature_c: number | null
    breathing_rate: number | null
    spo2: number | null
    weight_kg: number | null
    height_cm: number | null
  }[]
  // "Other" vital signs, such as blood sugar.
  vitalExtras: { name: string; unit: string | null; value: number; recorded_at: string }[]
  nursing: { note: string; created_at: string; author: Who }[]
  consultations: {
    complaint: string | null
    findings: string | null
    assessment: string | null
    plan: string | null
    created_at: string
    author: Who
  }[]
  labs: { test: string; result: string | null; recorded_at: string }[]
}

// ===== 2. Small helpers =====
function tokenFrom(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer ([A-Za-z0-9._-]{20,4000})$/)
  return match ? match[1] : null
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const STATUS_WORDS: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspended',
  stopped: 'Stopped',
  resolved: 'Resolved',
}

function vitalsLine(v: RecordData['vitals'][number]): string {
  const parts = [
    v.systolic != null && v.diastolic != null ? `BP ${v.systolic}/${v.diastolic}` : '',
    v.pulse != null ? `Pulse ${v.pulse}` : '',
    v.temperature_c != null ? `Temp ${v.temperature_c} °C` : '',
    v.breathing_rate != null ? `Breathing ${v.breathing_rate}` : '',
    v.spo2 != null ? `SpO2 ${v.spo2}%` : '',
    v.weight_kg != null ? `Weight ${v.weight_kg} kg` : '',
    v.height_cm != null ? `Height ${v.height_cm} cm` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

// ===== 3. The email =====
// One list of sections, each with plain lines. The text and the HTML are
// both made from it, so they always say the same.
type Section = { title: string; lines: string[] }

export function recordSections(data: RecordData): Section[] {
  const sections: Section[] = []
  const profile = data.profile
  const profileLines = [
    profile?.blood_group ? `Blood group: ${profile.blood_group}` : '',
    profile?.genotype ? `Genotype: ${profile.genotype}` : '',
    profile?.last_menstrual_period ? `Last period: ${day(profile.last_menstrual_period)}` : '',
    profile?.gravida != null || profile?.para != null
      ? `Gravida / para: ${profile?.gravida ?? '-'} / ${profile?.para ?? '-'}`
      : '',
  ].filter(Boolean)
  if (profileLines.length) sections.push({ title: 'Profile', lines: profileLines })

  const allergyLines = data.allergies.map(
    (a) => `${a.allergen}${a.reaction ? ` (${a.reaction})` : ''}${a.severe ? ' - severe' : ''}`,
  )
  if (allergyLines.length) sections.push({ title: 'Allergies', lines: allergyLines })
  else if (profile?.no_known_allergies)
    sections.push({ title: 'Allergies', lines: ['No known allergies'] })

  if (data.conditions.length)
    sections.push({
      title: 'Conditions',
      lines: data.conditions.map((c) => `${c.name} - ${STATUS_WORDS[c.status] ?? c.status}`),
    })
  if (data.medications.length)
    sections.push({
      title: 'Medicines',
      lines: data.medications.map(
        (m) =>
          [m.medicine, m.dose, m.how_often].filter(Boolean).join(' · ') +
          ` - ${STATUS_WORDS[m.status] ?? m.status}`,
      ),
    })
  if (data.doses.length)
    sections.push({
      title: 'Doses given',
      lines: data.doses.map(
        (d) => `${when(d.given_at)}: ${d.medicine}${d.dose ? ` ${d.dose}` : ''}`,
      ),
    })
  if (data.vitals.length || data.vitalExtras.length)
    sections.push({
      title: 'Vital signs',
      lines: [
        ...data.vitals.map((v) => `${when(v.recorded_at)}: ${vitalsLine(v)}`),
        ...data.vitalExtras.map(
          (v) => `${when(v.recorded_at)}: ${v.name} ${v.value}${v.unit ? ` ${v.unit}` : ''}`,
        ),
      ],
    })
  if (data.labs.length)
    sections.push({
      title: 'Lab results',
      lines: data.labs.map(
        (l) => `${when(l.recorded_at)}: ${l.test}${l.result ? ` - ${l.result}` : ''}`,
      ),
    })
  if (data.consultations.length)
    sections.push({
      title: 'Consultation notes',
      lines: data.consultations.map((c) => {
        const parts = [
          c.complaint ? `Complaint: ${c.complaint}` : '',
          c.findings ? `Findings: ${c.findings}` : '',
          c.assessment ? `Assessment: ${c.assessment}` : '',
          c.plan ? `Plan: ${c.plan}` : '',
        ].filter(Boolean)
        return `${when(c.created_at)} (${c.author?.full_name ?? 'Staff'}) ${parts.join(' | ')}`
      }),
    })
  if (data.nursing.length)
    sections.push({
      title: 'Nursing notes',
      lines: data.nursing.map(
        (n) => `${when(n.created_at)} (${n.author?.full_name ?? 'Staff'}): ${n.note}`,
      ),
    })
  return sections
}

export function recordEmail(data: RecordData) {
  const patient = data.patient
  const sections = recordSections(data)
  const born = patient.date_of_birth ? `Born: ${day(patient.date_of_birth)}\n` : ''
  const subject = 'Your medical record from Rhema Medical Centre'
  const text =
    `Rhema Medical Centre\n${ADDRESS}\n\nMedical record\n` +
    `Patient: ${patient.full_name} (${patient.patient_number})\n${born}\n` +
    (sections.length
      ? sections.map((s) => `${s.title}\n${s.lines.map((l) => `- ${l}`).join('\n')}`).join('\n\n')
      : 'Nothing has been recorded yet.') +
    '\n\nThis was sent because you gave us your email address. If you did not ask for it, ' +
    'reply to this email or tell the front desk.'
  const block = (s: Section) =>
    `<tr><td style="padding:14px 24px 0;color:#0f2238"><div style="font-weight:bold;font-size:15px;color:#0a2a5e;border-bottom:1px solid #e2e8f0;padding-bottom:4px">${escapeHtml(s.title)}</div>` +
    s.lines
      .map(
        (l) => `<div style="font-size:14px;line-height:21px;padding:4px 0">${escapeHtml(l)}</div>`,
      )
      .join('') +
    '</td></tr>'
  const html = `<div style="background:#f2f5fa;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px">
<tr><td style="background:#0a2a5e;padding:18px 24px;color:#ffffff;border-radius:12px 12px 0 0"><div style="font-size:18px;font-weight:bold">RHEMA MEDICAL CENTRE</div><div style="font-size:12px;opacity:0.85">${escapeHtml(ADDRESS)}</div></td></tr>
<tr><td style="height:3px;background:#d9232d;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:20px 24px 0;color:#0f2238"><div style="font-size:22px;font-weight:bold">Medical record</div>
<div style="font-size:14px;margin-top:6px"><b>${escapeHtml(patient.full_name)}</b> (${escapeHtml(patient.patient_number)})${patient.date_of_birth ? `<br>Born ${escapeHtml(day(patient.date_of_birth))}` : ''}</div></td></tr>
${sections.length ? sections.map(block).join('') : '<tr><td style="padding:14px 24px;color:#5b6b80;font-size:14px">Nothing has been recorded yet.</td></tr>'}
<tr><td style="padding:20px 24px 24px;color:#5b6b80;font-size:12px;line-height:18px">This was sent because you gave us your email address. If you did not ask for it, reply to this email or tell the front desk.</td></tr>
</table></div>`
  return { subject, text, html }
}

// ===== 4. The route: POST /api/records/email =====
export async function emailRecord(
  request: Request,
  env: RecordsEnv,
  post: typeof fetch = fetch,
): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY || !env.RESEND_API_KEY)
    return no(503, 'Record emails are not set up yet')
  const token = tokenFrom(request)
  if (!token) return no(401, 'Please sign in again')

  // Step 1: which patient.
  let patientId = 0
  try {
    const body = (await request.json()) as { patientId?: unknown }
    patientId =
      typeof body.patientId === 'number' && Number.isInteger(body.patientId) ? body.patientId : 0
  } catch {
    return no(400, 'Bad request')
  }
  if (patientId <= 0) return no(400, 'Bad request')

  // Everything is asked as this person.
  const base = env.SUPABASE_URL
  const headers = { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}` }
  const get = (path: string) => post(`${base}/rest/v1/${path}`, { headers })

  // Step 2: the patient, and the email on their record.
  const found = await get(
    `patients?select=id,full_name,patient_number,date_of_birth,sex,email&id=eq.${patientId}&voided_at=is.null&limit=1`,
  )
  if (!found.ok) return no(403, 'Not allowed')
  const patient = ((await found.json()) as Patient[])[0]
  if (!patient) return no(404, 'Patient not found')
  if (!patient.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patient.email))
    return no(409, 'This patient has no email on their record')

  // Step 3: open the record (the database logs it), then read it. Somebody
  // without medical record access is refused here.
  const opened = await post(`${base}/rest/v1/rpc/open_record`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient: patientId }),
  })
  if (!opened.ok) return no(403, 'Not allowed')
  const who = (column: string) => `author:staff!${column}(full_name)`
  const ask = (table: string, columns: string, order: string, limit: number, voided = true) =>
    get(
      `${table}?select=${columns}&patient_id=eq.${patientId}${voided ? '&voided_at=is.null' : ''}` +
        `&order=${order}.desc&limit=${limit}`,
    )
  const answers = await Promise.all([
    get(
      `medical_profiles?select=blood_group,genotype,no_known_allergies,last_menstrual_period,gravida,para&patient_id=eq.${patientId}&limit=1`,
    ),
    ask('allergies', 'allergen,reaction,severe,created_at', 'created_at', 100),
    ask('conditions', 'name,status,created_at', 'created_at', 100),
    ask('patient_medications', 'medicine,dose,how_often,status,created_at', 'created_at', 100),
    ask('medications_given', 'medicine,dose,given_at', 'given_at', 50),
    ask(
      'vital_signs',
      'recorded_at,systolic,diastolic,pulse,temperature_c,breathing_rate,spo2,weight_kg,height_cm',
      'recorded_at',
      30,
    ),
    ask('vital_extras', 'name,unit,value,recorded_at', 'recorded_at', 60),
    ask('nursing_notes', `note,created_at,${who('written_by')}`, 'created_at', 50),
    ask(
      'consultation_notes',
      `complaint,findings,assessment,plan,created_at,${who('written_by')}`,
      'created_at',
      30,
    ),
    ask('lab_results', 'test,result,recorded_at', 'recorded_at', 50),
  ])
  // The "Other" vital signs (6th) are not required: if that part is not there
  // yet, the rest still goes.
  if (answers.some((answer, at) => !answer.ok && at !== 6)) return no(403, 'Not allowed')
  const [
    profile,
    allergies,
    conditions,
    medications,
    doses,
    vitals,
    vitalExtras,
    nursing,
    consultations,
    labs,
  ] = (await Promise.all(answers.map((answer) => answer.json()))) as unknown[][]
  const data: RecordData = {
    patient,
    profile: (profile[0] as RecordData['profile']) ?? null,
    allergies: allergies as RecordData['allergies'],
    conditions: conditions as RecordData['conditions'],
    medications: medications as RecordData['medications'],
    doses: doses as RecordData['doses'],
    vitals: vitals as RecordData['vitals'],
    vitalExtras: (Array.isArray(vitalExtras) ? vitalExtras : []) as RecordData['vitalExtras'],
    nursing: nursing as RecordData['nursing'],
    consultations: consultations as RecordData['consultations'],
    labs: labs as RecordData['labs'],
  }

  // Step 4: write the send to the activity log first. No entry, no email.
  const logged = await post(`${base}/rest/v1/record_emails`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ patient_id: patientId }),
  })
  if (!logged.ok) return no(403, 'Not allowed')

  // Step 5: send it.
  const { subject, text, html } = recordEmail(data)
  const sent = await post('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      // A double tap sends one email. The 5 minute part lets it be sent
      // again later if the patient asks.
      'Idempotency-Key': `rhema-record-${new URL(request.url).hostname}-${patientId}-${Math.floor(Date.now() / 300_000)}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [patient.email],
      reply_to: REPLY_TO,
      subject,
      text,
      html,
    }),
  })
  const why = sent.ok ? '' : ` ${(await sent.text().catch(() => '')).slice(0, 200)}`
  // The patient's number and Resend's answer, never the address or anything medical.
  console.log(`Record email for patient ${patientId}: ${sent.status}${why}`)
  if (!sent.ok) return no(502, 'The email could not be sent')
  return Response.json({ sent: true })
}
