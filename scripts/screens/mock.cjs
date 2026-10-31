/*
 * scripts/screens/mock.cjs: a signed in person and a fake Supabase, for
 * screenshots and the overflow check.
 *
 * Why: every feature needed the same set up (a signed in account in the
 * browser, a fake database answering with made up rows). It was written
 * again for each feature until 2026-10-29. Now it lives here once.
 *
 * Use:
 *   const { signIn, mockSupabase, overflow, shoot } = require('./mock.cjs')
 *   await signIn(context, { role: 'nurse', roomId: 6 })
 *   const calls = await mockSupabase(page, { 'rest/v1/allergies': [...] })
 *
 * Never: put a real person's details here. Made up people only.
 */
const STAFF_ID = '00000000-0000-0000-0000-0000000000e1'

// ===== 1. Made up data that most screens need =====
const ROOMS = [
  [1, 'Front Desk', 'front_desk'],
  [2, 'Consultant Room 1', 'consultation'],
  [3, 'Consultant Room 2', 'consultation'],
  [5, "Matron's Office", 'matron'],
  [6, 'Nursing Station 1', 'nursing'],
  [8, 'Laboratory', 'laboratory'],
  [9, 'Pharmacy', 'pharmacy'],
].map(([id, name, kind]) => ({ id, name, kind }))

const PATIENT = {
  id: 1,
  patient_number: 'RMC-000001',
  full_name: 'Adaeze Okafor',
  date_of_birth: '1990-05-12',
  sex: 'female',
  category: 'individual',
  phone: '08035550126',
  email: null,
  address: '12 Adeola Street',
  town: 'Surulere',
  lga: 'Surulere',
  state: 'Lagos',
  country: 'Nigeria',
  next_of_kin_name: 'Ngozi Okoro',
  next_of_kin_relationship: 'Sister',
  next_of_kin_phone: '08035550111',
  created_at: new Date().toISOString(),
  last_seen: null,
  open_visit: null,
}

// ===== 2. A signed in person in the browser (unlocked unless locked: true) =====
async function signIn(
  context,
  {
    name = 'Chioma Eze',
    role = 'front_desk',
    roomId = 1,
    medical = false,
    locked = false,
    admin = false,
  } = {},
) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: STAFF_ID, exp, role: 'authenticated' })}.c2ln`
  const session = {
    access_token: jwt,
    refresh_token: 'r',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: {
      id: STAFF_ID,
      email: 'made-up@example.com',
      aud: 'authenticated',
      role: 'authenticated',
    },
  }
  await context.addInitScript(
    ([id, s, n, r, l]) => {
      localStorage.setItem(
        'rhema-device-accounts',
        JSON.stringify([
          {
            id,
            name: n,
            email: 'made-up@example.com',
            role: r,
            lastActive: Date.now(),
            locked: l,
          },
        ]),
      )
      localStorage.setItem('rhema-active-account', id)
      localStorage.setItem('rhema-auth-' + id, JSON.stringify(s))
    },
    [STAFF_ID, session, name, role, locked],
  )
  const room = ROOMS.find((r) => r.id === roomId) ?? null
  context.__staff = {
    id: STAFF_ID,
    full_name: name,
    role,
    can_admin: admin,
    can_medical: medical,
    can_lab: role === 'laboratory' || role === 'doctor' || role === 'admin',
    can_pharmacy: role === 'pharmacy' || role === 'doctor' || role === 'admin',
    room_id: room?.id ?? null,
    room: room ? { name: room.name, kind: room.kind } : null,
  }
}

// ===== 3. The fake Supabase =====
// `extra` maps part of a URL to the rows to send back. Writes are answered
// with success and recorded, so a script can check what a button sent.
async function mockSupabase(page, extra = {}) {
  const writes = []
  const staff = page.context().__staff
  await page.route('http://fake-supabase.local/**', (route) => {
    const req = route.request()
    const url = req.url()
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    const single = (req.headers().accept || '').includes('vnd.pgrst.object')
    for (const [part, rows] of Object.entries(extra)) {
      if (url.includes(part)) return json(typeof rows === 'function' ? rows(req) : rows)
    }
    if (url.includes('/rpc/i_have_a_pin')) return json(true)
    if (req.method() !== 'GET') {
      writes.push(`${req.method()} ${url.split('/v1/')[1]} ${req.postData() || ''}`)
      // Database functions answer in their own shape; table writes answer 201.
      if (url.includes('/rpc/call_attention')) return json('sent')
      if (url.includes('/rpc/open_record')) return json(null)
      if (url.includes('/rpc/')) return json([])
      return json([], 201)
    }
    if (url.includes('/rest/v1/staff') && url.includes('room_id=not.is.null')) return json([])
    // One person (the signed in one), or the staff list on the Admin page.
    if (url.includes('/rest/v1/staff') && !url.includes('staff_'))
      return json(single ? staff : [{ ...staff, email: 'made-up@example.com', is_active: true }])
    if (url.includes('/rest/v1/rooms')) return json(ROOMS)
    if (url.includes('/rest/v1/patients')) return json(single ? PATIENT : [PATIENT])
    if (url.includes('/auth/v1/user')) return json({ id: STAFF_ID })
    return json(single ? null : [])
  })
  return writes
}

// ===== 4. The overflow check =====
// Measures every element's real right edge at four phone widths. A picture
// cannot see something cut off the right side; this can.
async function overflow(page, label, widths = [320, 360, 375, 390]) {
  const size = page.viewportSize()
  const problems = []
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 })
    await page.waitForTimeout(150)
    const worst = await page.evaluate(() =>
      Math.max(
        ...[...document.querySelectorAll('body *')].map((e) => e.getBoundingClientRect().right),
      ),
    )
    if (worst > width + 0.5) problems.push(`${label}: ${Math.round(worst)}px wide at ${width}px`)
  }
  await page.setViewportSize(size)
  return problems
}

// ===== 5. Screenshots at a phone width and a desktop width =====
async function shoot(page, folder, name) {
  const size = page.viewportSize()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${folder}/${name}-phone.png`, fullPage: true })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${folder}/${name}-desktop.png`, fullPage: true })
  await page.setViewportSize(size)
}

module.exports = { STAFF_ID, ROOMS, PATIENT, signIn, mockSupabase, overflow, shoot }
