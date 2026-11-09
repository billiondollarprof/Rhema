/*
 * worker/src/receipts.ts: emails a receipt to the patient.
 *
 * Why: Anthony, 2026-11-09 (request 159): "there should be an option for
 * sending receipt to email... If the person actually dropped their email...
 * the infrastructure that we used for invitation... By the time you just
 * click on it, it sends to email automatically."
 *
 * How it works:
 *   1. The staff member's own sign in token comes with the receipt's
 *      payment numbers (one payment, or a day's payments).
 *   2. We read those payments from Supabase AS THAT PERSON. The database
 *      shows receipts only to the Front Desk and admins, so anybody else
 *      gets nothing and no email goes.
 *   3. They must all belong to one patient who gave an email. The receipt
 *      goes to that address only, never to an address typed in the request.
 *
 * Never: send to any address but the patient's own email on their record,
 * or log the address, the name or the amounts.
 */

// ===== 1. What this part is given =====
export interface ReceiptsEnv {
  SUPABASE_URL?: string
  SUPABASE_KEY?: string
  RESEND_API_KEY?: string
}

const FROM = 'Rhema Medical Centre <no-reply@rhemamedical.app>'
const REPLY_TO = 'info@rhemamedical.app'
const ADDRESS = 'Former License Office by Ojolu Junction, Sapele, Delta State, Nigeria'

const MODE_WORDS: Record<string, string> = { cash: 'Cash', pos: 'POS', transfer: 'Transfer' }

type Row = {
  id: number
  receipt_number: string
  amount: number
  mode: string
  received_at: string
  receiver: { full_name: string } | null
  patient: { id: number; full_name: string; patient_number: string; email: string | null } | null
  lines: { label: string; amount: number }[]
}

const no = (status: number, error: string) => Response.json({ error }, { status })

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

const naira = (amount: number) =>
  '₦' + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 2 })

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// The receipt number people see, bank style. The same rule as receiptCode
// in web/lib/payments/payments.ts: change both together.
export function receiptCode(receiptNumber: string, receivedAt: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(receivedAt))
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00'
  const sequence = receiptNumber.replace(/\D/g, '').padStart(6, '0')
  return (part('year') + part('month') + part('day') + sequence).replace(/(\d{4})(?=\d)/g, '$1 ')
}

// ===== 3. The email =====
export function receiptEmail(rows: Row[]) {
  const patient = rows[0].patient!
  const numbers = rows.map((row) => receiptCode(row.receipt_number, row.received_at)).join(', ')
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0)
  const lines = rows.flatMap((row) => row.lines)
  const paidBy = [...new Set(rows.map((row) => MODE_WORDS[row.mode] ?? row.mode))].join(', ')
  const receivedBy = [...new Set(rows.map((row) => row.receiver?.full_name ?? 'Staff'))].join(', ')
  const date = when(rows[rows.length - 1].received_at)
  const subject = `Your receipt from Rhema Medical Centre (${numbers})`
  const text =
    `Rhema Medical Centre\n${ADDRESS}\n\nReceipt no. ${numbers}\n` +
    `Patient: ${patient.full_name} (${patient.patient_number})\nDate: ${date}\n\n` +
    lines.map((line) => `${line.label}: ${naira(line.amount)}`).join('\n') +
    `\n\nTotal paid: ${naira(total)}\nPaid by: ${paidBy}\nReceived by: ${receivedBy}\n\nThank you.`
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;${strong ? 'font-weight:bold;font-size:17px' : ''}">${escapeHtml(label)}</td>` +
    `<td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;${strong ? 'font-weight:bold;font-size:17px' : ''}">${escapeHtml(value)}</td></tr>`
  const fact = (label: string, value: string) =>
    `<p style="margin:0 0 8px"><span style="color:#5b6b80;font-size:12px">${escapeHtml(label)}</span><br><b>${escapeHtml(value)}</b></p>`
  const html = `<div style="background:#f2f5fa;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px">
<tr><td style="background:#0a2a5e;padding:18px 24px;color:#ffffff;border-radius:12px 12px 0 0"><div style="font-size:18px;font-weight:bold">RHEMA MEDICAL CENTRE</div><div style="font-size:12px;opacity:0.85">${escapeHtml(ADDRESS)}</div></td></tr>
<tr><td style="height:3px;background:#d9232d;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:22px 24px 6px;color:#0f2238">
<table role="presentation" width="100%"><tr><td style="font-size:22px;font-weight:bold">Receipt</td>
<td align="right"><span style="color:#5b6b80;font-size:11px;letter-spacing:1px">RECEIPT NO.</span><br><span style="font-family:Menlo,Consolas,monospace;font-weight:bold;color:#0a2a5e;letter-spacing:1px">${escapeHtml(numbers)}</span></td></tr></table>
</td></tr>
<tr><td style="padding:10px 24px;color:#0f2238;font-size:14px">${fact('Patient', `${patient.full_name} (${patient.patient_number})`)}${fact('Date', date)}</td></tr>
<tr><td style="padding:0 24px;color:#0f2238;font-size:14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${lines.map((line) => row(line.label, naira(line.amount))).join('')}${row('Total paid', naira(total), true)}</table></td></tr>
<tr><td style="padding:16px 24px;color:#0f2238;font-size:14px">${fact('Paid by', paidBy)}${fact('Received by', receivedBy)}</td></tr>
<tr><td align="center" style="padding:0 24px 24px;color:#5b6b80;font-size:14px">Thank you.</td></tr>
</table></div>`
  return { subject, text, html, total, numbers }
}

