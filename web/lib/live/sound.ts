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

function note(audio: AudioContext, frequency: number, start: number, loud = 0.22, long = 0.18) {
  const tone = audio.createOscillator()
  const volume = audio.createGain()
  tone.type = 'sine'
  tone.frequency.setValueAtTime(frequency, start)
  // Quick in, gentle out: a "pom", not a beep.
  volume.gain.setValueAtTime(0.0001, start)
  volume.gain.exponentialRampToValueAtTime(loud, start + 0.015)
  volume.gain.exponentialRampToValueAtTime(0.0001, start + long)
  tone.connect(volume).connect(audio.destination)
  tone.start(start)
  tone.stop(start + long + 0.02)
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

// ===== The notification sound (request 171d) =====
// Anthony, 2026-11-09: "all notifications should come with a sound... a
// unique sound that can't be ignored." Our own: a bright rising three note
// chime, played twice, louder and longer than the message pom, so it is
// heard across a busy room and never mistaken for a message.
export function playNoticeSound(): void {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    for (const start of [0, 0.62]) {
      note(context, 880, now + start, 0.4, 0.22) // A5
      note(context, 1175, now + start + 0.14, 0.4, 0.22) // D6
      note(context, 1568, now + start + 0.28, 0.45, 0.32) // G6
    }
  } catch {
    // No sound on this device: stay quiet.
  }
}
