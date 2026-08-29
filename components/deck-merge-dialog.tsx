"use client"

import { Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DeckMergePrompt } from "@/hooks/use-deck-sync"

interface DeckMergeDialogProps {
  prompt: DeckMergePrompt
  onKeepBoth: () => void
  onUseAccountOnly: () => void
}

/**
 * Shown right after login when the current device has real, unsynced decks
 * that differ from what's already saved in the account. Never resolves this
 * silently — the user always chooses whether to keep the local decks too.
 */
export function DeckMergeDialog({ prompt, onKeepBoth, onUseAccountOnly }: DeckMergeDialogProps) {
  const localDeckCount = prompt.local.filter(d => d.entries.length > 0).length
  const localCardCount = prompt.local.reduce(
    (sum, deck) => sum + deck.entries.reduce((s, e) => s + e.quantity, 0),
    0,
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <span className="h-7 w-7 rounded-full bg-accent-gold/15 flex items-center justify-center shrink-0">
            <Layers className="h-3.5 w-3.5 text-accent-gold" />
          </span>
          <h2 className="text-sm font-bold text-foreground tracking-tight">Mazos sin guardar</h2>
        </div>

        <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Este dispositivo tiene {localDeckCount === 1 ? "un mazo" : `${localDeckCount} mazos`} con{" "}
            {localCardCount} {localCardCount === 1 ? "carta" : "cartas"} que todavía no están en tu cuenta.
            ¿Querés agregarlos?
          </p>

          <div className="flex flex-col gap-2">
            <Button
              onClick={onKeepBoth}
              className="rounded-xl bg-accent-blue text-white hover:bg-accent-blue/90"
            >
              Agregar a mi cuenta
            </Button>
            <Button
              onClick={onUseAccountOnly}
              variant="outline"
              className="rounded-xl border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-raised"
            >
              Usar solo lo de mi cuenta
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
