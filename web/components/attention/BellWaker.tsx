/*
 * components/attention/BellWaker.tsx: gets the bell ready on every screen,
 * the sign in and PIN screens included.
 *
 * Why: a browser plays sound only after the person has touched the page.
 * Typing the PIN is that touch, so after unlocking the bell can ring at
 * once, without anybody having to tap the screen first.
 *
 * Never: play a sound from here. It only gets the sound ready.
 */
'use client'

import { useEffect } from 'react'
import { prepareBell } from './bell'

export default function BellWaker() {
  useEffect(() => {
    prepareBell()
  }, [])
  return null
}
