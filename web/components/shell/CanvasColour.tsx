/*
 * components/shell/CanvasColour.tsx: paints the page's own background (the
 * html element) in one colour while a full screen cover is showing.
 *
 * Why: Anthony, 2026-11-09, photos from the installed app on the iPad: a
 * light strip at the very bottom of the lock screen and of the starting
 * screen. In the installed app on an iPhone or iPad, the screen reaches
 * under the clock bar (black-translucent), so the page is drawn about 24
 * points higher than the screen, and the last 24 points at the bottom show
 * the page's own background, which no cover can reach. Painting that
 * background the cover's colour makes the strip disappear.
 *
 * Never: leave the colour behind. It goes back when the cover goes.
 */
'use client'

import { useEffect } from 'react'

// The covers showing now, newest last. The newest one's colour is painted;
// when it goes, the one under it shows again, and with none, the app's own.
const showing: string[] = []

function paint() {
  document.documentElement.style.background = showing[showing.length - 1] ?? ''
}

export default function CanvasColour({ colour }: { colour: string }) {
  useEffect(() => {
    showing.push(colour)
    paint()
    return () => {
      showing.splice(showing.lastIndexOf(colour), 1)
      paint()
    }
  }, [colour])
  return null
}