// ===== 4. The route: POST /api/receipts/email =====
export async function emailReceipt(
  request: Request,
  env: ReceiptsEnv,
  post: typeof fetch = fetch,
): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY || !env.RESEND_API_KEY)
    return no(503, 'Receipt emails are not set up yet')
  const token = tokenFrom(request)
  if (!token) return no(401, 'Please sign in again')

  // Step 1: which payments.
  let ids: number[] = []
  try {
    const body = (await request.json()) as { ids?: unknown }
    ids = Array.isArray(body.ids) ? body.ids.filter((id) => Number.isInteger(id) && id > 0) : []
  } catch {
    return no(400, 'Bad request')
  }
  if (ids.length === 0 || ids.length > 20) return no(400, 'Bad request')

  // Step 2: read them as this person. No receipt rights, no rows.
  const columns =
    'id,receipt_number,amount,mode,received_at,' +
    'receiver:staff!payments_received_by_fkey(full_name),' +
    'patient:patients(id,full_name,patient_number,email),' +
    'lines:payment_lines(label,amount)'
  const ask = await post(
    `${env.SUPABASE_URL}/rest/v1/payments?select=${columns}&id=in.(${ids.join(',')})` +
      '&voided_at=is.null&order=received_at',
    { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}` } },
  )
  if (!ask.ok) return no(403, 'Not allowed')
  const rows = (await ask.json()) as Row[]
  if (!Array.isArray(rows) || rows.length !== ids.length) return no(404, 'Receipt not found')

  // Step 3: one patient, with an email on their record.
  const patientIds = new Set(rows.map((row) => row.patient?.id))
  const email = rows[0].patient?.email ?? ''
  if (patientIds.size !== 1 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return no(409, 'This patient has no email on their record')

  // Step 4: send it.
  const { subject, text, html, total } = receiptEmail(rows)
  const sent = await post('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      // A double tap sends one email. The 10 minute part lets a receipt be
      // sent again later if the patient asks.
      'Idempotency-Key': `rhema-receipt-${new URL(request.url).hostname}-${ids.join('-')}-${total}-${Math.floor(Date.now() / 600_000)}`,
    },
    body: JSON.stringify({ from: FROM, to: [email], reply_to: REPLY_TO, subject, text, html }),
  })
  const why = sent.ok ? '' : ` ${(await sent.text().catch(() => '')).slice(0, 200)}`
  // Numbers only: never the address, the name or the amounts.
  console.log(`Receipt email for payments ${ids.join(',')}: ${sent.status}${why}`)
  if (!sent.ok) return no(502, 'The email could not be sent')
  return Response.json({ sent: true })
}
