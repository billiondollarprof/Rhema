// Tests for the receipt email route (request 159). Supabase and Resend are
// pretend: `post` records what would be sent. Made up people only.
import { describe, expect, it } from 'vitest'
import { emailReceipt, receiptCode, receiptEmail } from './receipts'

const ENV = { SUPABASE_URL: 'https://db.test', SUPABASE_KEY: 'public', RESEND_API_KEY: 'rk' }
const TOKEN = 'a'.repeat(40)
const PATIENT = {
  id: 7,
  full_name: 'Made Up Patient',
  patient_number: 'RMC-000007',
  email: 'made.up@example.com',
}
const ROW = {
  id: 12,
  receipt_number: 'RCT-000123',
  amount: 5000,
  mode: 'cash',
  received_at: '2026-11-09T07:52:00Z',
  receiver: { full_name: 'Made Up Desk' },
  patient: PATIENT,
  lines: [{ label: 'Consultation', amount: 5000 }],
}

function ask(
  body: unknown,
  headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}` },
) {
  return new Request('https://rhemamedical.app/api/receipts/email', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function pretend(rows: unknown[] | null, resendStatus = 200) {
  const calls: { url: string; init?: RequestInit }[] = []
  const post = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.startsWith('https://db.test'))
      return rows === null ? new Response('no', { status: 401 }) : Response.json(rows)
    return new Response('{}', { status: resendStatus })
  }) as typeof fetch
  return { post, calls }
}

describe('emailReceipt', () => {
  it('sends the receipt to the email on the patient record, read as the staff member', async () => {
    const { post, calls } = pretend([ROW])
    const response = await emailReceipt(ask({ ids: [12] }), ENV, post)
    expect(response.status).toBe(200)
    expect(calls[0].url).toContain('id=in.(12)')
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    const sent = JSON.parse(String(calls[1].init?.body))
    expect(sent.to).toEqual(['made.up@example.com'])
    expect(sent.html).toContain('2611 0900 0123')
    expect(sent.html).toContain('Consultation')
  })

  it('never sends to an address given in the request', async () => {
    const { post, calls } = pretend([ROW])
    await emailReceipt(ask({ ids: [12], email: 'someone@else.test' }), ENV, post)
    expect(JSON.parse(String(calls[1].init?.body)).to).toEqual(['made.up@example.com'])
  })

  it('sends nothing when the patient has no email', async () => {
    const { post, calls } = pretend([{ ...ROW, patient: { ...PATIENT, email: null } }])
    expect((await emailReceipt(ask({ ids: [12] }), ENV, post)).status).toBe(409)
    expect(calls).toHaveLength(1)
  })

  it('sends nothing when the person may not see the receipt', async () => {
    const { post, calls } = pretend([])
    expect((await emailReceipt(ask({ ids: [12] }), ENV, post)).status).toBe(404)
    expect(calls).toHaveLength(1)
  })

  it('sends nothing when Supabase refuses the token', async () => {
    const { post, calls } = pretend(null)
    expect((await emailReceipt(ask({ ids: [12] }), ENV, post)).status).toBe(403)
    expect(calls).toHaveLength(1)
  })

  it('sends nothing when the payments belong to two patients', async () => {
    const other = { ...ROW, id: 13, patient: { ...PATIENT, id: 8 } }
    const { post, calls } = pretend([ROW, other])
    expect((await emailReceipt(ask({ ids: [12, 13] }), ENV, post)).status).toBe(409)
    expect(calls).toHaveLength(1)
  })

  it('refuses without a token or with bad numbers, and asks nobody', async () => {
    const { post, calls } = pretend([ROW])
    expect((await emailReceipt(ask({ ids: [12] }, {}), ENV, post)).status).toBe(401)
    expect((await emailReceipt(ask({ ids: ['12; drop'] }), ENV, post)).status).toBe(400)
    expect((await emailReceipt(ask({ ids: [] }), ENV, post)).status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('reports a failed send', async () => {
    const { post } = pretend([ROW], 500)
    expect((await emailReceipt(ask({ ids: [12] }), ENV, post)).status).toBe(502)
  })
})

describe('the receipt email', () => {
  it('uses the same bank style number as the screen', () => {
    expect(receiptCode('RCT-000123', '2026-11-09T07:52:00Z')).toBe('2611 0900 0123')
  })
  it('makes a name harmless in the HTML', () => {
    const rows = [{ ...ROW, patient: { ...PATIENT, full_name: '<script>x</script>' } }]
    expect(receiptEmail(rows).html).not.toContain('<script>')
  })
})
