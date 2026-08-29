"use client"

import { useMemo } from "react"
import { SearchPanel } from "@/components/search-panel"
import { PrintList } from "@/components/print-list"
import { PreconBrowser } from "@/components/precon-browser"
import { type AnyPackSize } from "@/lib/materials"
import { cn } from "@/lib/utils"
import type { ScryfallCard, PrintListEntry, DeckMode } from "@/types/scryfall"
import { CheckCircle2 } from "lucide-react"

interface StepDeckProps {
  mode: DeckMode
  packSize: AnyPackSize
  entries: PrintListEntry[]
  totalCards: number
  hydrated: boolean
  onAddCard: (card: ScryfallCard) => void
  onRemoveCard: (id: string) => void
  onSetQuantity: (id: string, qty: number) => void
  onClearAll: () => void
  onViewDetail: (card: ScryfallCard) => void
  onCardClick: (entry: PrintListEntry) => void
  onChangePackSize: (size: AnyPackSize) => void
  /** Precon: bulk-load a whole deck at once */
  onLoadPrecon: (cards: { card: ScryfallCard; quantity: number }[]) => void
}

export function StepDeck({
  mode,
  packSize,
  entries,
  totalCards,
  hydrated,
  onAddCard,
  onRemoveCard,
  onSetQuantity,
  onClearAll,
  onViewDetail,
  onCardClick,
  onChangePackSize,
  onLoadPrecon,
}: StepDeckProps) {
  const deckIds = useMemo(
    () => new Set(entries.map((e) => e.card.oracle_id ?? e.card.name)),
    [entries]
  )

  const isCustom = mode === "custom"

  // In custom mode, progress is capped at packSize. In precon mode it's open.
  const displayMax = isCustom ? (packSize as number) : totalCards
  const progress = isCustom && displayMax > 0 ? Math.min(totalCards / displayMax, 1) : 1
  const filled = isCustom ? totalCards >= displayMax && displayMax > 0 : totalCards > 0
  const remaining = isCustom ? Math.max(displayMax - totalCards, 0) : 0

  return (
    <div className="flex flex-col w-full flex-1 min-h-0 gap-0">
      {/* ── Progress header (custom mode only — in precon mode count is in the bottom bar) ── */}
      {isCustom && (
        <div className="shrink-0 px-4 pt-3 pb-3 border-b border-border bg-surface">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {filled ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />
              )}
              <span className="text-sm font-semibold text-foreground">
                {filled
                  ? "Mazo completo"
                  : remaining > 0
                    ? `${remaining} carta${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`
                    : "Armando tu mazo"}
              </span>
            </div>
            <span className="text-sm tabular-nums font-bold text-accent-gold">
              {totalCards}
              <span className="text-muted-foreground font-normal text-xs">/{displayMax}</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                filled ? "bg-emerald-500" : "bg-accent-gold",
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Overflow warning (custom mode only) ─────────────────────────── */}
      {isCustom && totalCards > (packSize as number) && (
        <div className="shrink-0 px-4 py-2.5 border-b border-border bg-orange-950/30 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-orange-300">
            Tenés {totalCards - (packSize as number)} carta{totalCards - (packSize as number) !== 1 ? "s" : ""} de más sobre el Pack {packSize}.
          </span>
          <span className="text-xs text-muted-foreground">
            Quitá cartas hasta llegar a {packSize}
            {packSize !== 100 ? `, o cambiá al Pack ${packSize === 30 ? 60 : 100}.` : "."}
          </span>
          {packSize !== 100 && (
            <button
              onClick={() => onChangePackSize(packSize === 30 ? 60 : 100)}
              className="text-xs font-semibold text-orange-300 underline underline-offset-2 hover:text-orange-200 transition-colors"
            >
              Cambiar a Pack {packSize === 30 ? 60 : 100}
            </button>
          )}
        </div>
      )}

      {/* ── Two-panel layout ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left panel: search (custom) or precon browser */}
        <div className="flex flex-col w-1/2 border-r border-border min-w-0 overflow-hidden">
          <div className="flex-1 overflow-hidden px-3 pb-3 pt-3 min-h-0">
            {isCustom ? (
              <SearchPanel
                deckIds={deckIds}
                onAddCard={onAddCard}
                onViewDetail={onViewDetail}
              />
            ) : (
              <PreconBrowser onLoadDeck={onLoadPrecon} />
            )}
          </div>
        </div>

        {/* Right panel: deck grid */}
        <div className="flex flex-col w-1/2 overflow-hidden bg-surface">
          <div className="flex-1 overflow-hidden px-3 py-3 min-h-0">
            <PrintList
              entries={entries}
              hydrated={hydrated}
              onRemove={onRemoveCard}
              onSetQuantity={onSetQuantity}
              onClearAll={onClearAll}
              onCardClick={onCardClick}
              onOpenDeckModal={() => {}}
              maxSize={isCustom ? displayMax : 9999}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
