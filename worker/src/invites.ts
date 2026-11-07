/*
 * worker/src/invites.ts: emails the invitation to a new staff member.
 *
 * Why: Anthony, 2026-11-07: "when you invite someone, the person needs to
 * receive an invitation email." The admin saves the invitation in the
 * database (invite_staff); the screen then asks this route to email it.
 *
 * How it works:
 *   1. The admin's own sign in token comes with the request, with the
 *      email that was invited.
 *   2. We ask Supabase, AS THAT ADMIN, for the waiting invitation for that
 *      email. Only an admin can read invitations (the database's own rule),
 *      so anybody else gets no row and no email.
 *   3. The email goes out through Resend from no-reply@rhemamedical.app,
 *      with a link to this site's sign in page, the email already typed in.
 *      Resend is told the invitation's number, so a double tap sends one
 *      email, not two.
 *
 * Never: send to an address that has no waiting invitation, put a patient
 * detail in the email, or log the address or the key.
 */

// ===== 1. What this part is given =====
export interface InvitesEnv {
  // This site's Supabase address and public key (public by design).
  SUPABASE_URL?: string
  SUPABASE_KEY?: string
  // The Resend key that may only send (a Worker secret, never in the code).
  RESEND_API_KEY?: string
}

const FROM = 'Rhema Medical Centre <no-reply@rhemamedical.app>'
const REPLY_TO = 'admin@rhemamedical.app'

const ROLE_WORDS: Record<string, string> = {
  front_desk: 'Front Desk',
  doctor: 'Doctor',
  nurse: 'Nurse',
  matron: 'Matron',
  pharmacy: 'Pharmacy',
  laboratory: 'Laboratory',
  admin: 'Admin',
}

type Invite = { id: number; email: string; full_name: string; role: string; expires_at: string }

const no = (status: number, error: string) => Response.json({ error }, { status })

// ===== 2. Small helpers =====
function tokenFrom(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer ([A-Za-z0-9._-]{20,4000})$/)
  return match ? match[1] : null
}

// Names go into the email's HTML, so < > & " ' are made harmless.
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ===== 3. The email itself =====
// Same look as the sign in code email: navy band, thin red line, blue
// button. No picture, because many email apps hide pictures.
export function inviteEmail(invite: Invite, link: string) {
  const name = escapeHtml(invite.full_name)
  const role = escapeHtml(ROLE_WORDS[invite.role] ?? invite.role)
  const subject = 'You are invited to Rhema Medical Centre'
  const text =
    `Hello ${invite.full_name},\n\n` +
    `You have been invited to the Rhema Medical Centre app as ${ROLE_WORDS[invite.role] ?? invite.role}.\n\n` +
    `Open this link to sign in: ${link}\n\n` +
    'You will get a 6 digit code by email. Type it in, then set your own PIN.\n' +
    'The invitation works for 72 hours. If you did not expect it, you can ignore this email.'
  const html = `<div style="background:#f2f5fa;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px">
<tr><td style="background:#0a2a5e;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold;border-radius:12px 12px 0 0">Rhema Medical Centre</td></tr>
<tr><td style="height:3px;background:#d9232d;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 24px 8px;color:#0f2238;font-size:16px;line-height:24px">Hello ${name},<br><br>You have been invited to the Rhema Medical Centre app as <b>${role}</b>.</td></tr>
<tr><td style="padding:16px 24px" align="center"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1f5fd0;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:10px">Sign in to Rhema</a></td></tr>
<tr><td style="padding:0 24px 28px;color:#5b6b80;font-size:14px;line-height:22px">You will get a 6 digit code by email. Type it in, then set your own PIN. The invitation works for 72 hours. If you did not expect it, you can ignore this email.</td></tr>
</table></div>`
  return { subject, text, html }
}

// ===== 4. The route: POST /api/invites/email =====
export async function emailInvite(
  request: Request,
  env: InvitesEnv,
  post: typeof fetch = fetch,
): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY || !env.RESEND_API_KEY)
    return no(503, 'Invitation emails are not set up yet')
  const token = tokenFrom(request)
  if (!token) return no(401, 'Please sign in again')

  // Step 1: which email.
  let email = ''
  try {
    const body = (await request.json()) as { email?: unknown }
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return no(400, 'Bad request')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return no(400, 'Bad request')

  // Step 2: the waiting invitation, asked as the admin.
  const ask = await post(
    `${env.SUPABASE_URL}/rest/v1/staff_invites?select=id,email,full_name,role,expires_at` +
      `&email=eq.${encodeURIComponent(email)}&status=eq.waiting&limit=1`,
    { headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}` } },
  )
  if (!ask.ok) return no(403, 'Not allowed')
  const rows = (await ask.json()) as Invite[]
  const invite = Array.isArray(rows) ? rows[0] : undefined
  if (!invite || new Date(invite.expires_at).getTime() <= Date.now())
    return no(404, 'No waiting invitation for this email')

  // Step 3: send it.
  const link = `${new URL(request.url).origin}/sign-in/#email=${encodeURIComponent(invite.email)}`
  const { subject, text, html } = inviteEmail(invite, link)
  const sent = await post('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      // One email per invitation, however many times the button is tapped.
      'Idempotency-Key': `rhema-invite-${invite.id}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [invite.email],
      reply_to: REPLY_TO,
      subject,
      text,
      html,
    }),
  })
  // The number only, never the address.
  console.log(`Invitation email for invite ${invite.id}: ${sent.status}`)
  if (!sent.ok) return no(502, 'The email could not be sent')
  return Response.json({ sent: true })
}
