"use client"

import { useRouter } from "next/navigation"
import { usePrintStore } from "@/providers/print-store-provider"
import { cn } from "@/lib/utils"
import {
  X,
  Trash2,
  BookOpen,
  Wand2,
  ShoppingBag,
  ChevronRight,
  Plus,
  Pencil,
} from "lucide-react"
import type { DeckItem } from "@/types/scryfall"

// ── Type badge ─────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: DeckItem["type"] }) {
  if (type === "precon")
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase tracking-wider">
        Precon
      </span>
    )
  if (type === "set")
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent-blue/20 text-accent-blue uppercase tracking-wider">
        Set
      </span>
    )
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent-gold/20 text-accent-gold uppercase tracking-wider">
      Custom
    </span>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface BuilderCartPanelProps {
  open: boolean
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BuilderCartPanel({ open, onClose }: BuilderCartPanelProps) {
  const router = useRouter()
  const { cartDecks, totalCartCards, removeDeck, editCartDeck } = usePrintStore()

  const isEmpty = cartDecks.length === 0

  if (!open) return null

  const handleEdit = (deckId: string) => {
    editCartDeck(deckId)
    onClose()
    router.push("/deckbuilder")
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-screen w-full max-w-[400px] z-50 bg-[#0e0f16] border-l border-accent-blue/50 flex flex-col shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Mi Deckbox"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-accent-blue" />
            <h2 className="text-sm font-bold text-white tracking-widest uppercase">
              Mi Deckbox
            </h2>
            {!isEmpty && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-blue text-white tabular-nums">
                {totalCartCards}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Cerrar carrito"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
              <ShoppingBag className="h-12 w-12 text-white/25" />
              <p className="text-sm font-semibold text-white/70">Deckbox vacia</p>
              <p className="text-xs text-white/60 leading-relaxed">
                Agrega cartas al deck activo y guardalo, o importa un precon para comenzar.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {cartDecks.map((deck) => {
                const count    = deck.entries.reduce((s, e) => s + e.quantity, 0)
                const coverImg =
                  deck.coverCard?.image_uris?.small ||
                  deck.coverCard?.card_faces?.[0]?.image_uris?.small
                const isCustom = deck.type === "custom"

                return (
                  <div
                    key={deck.id}
                    className="group flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/[0.08] border border-white/5 hover:border-white/10 transition-all"
                  >
                    {/* Cover */}
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0">
                      {coverImg ? (
                        <img src={coverImg} alt={deck.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-white/20" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <TypeBadge type={deck.type} />
                        {deck.isModified && deck.type === "precon" && (
                          <Wand2 className="h-3 w-3 text-accent-blue" aria-label="Modificado" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white truncate leading-tight">
                        {deck.name}
                      </p>
                      <p className="text-xs text-white/60 tabular-nums">
                        {count} {count === 1 ? "carta" : "cartas"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isCustom && (
                        <button
                          onClick={() => handleEdit(deck.id)}
                          className="p-1.5 text-white/60 hover:text-accent-blue hover:bg-accent-blue/10 transition-all rounded-lg"
                          aria-label={`Editar ${deck.name}`}
                          title="Editar mazo"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`¿Quitar "${deck.name}"?`)) removeDeck(deck.id)
                        }}
                        className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all rounded-lg"
                        aria-label={`Eliminar ${deck.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/10 p-4 space-y-3">
          {!isEmpty && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Total de cartas</span>
                <span className="font-bold text-white tabular-nums">{totalCartCards}</span>
              </div>
              <button
                onClick={() => { router.push("/deckbox"); onClose() }}
                className="w-full h-11 bg-accent-blue text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-accent-blue/90 transition-colors"
              >
                Comprar decks
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className={cn(
              "w-full h-10 border border-white/10 text-white/60 text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
            )}
          >
            Seguir armando
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  )
}
