"use client"

import { useAuth } from "@/hooks/use-auth"
import { useDeckSync } from "@/hooks/use-deck-sync"
import { DeckMergeDialog } from "@/components/deck-merge-dialog"

/**
 * Mounts auth + deck sync for the whole app.
 * Placed in the root layout so it runs on every page, regardless of where the
 * user logs in from (navbar modal, deckbuilder gate, etc).
 */
export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { mergePrompt, keepBothDecks, useOnlyAccountDecks } = useDeckSync(user)
  return (
    <>
      {children}
      {mergePrompt && (
        <DeckMergeDialog
          prompt={mergePrompt}
          onKeepBoth={keepBothDecks}
          onUseAccountOnly={useOnlyAccountDecks}
        />
      )}
    </>
  )
}
