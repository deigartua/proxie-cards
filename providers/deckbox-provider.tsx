"use client"

import { createContext, useContext, useState } from "react"

interface DeckboxContextValue {
  open:          boolean
  setOpen:       (v: boolean) => void
  toggle:        () => void
  /** ID of the last deck the user added a card to — used for the split-button default */
  lastDeckId:    string | null
  setLastDeckId: (id: string) => void
}

const DeckboxContext = createContext<DeckboxContextValue>({
  open:          false,
  setOpen:       () => {},
  toggle:        () => {},
  lastDeckId:    null,
  setLastDeckId: () => {},
})

export function DeckboxProvider({ children }: { children: React.ReactNode }) {
  const [open,       setOpen]       = useState(false)
  const [lastDeckId, setLastDeckId] = useState<string | null>(null)
  const toggle = () => setOpen(v => !v)
  return (
    <DeckboxContext.Provider value={{ open, setOpen, toggle, lastDeckId, setLastDeckId }}>
      {children}
    </DeckboxContext.Provider>
  )
}

export function useDeckbox() {
  return useContext(DeckboxContext)
}
