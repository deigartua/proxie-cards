"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Plus, X, Trash2, ShoppingBag, ChevronRight, Wand2, BookOpen } from "lucide-react"
import { usePrintStore } from "@/providers/print-store-provider"
import { cn } from "@/lib/utils"

// Custom grimoire/spellbook icon for Magic aesthetic
function DeckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.5">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 7h8M8 11h6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Floating deck button — bottom-right corner, hidden on /mazo and /builder.
 * Shows total card count badge. When clicked, opens a side panel with all decks.
 */
export function FloatingDeckButton() {
  const pathname = usePathname()
  const router = useRouter()
  const { cartDecks: decks, totalCartCards: totalCards, removeDeck } = usePrintStore()
  const prevCountRef = useRef(totalCards)
  const [popKey, setPopKey] = useState(0)
  const [showPlus, setShowPlus] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  // Detect new cards added — trigger animation
  useEffect(() => {
    if (totalCards > prevCountRef.current) {
      setPopKey((k) => k + 1)
      setShowPlus(true)
      const t = setTimeout(() => setShowPlus(false), 800)
      prevCountRef.current = totalCards
      return () => clearTimeout(t)
    }
    prevCountRef.current = totalCards
  }, [totalCards])

  // Hide on the full mazo/builder pages
  if (pathname?.startsWith("/deckbuilder") || pathname?.startsWith("/builder") || pathname?.startsWith("/mazo")) return null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setPanelOpen(true)}
        aria-label={`Mi Deckbox${totalCards > 0 ? ` — ${totalCards} cartas` : ""}`}
        className={cn(
          "fixed bottom-5 right-5 z-50",
          "flex items-center justify-center",
          "h-14 w-14 bg-accent-blue text-white shadow-xl shadow-accent-blue/25",
          "hover:scale-105 hover:bg-accent-blue-dim active:scale-95 transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
        )}
      >
        <DeckIcon className="h-5 w-5" />

        {/* Badge */}
        {totalCards > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-white text-accent-blue text-[10px] font-black flex items-center justify-center leading-none tabular-nums shadow-sm">
            {totalCards > 99 ? "99+" : totalCards}
          </span>
        )}

        {/* Plus animation */}
        {showPlus && (
          <span
            key={popKey}
            className="absolute text-white font-black flex items-center gap-0.5 will-change-transform"
            style={{
              animation: "pop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              pointerEvents: "none",
            }}
          >
            <Plus className="h-3 w-3" />
          </span>
        )}

        <style>{`
          @keyframes pop {
            0% {
              opacity: 1;
              transform: scale(1);
            }
            100% {
              opacity: 0;
              transform: scale(2) translateY(-20px);
            }
          }
        `}</style>
      </button>

      {/* Side panel */}
      {panelOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setPanelOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className="fixed right-0 top-0 h-screen w-full max-w-md z-40 bg-background border-l border-border flex flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between p-4 border-b border-border">
              <h2 id="panel-title" className="text-lg font-bold text-white">
                MI DECKBOX
              </h2>
              <button
                onClick={() => setPanelOpen(false)}
                aria-label="Cerrar panel"
                className="p-1 text-white/60 hover:text-white/80 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {decks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
                  <BookOpen className="h-12 w-12 text-white/30" />
                  <p className="text-sm text-white/70">Tu Deckbox esta vacia</p>
                  <p className="text-xs text-white/60">
                    Agrega cartas o mazos preconstruidos
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {decks.map((deck) => {
                    const deckTotal = deck.entries.reduce((sum, e) => sum + e.quantity, 0)
                    const coverImg = deck.coverCard?.image_uris?.small || deck.coverCard?.card_faces?.[0]?.image_uris?.small

                    return (
                      <div
                        key={deck.id}
                        className="p-4 hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex gap-3">
                          {/* Cover thumbnail */}
                          <div className="w-12 h-16 bg-surface rounded border border-border shrink-0 overflow-hidden">
                            {coverImg ? (
                              <img src={coverImg} alt={deck.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/20 text-[9px]">
                                {deck.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-white truncate">{deck.name}</p>
                              {/* Type icon */}
                              {deck.type === "precon" && (
                                <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-mono">
                                  PRECON
                                </span>
                              )}
                              {deck.type === "set" && (
                                <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded font-mono">
                                  SET
                                </span>
                              )}
                              {deck.isModified && deck.type === "precon" && (
                                <div title="Mazo personalizado">
                                  <Wand2 className="h-3.5 w-3.5 text-accent-blue shrink-0" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-white/60">
                              {deckTotal} {deckTotal === 1 ? "carta" : "cartas"}
                            </p>
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar "${deck.name}" de tu Deckbox?`)) {
                                removeDeck(deck.id)
                              }
                            }}
                            aria-label={`Eliminar ${deck.name}`}
                            className="p-1 text-white/40 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {decks.length > 0 && (
              <div className="shrink-0 p-4 border-t border-border space-y-2">
                <div className="flex justify-between text-sm text-white/70">
                  <span>Total:</span>
                  <span className="font-semibold text-white">{totalCards} cartas</span>
                </div>
                <button
                  onClick={() => {
                    router.push("/deckbox")
                    setPanelOpen(false)
                  }}
                  className="w-full h-10 bg-accent-blue text-white font-bold rounded flex items-center justify-center gap-2 hover:bg-accent-blue-dim transition-colors"
                >
                  VER DECKBOX <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
