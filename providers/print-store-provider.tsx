"use client"

import { createContext, useContext, ReactNode } from "react"
import { usePrintStore as createPrintStore, SINGLES_DECK_ID, SINGLES_DECK_NAME, GAME_FORMATS, MIN_CARDS_TO_SAVE } from "@/hooks/use-print-store"

// Re-export constants so they can be imported from this provider
export { SINGLES_DECK_ID, SINGLES_DECK_NAME, GAME_FORMATS, MIN_CARDS_TO_SAVE }

// Type for the store return value
type PrintStoreType = ReturnType<typeof createPrintStore>

// Create the context with a default null value
const PrintStoreContext = createContext<PrintStoreType | null>(null)

// Provider component
export function PrintStoreProvider({ children }: { children: ReactNode }) {
  const store = createPrintStore()
  return (
    <PrintStoreContext.Provider value={store}>
      {children}
    </PrintStoreContext.Provider>
  )
}

// Hook to use the store (clients should use this)
export function usePrintStore() {
  const context = useContext(PrintStoreContext)
  if (!context) {
    throw new Error("usePrintStore must be used within PrintStoreProvider")
  }
  return context
}
