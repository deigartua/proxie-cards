"use client"

import { useEffect } from "react"
import { X, Layers, Trash2, Minus, Plus, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PrintListEntry, ScryfallCard } from "@/types/scryfall"

function isDoubleFaced(card: ScryfallCard): boolean {
  return (
    Array.isArray(card.card_faces) &&
    card.card_faces.length >= 2 &&
    !!card.card_faces[0].image_uris
  )
}

function getThumb(card: ScryfallCard, selectedPrint?: ScryfallCard): string | undefined {
  const c = selectedPrint ?? card
  return c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small
}

interface DeckModalProps {
  entries: PrintListEntry[]
  totalCards: number
  onClose: () => void
  onRemove: (id: string) => void
  onSetQuantity: (id: string, qty: number) => void
  onClearAll: () => void
  onCardClick: (entry: PrintListEntry) => void
  onGeneratePdf: () => void
  generating: boolean
  progress: { loaded: number; total: number } | null
}

export function DeckModal({
  entries,
  totalCards,
  onClose,
  onRemove,
  onSetQuantity,
  onClearAll,
  onCardClick,
  onGeneratePdf,
  generating,
  progress,
}: DeckModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const totalSlots = entries.reduce((sum, e) => {
    return sum + e.quantity * (isDoubleFaced(e.card) ? 2 : 1)
  }, 0)
  const pages = Math.ceil(totalSlots / 9)
  const percent = progress ? Math.round((progress.loaded / progress.total) * 100) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tu mazo"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-foreground">Tu mazo</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground">{totalCards}</span> cartas ·{" "}
              <span className="font-semibold text-foreground">{totalSlots}</span> imágenes ·{" "}
              <span className="font-semibold text-foreground">{pages}</span>{" "}
              {pages === 1 ? "hoja" : "hojas"} A4
            </p>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={onClearAll}
              >
                Limpiar todo
              </Button>
            )}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1.5">
          {entries.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Tu mazo está vacío. Buscá cartas y agregálas con +
            </div>
          )}

          {entries.map((entry) => {
            const { card, quantity, selectedPrint } = entry
            const dfc = isDoubleFaced(card)
            const thumb = getThumb(card, selectedPrint)
            const displayCard = selectedPrint ?? card

            return (
              <div
                key={entry.id}
                className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-2 hover:border-accent-gold/30 transition-colors"
              >
                {/* Thumbnail — click to open detail */}
                <button
                  onClick={() => onCardClick(entry)}
                  className="relative h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-surface-raised hover:ring-2 hover:ring-accent-gold/50 transition-all"
                  aria-label={`Ver detalle de ${card.name}`}
                >
                  {thumb ? (
                    <img src={thumb} alt={card.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] text-muted-foreground">
                      ?
                    </div>
                  )}
                  {dfc && (
                    <div className="absolute bottom-0 right-0 rounded-tl-sm bg-accent-gold/90 p-0.5">
                      <Layers className="h-2 w-2 text-surface" />
                    </div>
                  )}
                  {selectedPrint && (
                    <div className="absolute top-0 left-0 rounded-br-sm bg-blue-500/80 px-0.5">
                      <span className="text-[7px] font-bold text-white">{selectedPrint.set.toUpperCase()}</span>
                    </div>
                  )}
                </button>

                {/* Info */}
                <button
                  onClick={() => onCardClick(entry)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-foreground leading-tight">
                    {card.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground leading-tight mt-0.5">
                    {displayCard.set_name}
                    {selectedPrint && (
                      <span className="ml-1.5 text-blue-400">· Arte alternativo</span>
                    )}
                  </p>
                  {dfc && (
                    <p className="text-[10px] text-accent-gold mt-0.5">Ambas caras en PDF</p>
                  )}
                </button>

                {/* Quantity controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:border-accent-gold/40 transition-colors"
                    onClick={() => onSetQuantity(entry.id, quantity - 1)}
                    aria-label="Reducir"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-foreground tabular-nums">
                    {quantity}
                  </span>
                  <button
                    className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:border-accent-gold/40 transition-colors"
                    onClick={() => onSetQuantity(entry.id, quantity + 1)}
                    aria-label="Aumentar"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {/* Remove */}
                <button
                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  onClick={() => onRemove(entry.id)}
                  aria-label={`Eliminar ${card.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer: generate PDF */}
        <div className="border-t border-border p-3 shrink-0">
          <Button
            onClick={onGeneratePdf}
            disabled={entries.length === 0 || generating}
            className="w-full bg-accent-gold text-surface font-semibold hover:bg-accent-gold/90 disabled:opacity-50"
            size="lg"
          >
            {generating ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-surface/40 border-t-surface" />
                {percent !== null ? `Descargando imágenes... ${percent}%` : "Preparando PDF..."}
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Generar PDF A4
                {totalCards > 0 && (
                  <span className="ml-2 rounded-full bg-surface/20 px-2 py-0.5 text-xs font-bold">
                    {totalCards} cartas
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
