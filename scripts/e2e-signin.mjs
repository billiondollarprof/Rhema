/*
 * scripts/e2e-signin.mjs: uses the real sign in, the way staff will.
 *
 * What it does: against a throwaway Supabase (started by CI) and the built
 * app, it walks through sign in as two made up nurses at one shared desk:
 *   1. Nurse One signs in with an email code (read from the local mailbox
 *      that the throwaway Supabase sends to), and chooses a PIN.
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
  if (address.includes('supabase.co') || address.includes('workers.dev')) {
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

async function choosePin(page, pin) {
  await page.getByText('Choose your PIN').waitFor()
  await typeDigits(page, 'Choose your PIN', pin)
  await page.getByText('Type it again').waitFor()
  await typeDigits(page, 'Type your PIN again', pin)
}

async function expectHome(page, name) {
  await page.getByText(`, ${name}`).first().waitFor()
  await page.getByText(name, { exact: true }).first().waitFor()
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
  await typeDigits(page, 'Choose your PIN', '4821')
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

  step('Find shows her by number, in hospital, with last seen')
  await page.getByLabel('Search by name, patient number or phone').fill(number)
  await page.getByRole('button', { name: /Made Up Patient C/ }).waitFor()
  await page.getByText('In hospital').first().waitFor()
  await shot(page, 'find-patient')

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
  await page.getByRole('button', { name: 'Lock screen' }).click()
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
  await page.getByRole('button', { name: 'Lock screen' }).click()
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
  await page.getByRole('button', { name: 'Lock screen' }).click()
  await openLockCard(page)
  await page.getByText('Not you? Tap your name.').waitFor()
  await shot(page, 'lock-shared-desk')
  await page.getByRole('button', { name: /Test Nurse One/ }).click()
  await page.getByText('Welcome back, Test Nurse One').waitFor()
  await typeDigits(page, 'Your PIN', '4821')
  await expectHome(page, 'Test Nurse One')

  step('Nurse One signs out; Nurse Two is still remembered')
  await page.getByRole('button', { name: 'Sign out' }).click()
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
