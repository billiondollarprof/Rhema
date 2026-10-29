/*
 * components/attention/AttentionContext.tsx: lets any screen open the Call
 * attention list.
 *
 * Why: the list lives in the top bar, and the "Call attention" button on
 * Home opens the same list (Anthony, 2026-10-29: "it should not be
 * something that opens a new page").
 *
 * Never: hold calls or room lists here. It only knows open or shut.
 */
'use client'

import { createContext, useContext } from 'react'

export type AttentionMenuState = { open: boolean; setOpen: (open: boolean) => void }

export const AttentionMenuContext = createContext<AttentionMenuState>({
  open: false,
  setOpen: () => {},
})

export function useAttentionMenu() {
  return useContext(AttentionMenuContext)
}
