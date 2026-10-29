/*
 * components/attention/bell.ts: the "Kring!" bell sound.
 *
 * Why: Anthony, 2026-10-29: "the ringing bell sound. Kring!" The sound is
 * made in the browser (Web Audio), so there is no sound file to download
 * and it works offline.
 *
 * A browser only plays sound after the person has touched the page once.
 * Signing in counts. So the first tap or key press anywhere wakes the sound
 * up (section 1), and every ring after that plays.
 *
 * Never: play the bell for a call this person made themselves.
 */

let context: AudioContext | null = null
let prepared = false

// ===== 1. Wake the sound up on the first touch =====
// Every touch checks again, because a phone can put the sound back to
// sleep when the screen locks.
export function prepareBell() {
  if (typeof window === 'undefined' || prepared) return
  prepared = true
  const wake = () => {
    try {
      context ??= new AudioContext()
      if (context.state === 'suspended') void context.resume()
    } catch {
      // No sound on this device. The card still shows.
    }
  }
  window.addEventListener('pointerdown', wake, { passive: true })
  window.addEventListener('keydown', wake)
}

// ===== 2. One strike of the bell: a bright tone that dies away =====
function strike(at: number) {
  if (!context) return
  // A bell is a main tone plus a few higher ones that fade faster.
  for (const [frequency, loudness, length] of [
    [1320, 0.28, 1.1],
    [2640, 0.12, 0.6],
    [3960, 0.06, 0.35],
  ]) {
    const tone = context.createOscillator()
    const volume = context.createGain()
    tone.frequency.value = frequency
    volume.gain.setValueAtTime(0.0001, at)
    volume.gain.exponentialRampToValueAtTime(loudness, at + 0.005)
    volume.gain.exponentialRampToValueAtTime(0.0001, at + length)
    tone.connect(volume).connect(context.destination)
    tone.start(at)
    tone.stop(at + length)
  }
}

// ===== 3. Kring: two quick strikes =====
export function ringBell() {
  if (!context || context.state !== 'running') return
  const now = context.currentTime
  strike(now)
  strike(now + 0.18)
}
