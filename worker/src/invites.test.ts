// Tests for the invitation email route. Run with `npm run check:tests`.
// Supabase and Resend are pretend: `post` records what would be sent.
import { describe, expect, it } from 'vitest'
import { emailInvite, escapeHtml, inviteEmail } from './invites'

const ENV = { SUPABASE_URL: 'https://db.test', SUPABASE_KEY: 'public', RESEND_API_KEY: 'rk' }
const TOKEN = 'a'.repeat(40)
const LATER = new Date(Date.now() + 3600_000).toISOString()
const INVITE = {
  id: 7,
  email: 'chioma@example.com',
  full_name: 'Chioma Eze',
  role: 'nurse',
  expires_at: LATER,
}

function ask(
  body: unknown,
  headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}` },
) {
  return new Request('https://rhemamedical.app/api/invites/email', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

// A pretend network: Supabase answers `rows`, Resend answers `resendStatus`.
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

describe('emailInvite', () => {
  it('sends one email for a waiting invitation, asked as the admin', async () => {
    const { post, calls } = pretend([INVITE])
    const response = await emailInvite(ask({ email: ' Chioma@Example.com ' }), ENV, post)
    expect(response.status).toBe(200)
    expect(calls).toHaveLength(2)
    // Supabase is asked with the admin's own token, for this email, waiting only.
    expect(calls[0].url).toContain('email=eq.chioma%40example.com')
    expect(calls[0].url).toContain('status=eq.waiting')
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    // Resend gets the key, one key per invitation, and the right address.
    const headers = calls[1].init?.headers as Record<string, string>
    expect(calls[1].url).toBe('https://api.resend.com/emails')
    expect(headers.Authorization).toBe('Bearer rk')
    // The site's address is in the key, so testing and live never collide.
    expect(headers['Idempotency-Key']).toBe('rhema-invite-rhemamedical.app-7')
    const sent = JSON.parse(String(calls[1].init?.body))
    expect(sent.to).toEqual(['chioma@example.com'])
    expect(sent.from).toContain('no-reply@rhemamedical.app')
    expect(sent.html).toContain('https://rhemamedical.app/sign-in/#email=chioma%40example.com')
    expect(sent.html).toContain('Nurse')
  })

  it('sends nothing when the database shows no invitation (not an admin, or none waiting)', async () => {
    const { post, calls } = pretend([])
    const response = await emailInvite(ask({ email: 'x@example.com' }), ENV, post)
    expect(response.status).toBe(404)
    expect(calls).toHaveLength(1)
  })

  it('sends nothing when Supabase refuses the token', async () => {
    const { post, calls } = pretend(null)
    const response = await emailInvite(ask({ email: 'x@example.com' }), ENV, post)
    expect(response.status).toBe(403)
    expect(calls).toHaveLength(1)
  })

  it('sends nothing for an invitation that has run out', async () => {
    const old = { ...INVITE, expires_at: new Date(Date.now() - 1000).toISOString() }
    const { post, calls } = pretend([old])
    const response = await emailInvite(ask({ email: INVITE.email }), ENV, post)
    expect(response.status).toBe(404)
    expect(calls).toHaveLength(1)
  })

  it('refuses without a sign in token, and asks nobody', async () => {
    const { post, calls } = pretend([INVITE])
    const response = await emailInvite(ask({ email: INVITE.email }, {}), ENV, post)
    expect(response.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('refuses a bad email, and asks nobody', async () => {
    const { post, calls } = pretend([INVITE])
    const response = await emailInvite(ask({ email: 'not an email' }), ENV, post)
    expect(response.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('says it is not set up when the Resend key is missing', async () => {
    const { post, calls } = pretend([INVITE])
    const response = await emailInvite(
      ask({ email: INVITE.email }),
      { ...ENV, RESEND_API_KEY: '' },
      post,
    )
    expect(response.status).toBe(503)
    expect(calls).toHaveLength(0)
  })

  it('reports a failed send', async () => {
    const { post } = pretend([INVITE], 500)
    const response = await emailInvite(ask({ email: INVITE.email }), ENV, post)
    expect(response.status).toBe(502)
  })
})

describe('the email', () => {
  it('makes a name harmless in the HTML', () => {
    expect(escapeHtml('<b>"Tom" & \'Jo\'</b>')).toBe(
      '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jo&#39;&lt;/b&gt;',
    )
    const { html } = inviteEmail({ ...INVITE, full_name: '<script>x</script>' }, 'https://a/')
    expect(html).not.toContain('<script>')
  })
})
