/*
 * components/auth/SignInPhotos.tsx: the photos behind the sign in card.
 *
 * Why: Anthony, 2026-10-30 (request 110): a livelier sign in screen, with
 * pictures of doctors, nurses and patients under a blue wash of the
 * hospital colour, sliding and animated, small WebP files that fit a phone
 * and a desktop. He made the pictures himself (two ChatGPT collages); each
 * collage was cut into 5 photos in web/public/signin/.
 *
 * How it works:
 *   1. Five photos take turns, about 6 seconds each. The one on show drifts
 *      and zooms slowly, then fades into the next.
 *   2. A tall screen (a phone) gets the tall photos, a wide screen gets the
 *      wide ones. The browser picks, so only one set is downloaded.
 *   3. Only the first photo, and the one after it, load at the start. Each
 *      next photo loads while the one before it is on show.
 *   4. Somebody whose device asks for less motion sees the first photo,
 *      still, with no sliding.
 *
 * Never: put anything a person must read on the photos. They are
 * decoration, so a screen reader skips them, and the blue wash keeps the
 * white card easy to read.
 */
'use client'

import { useEffect, useState } from 'react'
import styles from './SignInPhotos.module.css'

// ===== 1. The photos and the timing =====
const PHOTO_COUNT = 5
const SHOW_EACH_MS = 6000

// ===== 2. The slideshow =====
export default function SignInPhotos() {
  // current: the photo on show. previous: the one fading out behind it.
  // furthest: how far the slideshow has got, so photos load one ahead and
  // stay loaded after.
  const [slides, setSlides] = useState({ current: 0, previous: -1, furthest: 0 })

  useEffect(() => {
    // Less motion asked for: stay on the first photo.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => {
      setSlides((now) => {
        const next = (now.current + 1) % PHOTO_COUNT
        return { current: next, previous: now.current, furthest: Math.max(now.furthest, next) }
      })
    }, SHOW_EACH_MS)
    return () => clearInterval(timer)
  }, [])

  const photos = Array.from({ length: PHOTO_COUNT }, (_, index) => index)

  return (
    <div className={styles.photos} aria-hidden="true">
      {photos.map((index) => {
        // Not reached yet, and not the next one: leave it unloaded for now.
        if (index > slides.furthest + 1) return null
        const state =
          index === slides.current
            ? styles.showing
            : index === slides.previous
              ? styles.leaving
              : ''
        return (
          <picture key={index} className={`${styles.photo} ${styles[`move${index + 1}`]} ${state}`}>
            <source media="(orientation: landscape)" srcSet={`/signin/desktop-${index + 1}.webp`} />
            <img
              src={`/signin/phone-${index + 1}.webp`}
              alt=""
              decoding="async"
              fetchPriority={index === 0 ? 'high' : 'low'}
            />
          </picture>
        )
      })}
      <div className={styles.wash} />
    </div>
  )
}
