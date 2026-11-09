/*
 * lib/live/sound.ts: the soft two note sound when a message arrives.
 *
 * Why: Anthony, 2026-11-08: "I want that iPhone message sound... a pop
 * sound. Pom pom, message has dropped." Apple's own sound belongs to Apple,
 * so this is our own: two short, soft notes, the second higher, made by the
 * browser itself (no sound file to download).
 *
 * A browser plays sound only after the person has touched the page; by the
 * time somebody is reading messages they have, so it plays. If it cannot,
 * it stays quiet and nothing breaks.
 *
 * Never: play it loud or long, or for a message you sent yourself.
 */
let context: AudioContext | null = null

function note(audio: AudioContext, frequency: number, start: number) {
  const tone = audio.createOscillator()
  const volume = audio.createGain()
  tone.type = 'sine'
  tone.frequency.setValueAtTime(frequency, start)
  // Quick in, gentle out: a "pom", not a beep.
  volume.gain.setValueAtTime(0.0001, start)
  volume.gain.exponentialRampToValueAtTime(0.22, start + 0.015)
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
  tone.connect(volume).connect(audio.destination)
  tone.start(start)
  tone.stop(start + 0.2)
}

export function playMessageSound(): void {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    note(context, 784, now) // G5
    note(context, 1047, now + 0.12) // C6
  } catch {
    // No sound on this device: stay quiet.
  }
}
