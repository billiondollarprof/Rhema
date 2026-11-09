/*
 * scripts/e2e-signin.mjs: uses the real sign in, the way staff will.
 *
 * What it does: against a throwaway Supabase (started by CI) and the built
 * app, it walks through sign in as two made up nurses at one shared desk:
 *   (After Call attention: Nurse One requests a lab test, the front desk
 *   takes the payment in naira, and the record shows it awaiting its test.)
 *   0. A stranger is refused. An invited person opens the invitation link,
 *      finds the email typed in, signs in, chooses a PIN and reaches Home
 *      (Admin, 2026-10-30).
 *   1. Nurse One signs in with an email code (read from the local mailbox
 *      that the throwaway Supabase sends to), finds the PIN will not go on
 *      until she ticks the agreement (request 156), ticks it, and chooses
 *      a PIN.
 *   2. She locks the screen, types a wrong PIN, then the right one.
 *   3. Nurse Two signs in on the same device and chooses her own PIN.
 *   4. At the lock screen, Nurse One taps her own name and unlocks with
 *      her own PIN, so the device now acts as her.
 *   5. Nurse One signs out; Nurse Two is still remembered.
 *   6. Five wrong PINs sign Nurse Two out of the device.
 * Screenshots of each screen, at a phone width and a desktop width, go to
 * e2e-screens/ for a person to look at.
 *
 * Why: a control that writes nothing looks exactly like one that works.
 * This proves every sign in button really talks to Supabase.
 *
 * Never: point it at the hospital's testing or live project. It reads the
 * addresses from the environment, and CI only ever gives it local ones.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

// ===== 1. Settings from CI =====
const APP = process.env.APP_URL ?? 'http://127.0.0.1:3000'
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
for (const address of [APP, MAILPIT]) {
  if (
    address.includes('supabase.co') ||
    address.includes('workers.dev') ||
    address.includes('rhemamedical.app')
  ) {
    throw new Error('Refusing: e2e only runs against local addresses')
  }
}
const SHOTS = 'e2e-screens'
mkdirSync(SHOTS, { recursive: true })

// ===== 2. Helpers =====
let shotNumber = 0
async function shot(page, name) {
  shotNumber += 1
  const file = `${SHOTS}/${String(shotNumber).padStart(2, '0')}-${name}`
  await page.screenshot({ path: `${file}-phone.png`, fullPage: true })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.screenshot({ path: `${file}-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
}

function step(text) {
  console.log(`-- ${text}`)
}

// The newest sign in code sent to one email, from the local mailbox.
async function latestCode(email) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    )
    const found = await search.json()
    const newest = found.messages?.[0]
    if (newest) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`)).json()
      const code = (message.Text || message.HTML || '').match(/\b(\d{6})\b/)
      if (code) return code[1]
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`No code arrived for ${email}`)
}

async function clearMailbox() {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' })
}

// Wait until the PIN card has finished checking (its button says Unlock
// again, not Checking).
async function pinCheckDone(page) {
  await page.getByRole('button', { name: 'Unlock', exact: true }).waitFor()
}

// Type digits into the boxes, starting from the first one.
async function typeDigits(page, label, digits) {
  await page.getByLabel(`${label}, digit 1`).click()
  await page.keyboard.type(digits, { delay: 40 })
}

async function signInWithCode(page, email) {
  await clearMailbox()
  await page.getByLabel('Work email').fill(email)
  await page.getByRole('button', { name: 'Send me a code' }).click()
  await page.getByText('Enter your code').waitFor()
  const code = await latestCode(email)
  await typeDigits(page, 'Email code', code)
}

// The agreement tick on the first PIN (request 156). It shows, disabled,
// while the app asks whether this person already agreed, then it is either
// ready to tick or gone (already agreed). Tick it when it is there.
async function tickAgreementIfAsked(page) {
  await page.waitForFunction(() => {
    const box = document.querySelector('input[type=checkbox]')
    return !box || !box.disabled
  })
  const box = page.getByRole('checkbox')
  if (await box.count()) await box.click()
}

async function choosePin(page, pin) {
  await page.getByText('Choose your PIN').waitFor()
  await tickAgreementIfAsked(page)
  await typeDigits(page, 'Choose your PIN', pin)
  await page.getByText('Type it again').waitFor()
  await typeDigits(page, 'Type your PIN again', pin)
}

async function expectHome(page, name) {
  await page.getByText(`, ${name}`).first().waitFor()
  await page.getByText(name, { exact: true }).first().waitFor()
}

// Lock screen and Sign out sit behind the menu button (request 117).
async function openMenuItem(page, words) {
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('menuitem', { name: words }).click()
}

async function openLockCard(page) {
  await page.getByText('Tap anywhere to unlock').waitFor()
  await page.getByRole('button', { name: 'Unlock' }).first().click()
  await page.getByText('Enter your 4 digit PIN to continue').waitFor()
}

// ===== 3. The walk through =====
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const problems = []
page.on('pageerror', (error) => problems.push(error.message))
// Browser messages go to the CI log, so a failure can be read without the
// screenshots.
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    console.log(`   browser ${message.type()}: ${message.text().slice(0, 300)}`)
  }
})

try {
  step('A new device opens the app and lands on the email step')
  await page.goto(`${APP}/`)
  await page.getByText('Use the account your administrator created for you.').waitFor()
  await shot(page, 'sign-in-email')

  step('An email that is not staff gets a plain message, not a code')
  await page.getByLabel('Work email').fill('stranger@test.rhema')
  await page.getByRole('button', { name: 'Send me a code' }).click()
  await page.getByText('We could not send a code to that email').waitFor()
  await shot(page, 'sign-in-unknown-email')

  step('An invited person opens the invitation link: the email is already typed in')
  await page.goto(`${APP}/sign-in/#email=${encodeURIComponent('invited1@test.rhema')}`)
  await page.getByText('Use the account your administrator created for you.').waitFor()
  const filled = await page.getByLabel('Work email').inputValue()
  if (filled !== 'invited1@test.rhema') throw new Error(`The link filled in "${filled}"`)
  await clearMailbox()
  await page.getByRole('button', { name: 'Send me a code' }).click()
  await page.getByText('Enter your code').waitFor()
  await typeDigits(page, 'Email code', await latestCode('invited1@test.rhema'))

  step('The invitation becomes a staff account: PIN, then Home')
  await choosePin(page, '2580')
  await expectHome(page, 'Test Invited One')
  await shot(page, 'home-invited-one')
  await openMenuItem(page, 'Sign out')
  await page.getByText('Use the account your administrator created for you.').waitFor()

  step('A stranger is still refused after that')
  await page.getByLabel('Work email').fill('stranger@test.rhema')
  await page.getByRole('button', { name: 'Send me a code' }).click()
  await page.getByText('We could not send a code to that email').waitFor()
  await page.goto(`${APP}/sign-in/`)

  step('Nurse One signs in with a real email code')
  await page.getByLabel('Work email').fill('nurse1@test.rhema')
  await clearMailbox()
  await page.getByRole('button', { name: 'Send me a code' }).click()
  await page.getByText('Enter your code').waitFor()
  await shot(page, 'enter-code')
  const code = await latestCode('nurse1@test.rhema')
  await typeDigits(page, 'Email code', code)

  step('She chooses her PIN, twice')
  await page.getByText('Choose your PIN').waitFor()
  await shot(page, 'choose-pin')
  // Without the agreement tick the PIN does not go on (request 156).
  await page.waitForFunction(() => {
    const box = document.querySelector('input[type=checkbox]')
    return box && !box.disabled
  })
  await typeDigits(page, 'Choose your PIN', '4821')
  await page.getByText('Tick the box below to agree, then carry on.').waitFor()
  if (await page.getByText('Type it again').count()) {
    throw new Error('The PIN went on without the agreement tick')
  }
  // Ticking it carries on to the second PIN, and the agreement is saved in
  // the database before the PIN (agree_to_terms on the throwaway Supabase).
  await page.getByRole('checkbox').click()
  await page.getByText('Type it again').waitFor()
  await typeDigits(page, 'Type your PIN again', '4821')
  await expectHome(page, 'Test Nurse One')
  await shot(page, 'home-nurse-one')

  step("Home: her room's queue shows only the patient in her room")
  await page.getByText('Patient queue · Consultant Room 1').waitFor()
  await page.getByText('Made Up Patient A').waitFor()
  await page.getByText('Note: Please see him first').waitFor()
  if (await page.getByText('Made Up Patient B').count()) {
    throw new Error('A patient from another room showed in her queue')
  }

  step('She calls the patient in; a refresh keeps it')
  await page.getByRole('button', { name: 'Call in patient' }).click()
  await page.getByRole('button', { name: 'Finish visit' }).waitFor()
  await page.reload()
  await page.getByRole('button', { name: 'Finish visit' }).waitFor()
  await shot(page, 'home-in-consultation')

  step('She finishes the visit; the counts and the chart follow')
  await page.getByRole('button', { name: 'Finish visit' }).click()
  await page.getByText('No patients in your room right now.').waitFor()
  await page.reload()
  await page.getByText('No patients in your room right now.').waitFor()
  await page.getByText('Completed today').waitFor()
  await page.waitForFunction(() =>
    [...document.querySelectorAll('b')].some(
      (b) => b.nextElementSibling?.textContent === 'Completed today' && b.textContent === '1',
    ),
  )
  await shot(page, 'home-after-visit')

  step('Patients: she registers a new made up patient')
  await page.getByRole('button', { name: 'Find patient' }).first().click()
  await page.getByRole('heading', { name: 'Find patient' }).waitFor()
  await page.getByRole('link', { name: 'Register patient' }).click()
  await page.getByRole('heading', { name: 'Register patient' }).waitFor()
  await page.getByLabel('Full name').first().fill('Made Up Patient C')
  await page.getByLabel('Date of birth').fill('1995-03-14')
  await page.getByText('Age: ').waitFor()
  await page.getByLabel('Phone / WhatsApp number').first().fill('0803 555 0199')
  await shot(page, 'register-form')
  await page.getByRole('button', { name: 'Save patient' }).click()
  await page.getByText('Patient registered').waitFor()
  const number = await page
    .locator('b', { hasText: /^RMC-\d{6}$/ })
    .first()
    .innerText()
  if (!/^RMC-\d{6}$/.test(number)) throw new Error('No RMC number after registering')
  await shot(page, 'registered')

  step('She sends the new patient to her room')
  await page.getByRole('button', { name: 'Send to room' }).click()
  await page.getByLabel('Room', { exact: true }).selectOption({ label: 'Consultant Room 1' })
  await page.getByLabel('Note for the staff there (optional)').fill('New today')
  await page.getByRole('button', { name: 'Send to room' }).last().click()
  await page.getByText('Sent to Consultant Room 1').waitFor()

  step('The same name and date of birth again: warned, and she opens the existing one')
  await page.getByRole('button', { name: 'Register another patient' }).click()
  await page.getByLabel('Full name').first().fill('made up patient c')
  await page.getByLabel('Date of birth').fill('1995-03-14')
  await page.getByRole('button', { name: 'Save patient' }).click()
  await page.getByText('This patient may already be registered').waitFor()
  await shot(page, 'duplicate-warning')
  await page.getByRole('button', { name: 'Use this patient' }).click()
  await page.getByRole('heading', { name: 'Made Up Patient C' }).waitFor()
  await page.getByText(number).first().waitFor()

  step('Find shows her by number, with where she is now, and last seen')
  // A chosen patient opens on a screen of their own (request 169), so she
  // goes back to the search first.
  await page.getByRole('button', { name: /Back to search/ }).click()
  await page.getByLabel('Search by name, patient number or phone').fill(number)
  await page.getByRole('button', { name: /Made Up Patient C/ }).waitFor()
  // The exact status and room, not just "In hospital" (2026-11-02).
  await page
    .getByRole('button', { name: /Made Up Patient C/ })
    .getByText(/^Waiting · /)
    .waitFor()
  await shot(page, 'find-patient')

  step('Medical record: she opens it, and nobody has asked about allergies yet')
  await page.getByRole('button', { name: /Made Up Patient C/ }).click()
  await page.getByRole('link', { name: 'Medical record' }).click()
  await page.getByText('Allergies not recorded yet.').waitFor()

  step('She adds a severe allergy; the banner turns red')
  await page.getByRole('button', { name: '+ Add an allergy' }).click()
  await page.getByLabel('Allergic to', { exact: true }).fill('Penicillin')
  await page.getByLabel('Reaction', { exact: true }).fill('Rash')
  await page.getByLabel('Severe reaction').check()
  await page.getByRole('button', { name: 'Add allergy' }).click()
  await page.getByText('Allergic to: Penicillin (severe)').waitFor()

  step('She adds a medicine, suspends it with a reason, and resumes it')
  await page.getByRole('button', { name: '+ Add a medicine' }).click()
  await page.getByLabel('Medicine', { exact: true }).fill('Amlodipine')
  await page.getByLabel('Dose', { exact: true }).fill('5 mg')
  await page.getByLabel('How often').fill('Once daily')
  await page.getByRole('button', { name: 'Add medicine' }).click()
  await page.getByText('Amlodipine', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Suspend', exact: true }).click()
  await page.getByRole('button', { name: 'Suspend', exact: true }).last().click()
  await page.getByText('Give a short reason.').waitFor()
  await page.getByRole('button', { name: 'Side effects' }).click()
  await page.getByRole('button', { name: 'Suspend', exact: true }).last().click()
  await page.getByText(/Suspended by Test Nurse One, .*: Side effects/).waitFor()
  await page.getByRole('button', { name: 'Resume' }).click()
  await page.getByRole('button', { name: 'Doctor said to resume' }).click()
  await page.getByRole('button', { name: 'Resume' }).last().click()
  await page.getByText(/Active by Test Nurse One/).waitFor()

  step('She gives a dose; it shows with her name')
  await page.getByRole('button', { name: 'Give dose' }).click()
  await page.getByRole('button', { name: 'Record dose' }).click()
  await page.getByText('Given by Test Nurse One').waitFor()

  step('A reading out of range is refused; a normal one saves')
  await page.getByRole('button', { name: '+ Take new readings' }).click()
  await page.getByLabel('Temperature °C').fill('50')
  await page.getByRole('button', { name: 'Save readings' }).click()
  await page.getByText('One of the values is outside the normal range.').waitFor()
  await page.getByLabel('Temperature °C').fill('36.8')
  await page.getByRole('button', { name: 'Save readings' }).click()
  await page.getByText('Taken by Test Nurse One').waitFor()

  step('She voids the dose with a reason; it stays, crossed out')
  const dose = page.locator('details', { hasText: 'Doses given' })
  await dose.getByRole('button', { name: 'Void' }).click()
  await dose.getByRole('button', { name: 'Entered by mistake' }).click()
  await dose.getByRole('button', { name: 'Void' }).click()
  await dose.getByText('Voided by Test Nurse One: Entered by mistake').waitFor()

  step('A refresh shows everything still there')
  await page.reload()
  await page.getByText('Allergic to: Penicillin (severe)').waitFor()
  await page.getByText('Given by Test Nurse One').waitFor()
  await page.getByText('Voided by Test Nurse One: Entered by mistake').waitFor()
  await shot(page, 'medical-record')

  step('Call attention: the front desk signs in on a second screen')
  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  desk.on('pageerror', (error) => problems.push(`desk: ${error.message}`))
  await desk.goto(`${APP}/sign-in/`)
  await signInWithCode(desk, 'desk1@test.rhema')
  await choosePin(desk, '2468')
  await expectHome(desk, 'Test Desk One')
  // Give the live line a moment to connect before the call goes.
  await desk.waitForTimeout(2000)

  step('Nurse One rings Front Desk in two taps; it says Sent')
  await page.getByRole('button', { name: 'Call attention' }).first().click()
  await page.getByRole('button', { name: /^Front Desk/ }).click()
  await page.getByText('Sent', { exact: true }).waitFor()

  step('The front desk screen gets the card live, without a refresh')
  await desk.getByText('Consultant Room 1 needs Front Desk').waitFor({ timeout: 15000 })
  const attentionCard = desk.getByRole('status').filter({ hasText: 'needs Front Desk' })
  await attentionCard.getByText(/Test Nurse One · \d\d:\d\d/).waitFor()

  // Request 129: her Call in earlier raised a green Call patient card here.
  step('The front desk also has the Call patient card from her Call in')
  const patientCard = desk.getByRole('status').filter({ hasText: 'Call patient' })
  await patientCard.getByText(/ to Consultant Room 1$/).waitFor()
  await shot(desk, 'attention-card')

  step('A second tap at once sends nothing new')
  await page.waitForTimeout(3500)
  await page.getByRole('button', { name: /^Front Desk/ }).click()
  await page.getByText('Already sent').waitFor()
  await page.keyboard.press('Escape')

  step('The front desk closes both cards with X, and they stay closed')
  await attentionCard.getByRole('button', { name: 'Close' }).click()
  await patientCard.getByRole('button', { name: 'Close' }).click()
  await desk.reload()
  await expectHome(desk, 'Test Desk One')
  await desk.waitForTimeout(1500)
  if (await desk.getByText('Consultant Room 1 needs Front Desk').count()) {
    throw new Error('A closed call came back after a refresh')
  }
  if (await desk.getByText('Call patient', { exact: true }).count()) {
    throw new Error('A closed Call patient card came back after a refresh')
  }

  step('Lab: Nurse One requests a malaria test from the record, for payment')
  await page.getByRole('link', { name: 'Request lab' }).first().click()
  await page.getByRole('heading', { name: 'Request lab test' }).waitFor()
  await page.getByRole('button', { name: 'Malaria test' }).click()
  await page.getByRole('button', { name: 'Send request' }).click()
  await page
    .getByText('Sent to the Lab, and to the Front Desk for payment: Malaria test.')
    .waitFor()

  step('Lab: the front desk takes 2,000 naira by POS; it leaves the list and stays gone')
  await desk.reload()
  await desk.getByText('Lab tests to pay for').waitFor()
  await desk.getByText('Asked by Test Nurse One').waitFor()
  await desk.getByRole('button', { name: 'Take payment' }).click()
  // One price box per test; the app shows the total on the button.
  await desk.getByLabel('Malaria test').fill('2,000')
  await desk.getByRole('button', { name: 'POS' }).click()
  await desk.getByRole('button', { name: 'Record payment · ₦2,000' }).click()
  await desk.getByText('Nothing waiting for payment.').waitFor()
  await desk.reload()
  await desk.getByText('Nothing waiting for payment.').waitFor()
  await shot(desk, 'lab-paid')

  step('Lab: the record shows the test awaiting its result')
  await page.getByRole('link', { name: 'Open the record' }).click()
  await page.getByText('Awaiting test').waitFor()
  await desk.close()

  step('Home now shows the new patient waiting in her room')
  await page.getByRole('link', { name: 'Home' }).click()
  await page.getByText('Patient queue · Consultant Room 1').waitFor()
  const queue = page.locator('#queue')
  await queue.getByText('Made Up Patient C').waitFor()
  await queue.getByText('Note: New today').waitFor()
  await queue
    .getByText(/waiting \d+ min/)
    .first()
    .waitFor()

  step('A refresh keeps her signed in and unlocked')
  await page.reload()
  await expectHome(page, 'Test Nurse One')

  step('Lock screen, a wrong PIN, then the right PIN')
  await openMenuItem(page, 'Lock screen')
  await page.getByText('Tap anywhere to unlock').waitFor()
  await shot(page, 'locked-idle')
  await openLockCard(page)
  await shot(page, 'lock-card')
  await typeDigits(page, 'Your PIN', '0000')
  await page.getByText('That PIN is not right. Try again.').waitFor()
  await pinCheckDone(page)
  await shot(page, 'lock-wrong-pin')
  await typeDigits(page, 'Your PIN', '4821')
  await expectHome(page, 'Test Nurse One')

  step('A refresh while locked stays locked')
  await openMenuItem(page, 'Lock screen')
  await page.getByText('Tap anywhere to unlock').waitFor()
  await page.reload()
  await page.getByText('Tap anywhere to unlock').waitFor()

  step('Nurse Two signs in on the same device')
  await openLockCard(page)
  await page.getByRole('button', { name: 'Sign in as someone else' }).click()
  await page.getByText('Tap your name, then type your PIN.').waitFor()
  await shot(page, 'choose-account')
  await page.getByRole('button', { name: 'Sign in with a different account' }).click()
  await signInWithCode(page, 'nurse2@test.rhema')
  await choosePin(page, '1111')
  await expectHome(page, 'Test Nurse Two')

  step('Nurse One taps her own name at the lock screen and uses her own PIN')
  await openMenuItem(page, 'Lock screen')
  await openLockCard(page)
  await page.getByText('Not you? Tap your name.').waitFor()
  await shot(page, 'lock-shared-desk')
  await page.getByRole('button', { name: /Test Nurse One/ }).click()
  await page.getByText('Welcome back, Test Nurse One').waitFor()
  await typeDigits(page, 'Your PIN', '4821')
  await expectHome(page, 'Test Nurse One')

  step('Nurse One signs out; Nurse Two is still remembered')
  await openMenuItem(page, 'Sign out')
  await page.getByText('Tap your name, then type your PIN.').waitFor()
  await page.getByRole('button', { name: /Test Nurse Two/ }).waitFor()
  if (await page.getByRole('button', { name: /Test Nurse One/ }).count()) {
    throw new Error('Nurse One is still listed after signing out')
  }

  step('Five wrong PINs sign Nurse Two out of the device')
  await page.getByRole('button', { name: /Test Nurse Two/ }).click()
  await openLockCard(page)
  for (let i = 0; i < 4; i++) {
    await typeDigits(page, 'Your PIN', '9999')
    await page.getByText('That PIN is not right. Try again.').waitFor()
    await pinCheckDone(page)
  }
  await typeDigits(page, 'Your PIN', '9999')
  await page.getByText('The PIN was wrong 5 times.').waitFor()
  await shot(page, 'pin-locked-out')

  if (problems.length) throw new Error(`Page errors: ${problems.join(' | ')}`)
  console.log('E2E SIGN IN PASSED')
} catch (error) {
  await page.screenshot({ path: `${SHOTS}/zz-failure.png`, fullPage: true }).catch(() => {})
  console.error('E2E SIGN IN FAILED:', error.message)
  const onScreen = await page.innerText('body').catch(() => '')
  console.error('On screen at the time:\n' + onScreen.slice(0, 1500))
  process.exitCode = 1
} finally {
  await browser.close()
}
