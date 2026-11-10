// Tests for the record email route. Supabase and Resend are pretend: `post`
// records what would be sent. Made up people only.
import { describe, expect, it } from 'vitest'
import { emailRecord, recordEmail } from './records'

const ENV = { SUPABASE_URL: 'https://db.test', SUPABASE_KEY: 'public', RESEND_API_KEY: 'rk' }
const TOKEN = 'a'.repeat(40)
const PATIENT = {
  id: 7,
  full_name: 'Made Up Patient',
  patient_number: 'RMC-000007',
  date_of_birth: '1990-04-02',
  sex: 'female',
  email: 'made.up@example.com',
}

function ask(
  body: unknown,
  headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}` },
) {
  return new Request('https://rhemamedical.app/api/records/email', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

// A pretend network. `patients` is what the database shows this person;
// `open` and `log` are the answers to opening the record and to the log
// write; `resend` is Resend's answer.
function pretend(
  options: {
    patients?: unknown[]
    open?: number
    tables?: number
    log?: number
    resend?: number
  } = {},
) {
  const { patients = [PATIENT], open = 204, tables = 200, log = 201, resend = 200 } = options
  const calls: { url: string; init?: RequestInit }[] = []
  const post = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.includes('/rest/v1/patients?')) return Response.json(patients)
    if (url.includes('/rpc/open_record')) return new Response(null, { status: open })
    if (url.includes('/rest/v1/record_emails')) return new Response(null, { status: log })
    if (url.includes('/rest/v1/allergies?'))
      return new Response(
        JSON.stringify([{ allergen: 'Penicillin', reaction: 'Rash', severe: true }]),
        {
          status: tables,
        },
      )
    if (url.includes('/rest/v1/patient_medications?'))
      return new Response(
        JSON.stringify([
          { medicine: 'Metformin', dose: '500 mg', how_often: 'Twice daily', status: 'active' },
        ]),
        { status: tables },
      )
    if (url.includes('/rest/v1/'))
      return new Response(url.includes('medical_profiles') ? '[]' : '[]', { status: tables })
    return new Response('{}', { status: resend })
  }) as typeof fetch
  return { post, calls }
}

describe('emailRecord', () => {
  it('sends the record to the email on the patient record, read as the staff member', async () => {
    const { post, calls } = pretend()
    const response = await emailRecord(ask({ patientId: 7 }), ENV, post)
    expect(response.status).toBe(200)
    // Everything is asked with the staff member's own token.
    for (const call of calls.filter((c) => c.url.startsWith('https://db.test'))) {
      expect((call.init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    }
    const resend = calls[calls.length - 1]
    expect(resend.url).toBe('https://api.resend.com/emails')
    const sent = JSON.parse(String(resend.init?.body))
    expect(sent.to).toEqual(['made.up@example.com'])
    expect(sent.html).toContain('Penicillin')
    expect(sent.html).toContain('Metformin')
    expect(sent.text).toContain('Made Up Patient')
    expect((resend.init?.headers as Record<string, string>)['Idempotency-Key']).toMatch(
      /^rhema-record-rhemamedical\.app-7-\d+$/,
    )
  })

  it('writes the send to the activity log before it sends', async () => {
    const { post, calls } = pretend()
    await emailRecord(ask({ patientId: 7 }), ENV, post)
    const logAt = calls.findIndex((c) => c.url.includes('/rest/v1/record_emails'))
    const sendAt = calls.findIndex((c) => c.url === 'https://api.resend.com/emails')
    expect(logAt).toBeGreaterThan(-1)
    expect(logAt).toBeLessThan(sendAt)
  })

  it('sends nothing when the log cannot be written', async () => {
    const { post, calls } = pretend({ log: 403 })
    const response = await emailRecord(ask({ patientId: 7 }), ENV, post)
    expect(response.status).toBe(403)
    expect(calls.some((c) => c.url === 'https://api.resend.com/emails')).toBe(false)
  })

  it('never sends to an address given in the request', async () => {
    const { post, calls } = pretend()
    await emailRecord(ask({ patientId: 7, email: 'someone.else@example.com' }), ENV, post)
    const sent = JSON.parse(String(calls[calls.length - 1].init?.body))
    expect(sent.to).toEqual(['made.up@example.com'])
  })

  it('sends nothing when the patient has no email on their record', async () => {
    const { post, calls } = pretend({ patients: [{ ...PATIENT, email: null }] })
    const response = await emailRecord(ask({ patientId: 7 }), ENV, post)
    expect(response.status).toBe(409)
    expect(calls.some((c) => c.url === 'https://api.resend.com/emails')).toBe(false)
  })

  it('sends nothing when the database refuses to open the record', async () => {
    const { post, calls } = pretend({ open: 403 })
    const response = await emailRecord(ask({ patientId: 7 }), ENV, post)
    expect(response.status).toBe(403)
    expect(calls.some((c) => c.url === 'https://api.resend.com/emails')).toBe(false)
  })

  it('sends nothing when a part of the record is refused', async () => {
    const { post, calls } = pretend({ tables: 403 })
    const response = await emailRecord(ask({ patientId: 7 }), ENV, post)
    expect(response.status).toBe(403)
    expect(calls.some((c) => c.url === 'https://api.resend.com/emails')).toBe(false)
  })

  it('sends nothing to somebody not signed in, and asks nobody', async () => {
    const { post, calls } = pretend()
    const response = await emailRecord(ask({ patientId: 7 }, {}), ENV, post)
    expect(response.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('refuses a bad patient number, and asks nobody', async () => {
    const { post, calls } = pretend()
    expect((await emailRecord(ask({ patientId: 'x' }), ENV, post)).status).toBe(400)
    expect((await emailRecord(ask({ patientId: -3 }), ENV, post)).status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('says it is not set up when the Resend key is missing', async () => {
    const { post, calls } = pretend()
    const response = await emailRecord(ask({ patientId: 7 }), { ...ENV, RESEND_API_KEY: '' }, post)
    expect(response.status).toBe(503)
    expect(calls).toHaveLength(0)
  })

  it('reports a failed send', async () => {
    const { post } = pretend({ resend: 500 })
    expect((await emailRecord(ask({ patientId: 7 }), ENV, post)).status).toBe(502)
  })
})

describe('the email', () => {
  it('makes a note harmless in the HTML', () => {
    const { html } = recordEmail({
      patient: PATIENT,
      profile: null,
      allergies: [],
      conditions: [],
      medications: [],
      doses: [],
      vitals: [],
      nursing: [{ note: '<script>x</script>', created_at: '2026-11-10T10:00:00Z', author: null }],
      consultations: [],
      labs: [],
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('says so when nothing has been recorded', () => {
    const { text } = recordEmail({
      patient: PATIENT,
      profile: null,
      allergies: [],
      conditions: [],
      medications: [],
      doses: [],
      vitals: [],
      nursing: [],
      consultations: [],
      labs: [],
    })
    expect(text).toContain('Nothing has been recorded yet.')
  })
})
