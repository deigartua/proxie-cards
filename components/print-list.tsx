"use client"

import { useState } from "react"
import { Trash2, Minus, Plus, Layers, FileWarning, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PrintListEntry, ScryfallCard } from "@/types/scryfall"

function isDoubleFaced(card: ScryfallCard): boolean {
  return (
    Array.isArray(card.card_faces) &&
    card.card_faces.length >= 2 &&
    !!card.card_faces[0].image_uris &&
    !!card.card_faces[1].image_uris
  )
}

function getCardThumb(card: ScryfallCard): string | undefined {
  // Prefer normal size for better quality in the grid
  return (
    card.image_uris?.normal ??
    card.image_uris?.small ??
    card.card_faces?.[0]?.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.small
  )
}

// ─── Card Grid Cell ───────────────────────────────────────────────────────────

interface CardCellProps {
  entry: PrintListEntry
  copyIndex?: number
  onRemove: (id: string) => void
  onSetQuantity: (id: string, qty: number) => void
  onCardClick: (entry: PrintListEntry) => void
}

function CardCell({ entry, copyIndex, onRemove, onSetQuantity, onCardClick }: CardCellProps) {
  const { card, quantity, selectedPrint } = entry
  const dfc = isDoubleFaced(card)
  const displayCard = selectedPrint ?? card
  const thumb = getCardThumb(displayCard)

  return (
    <div className="group relative aspect-[63/88] overflow-hidden rounded-lg bg-surface-raised ring-1 ring-border hover:ring-accent-gold/50 transition-all">
      {/* Card art — click opens detail */}
      <button
        onClick={() => onCardClick(entry)}
        className="absolute inset-0 w-full h-full"
        aria-label={`Editar ${card.name}`}
      >
        {thumb ? (
          <img
            src={thumb}
            alt={card.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[8px] text-muted-foreground text-center px-1 leading-tight">
            {card.name}
          </div>
        )}
      </button>

      {/* Badges */}
      {dfc && (
        <div className="absolute top-1 right-1 rounded-sm bg-accent-gold/90 p-0.5 pointer-events-none">
          <Layers className="h-2.5 w-2.5 text-surface" />
        </div>
      )}
      {selectedPrint && (
        <div className="absolute top-1 left-1 rounded-sm bg-blue-500/90 px-1 py-0.5 pointer-events-none">
          <span className="text-[7px] font-bold text-white leading-none">
            {selectedPrint.set.toUpperCase()}
          </span>
        </div>
      )}

      {/* Copy index badge — shown when there are multiple copies */}
      {quantity > 1 && copyIndex !== undefined && (
        <div className="absolute bottom-1 right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-black/70 px-1.5 pointer-events-none">
          <span className="text-[10px] font-bold text-white leading-none">{copyIndex + 1}/{quantity}</span>
        </div>
      )}

      {/* Hover overlay: name + qty controls + delete */}
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        {/* Delete button top-right */}
        <div className="flex justify-end p-1">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(entry.id) }}
            className="flex h-5 w-5 items-center justify-center rounded bg-black/60 text-white/70 hover:text-red-400 hover:bg-black/80 transition-colors"
            aria-label={`Eliminar ${card.name}`}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>

        {/* Name + qty at bottom */}
        <div className="px-1.5 pb-1.5">
          <p className="text-[9px] font-semibold text-white leading-tight line-clamp-2 mb-1">
            {card.name}
          </p>
          {/* Qty controls */}
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onSetQuantity(entry.id, quantity - 1) }}
              className="flex h-4 w-4 items-center justify-center rounded bg-white/20 hover:bg-white/40 transition-colors text-white"
              aria-label="Reducir cantidad"
            >
              <Minus className="h-2 w-2" />
            </button>
            <span className="min-w-[16px] text-center text-[10px] font-bold text-white tabular-nums">
              {quantity}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onSetQuantity(entry.id, quantity + 1) }}
              className="flex h-4 w-4 items-center justify-center rounded bg-white/20 hover:bg-white/40 transition-colors text-white"
              aria-label="Aumentar cantidad"
            >
              <Plus className="h-2 w-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Print List Panel ─────────────────────────────────────────────────────────

interface PrintListProps {
  entries: PrintListEntry[]
  hydrated: boolean
  onRemove: (id: string) => void
  onSetQuantity: (id: string, qty: number) => void
  onClearAll: () => void
  onCardClick: (entry: PrintListEntry) => void
  onOpenDeckModal: () => void
  maxSize?: number
}

// Total card slots filled by entries (sum of quantities)
function totalSlots(entries: PrintListEntry[]): number {
  return entries.reduce((sum, e) => sum + e.quantity, 0)
}

export function PrintList({
  entries,
  hydrated,
  onRemove,
  onSetQuantity,
  onClearAll,
  onCardClick,
  maxSize,
  // onOpenDeckModal is kept in the interface for future use
}: PrintListProps) {
  const [confirmClear, setConfirmClear] = useState(false)

  function handleClearAll() {
    if (!confirmClear) { setConfirmClear(true); return }
    onClearAll()
    setConfirmClear(false)
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Clear button row */}
      {entries.length > 0 && (
        <div className="flex items-center justify-end gap-2 shrink-0">
          {confirmClear && (
            <>
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                ¿Eliminar todo?
              </span>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs transition-colors ${
              confirmClear
                ? "text-destructive bg-destructive/10 hover:bg-destructive/20"
                : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            }`}
            onClick={handleClearAll}
          >
            {confirmClear ? "Sí, limpiar" : "Limpiar todo"}
          </Button>
        </div>
      )}

      {/* 3-column card grid */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollbarGutter: "stable" }}
        onWheel={e => e.stopPropagation()}
      >
        <div className="pb-4">
          {/* Skeleton while hydrating */}
          {!hydrated && (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[63/88] animate-pulse rounded-lg bg-surface-raised"
                />
              ))}
            </div>
          )}

          {/* Empty state — only when there's no maxSize context */}
          {hydrated && entries.length === 0 && !maxSize && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <FileWarning className="mx-auto mb-3 h-8 w-8 opacity-20" />
              <p className="font-medium">Tu mazo está vacío</p>
              <p className="mt-1 text-xs opacity-60">
                Buscá cartas a la izquierda y agregálas con +
              </p>
            </div>
          )}

          {/* Grid — each entry is rendered once per copy (qty > 1 → multiple cells) */}
          {hydrated && (
            <div className="grid grid-cols-3 gap-2">
              {entries.flatMap((entry) =>
                Array.from({ length: entry.quantity }, (_, i) => (
                  <CardCell
                    key={`${entry.id}-copy-${i}`}
                    entry={entry}
                    copyIndex={i}
                    onRemove={onRemove}
                    onSetQuantity={onSetQuantity}
                    onCardClick={onCardClick}
                  />
                ))
              )}
              {/* Ghost slots: one per remaining card slot up to maxSize */}
              {maxSize != null && (() => {
                const filled = totalSlots(entries)
                const remaining = Math.max(maxSize - filled, 0)
                if (remaining === 0) return null
                return Array.from({ length: remaining }).map((_, i) => (
                  <div
                    key={`ghost-${i}`}
                    className="relative aspect-[63/88] rounded-lg border border-dashed border-border/40 bg-surface-raised/50 flex items-center justify-center overflow-hidden"
                  >
                    {/* Subtle slot number */}
                    <span className="select-none text-[28px] font-black text-muted-foreground/10 tabular-nums leading-none">
                      {filled + i + 1}
                    </span>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
