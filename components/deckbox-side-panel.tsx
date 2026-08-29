"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { usePrintStore, GAME_FORMATS, SINGLES_DECK_ID, SINGLES_DECK_NAME } from "@/providers/print-store-provider"
import { useDeckbox } from "@/providers/deckbox-provider"
import { cn } from "@/lib/utils"
import { fetchDecksMetadata, fetchCardsForDeck } from "@/lib/deck-utils"
import { DeckRowItem } from "@/components/deck-row-item"
import {
  X, ShoppingBag, ChevronRight, Package, LayoutList, BookOpen, Plus,
} from "lucide-react"
import type { DeckItem, ScryfallCard } from "@/types/scryfall"

const PANEL_WIDTH = 320

// ── Section ────────────────────────────────────────────────────────────────────

function Section({
  label, icon: Icon, decks, onRemove, onPreview, canRemove = true,
}: {
  label: string
  icon: React.ElementType
  decks: DeckItem[]
  onRemove: (id: string) => void
  onPreview: (d: DeckItem) => void
  canRemove?: boolean
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  if (!decks.length) return null
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1.5 px-0.5">
        <Icon className="h-3 w-3" /> {label}
      </p>
      {decks.map(d => (
        <DeckRowItem
          key={d.id}
          deck={d}
          acceptDrop={true}
          compact={true}
          onClick={() => onPreview(d)}
          onRemove={canRemove ? () => {
            if (confirmingId === d.id) { onRemove(d.id); setConfirmingId(null) }
            else setConfirmingId(d.id)
          } : undefined}
          isConfirmingDelete={confirmingId === d.id}
        />
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DeckboxSidePanel() {
  const router                                           = useRouter()
  const { open, setOpen }                                = useDeckbox()
  const { cartDecks, totalCartCards, removeDeck,
          editCartDeck, editPreconDeck,
          addPreconToCart, addSingleCard, addCardToDeck,
          resetBuilder } = usePrintStore()
  const [dropDragOver, setDropDragOver]                  = useState(false)
  const [droppingDeck, setDroppingDeck]                  = useState(false)


  // Push main content left by injecting padding-right on <body> via a CSS var
  useEffect(() => {
    const root = document.documentElement
    if (open) {
      root.style.setProperty("--deckbox-panel-width", `${PANEL_WIDTH}px`)
    } else {
      root.style.setProperty("--deckbox-panel-width", "0px")
    }
    return () => { root.style.removeProperty("--deckbox-panel-width") }
  }, [open])

  // Handle dropping onto the panel background (sets, precons, and loose cards)
  async function handlePanelDrop(e: React.DragEvent) {
    e.preventDefault()
    setDropDragOver(false)

    // ── Loose card drop — add directly to the first non-singles deck, or singles ─
    const cardData = e.dataTransfer.getData("application/x-mtg-card")
    if (cardData) {
      try {
        const card: ScryfallCard = JSON.parse(cardData)
        const firstCustom = cartDecks.find(d => d.type !== "singles")
        if (firstCustom) {
          addCardToDeck(firstCustom.id, card, 1)
        } else {
          addSingleCard(card, 1)
        }
      } catch {}
      return
    }

    // ── Set drop: fetch all cards then add as a new deck ─────────────────────
    const setData = e.dataTransfer.getData("application/x-mtg-set")
    if (setData) {
      try {
        const { code, name } = JSON.parse(setData) as { code: string; name: string; card_count: number }
        setDroppingDeck(true)
        let allCards: ScryfallCard[] = []
        let url: string | null = `https://api.scryfall.com/cards/search?q=set%3A${code}&order=set&unique=prints`
        while (url) {
          const res: Response = await fetch(url)
          const data: { data: ScryfallCard[]; has_more: boolean; next_page: string } = await res.json()
          allCards = allCards.concat(data.data ?? [])
          url = data.has_more ? data.next_page : null
        }
        const entries = allCards.map(c => ({ id: c.oracle_id ?? c.name, card: c, quantity: 1 }))
        addPreconToCart(`Set: ${name}`, entries, allCards[0])
      } catch {}
      setDroppingDeck(false)
      return
    }

    // ── Precon drop: look up the deck in decks-all.json then fetch real cards ──
    const preconData = e.dataTransfer.getData("application/x-mtg-precon")
    if (preconData) {
      try {
        const { id, name } = JSON.parse(preconData) as { id: string; code: string; name: string }
        setDroppingDeck(true)
        // Find the real deck metadata (with the correct 100-card list)
        const allDecks = await fetchDecksMetadata()
        const deck = allDecks.find(d => d.id === id)
        if (deck) {
          const fetchedCards = await fetchCardsForDeck(deck)
          const entries = fetchedCards.map(c => ({
            id: c.oracle_id ?? c.name,
            card: c,
            quantity: (c as any).quantity ?? 1,
          }))
          const cover = fetchedCards.find(c => (c as any).isCommander) ?? fetchedCards[0]
          addPreconToCart(name, entries, cover, id)
        }
      } catch {}
      setDroppingDeck(false)
      return
    }
  }

  if (!open) return null

  const singlesDecks = cartDecks.filter(d => d.type === "singles")
  const preconDecks  = cartDecks.filter(d => d.type === "precon" || d.type === "set")
  const customDecks  = cartDecks.filter(d => d.type === "custom")
  const isEmpty      = cartDecks.length === 0

  function handlePreview(deck: DeckItem) {
    if (deck.type === "precon") editPreconDeck(deck.id)
    else editCartDeck(deck.id)
    setOpen(false)
    router.push(`/deckbuilder/${deck.id}`)
  }

  return (
    <aside
      className={cn(
        "fixed top-14 right-0 z-40 flex flex-col bg-card border-l border-border shadow-2xl shadow-black/60 transition-all w-full sm:w-80",
        dropDragOver && "border-accent-gold/60 bg-accent-gold/5"
      )}
      style={{ height: "calc(100dvh - 56px)" }}
      aria-label="Deckbox"
      onDragOver={e => {
        e.preventDefault()
        const types = e.dataTransfer.types
        if (types.some(t => t === "application/x-mtg-set" || t === "application/x-mtg-precon" || t === "application/x-mtg-card")) {
          setDropDragOver(true)
        }
      }}
      onDragLeave={e => {
        // Only clear if leaving the aside itself, not a child
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropDragOver(false)
      }}
      onDrop={handlePanelDrop}
    >
      {/* Header */}
      <div className="shrink-0 hidden md:flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-accent-blue/15 flex items-center justify-center">
            <ShoppingBag className="h-3.5 w-3.5 text-accent-blue" />
          </div>
          <span className="text-sm font-bold text-foreground tracking-wide">Mi Deckbox</span>
          {!isEmpty && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-blue text-white tabular-nums min-w-[20px] text-center">
              {totalCartCards}
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-raised transition-colors"
          aria-label="Cerrar Deckbox"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Drag hint */}
      <div className="shrink-0 hidden md:flex px-4 py-1.5 border-b border-border/60">
        <span className="text-[10px] text-muted-foreground/50 font-medium">
          {isEmpty
            ? "Arrastra cartas, sets o precons aqui"
            : "Arrastra cartas sobre un mazo · o suelta un set/precon"}
        </span>
      </div>

      {/* Loading deck overlay */}
      {droppingDeck && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-card/90 backdrop-blur-sm gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-accent-gold/30 border-t-accent-gold animate-spin" />
          <p className="text-sm font-semibold text-accent-gold">Cargando cartas...</p>
        </div>
      )}

      {/* Drop-zone highlight overlay (shown while dragging) */}
      {dropDragOver && (
        <div className="absolute inset-0 z-40 border-2 border-dashed border-accent-gold/60 rounded-none pointer-events-none flex items-center justify-center">
          <div className="bg-accent-gold/10 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
            <p className="text-sm font-bold text-accent-gold">Soltar aqui</p>
            <p className="text-[10px] text-accent-gold/60 mt-0.5">Carta, set completo o precon</p>
          </div>
        </div>
      )}



      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Crear nuevo deck — always visible at the top */}
        <button
          onClick={() => { resetBuilder(); router.push("/deckbuilder?setup=true"); setOpen(false) }}
          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-accent-blue/40 bg-accent-blue/5 hover:border-accent-blue/70 hover:bg-accent-blue/10 transition-all group text-left"
        >
          <div className="w-9 h-12 rounded-lg bg-accent-blue/10 border border-accent-blue/20 shrink-0 flex items-center justify-center group-hover:bg-accent-blue/20 transition-colors">
            <Plus className="h-5 w-5 text-accent-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-accent-blue leading-tight">Crear nuevo deck</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Elegí formato y empezá</p>
          </div>
          <ChevronRight className="h-4 w-4 text-accent-blue/40 group-hover:text-accent-blue/70 shrink-0 transition-colors" />
        </button>

        {/* Deck sections — singles can't be removed */}
        <Section label="Singles"   icon={Package}    decks={singlesDecks} onRemove={() => {}}          onPreview={handlePreview} canRemove={false} />
        <Section label="Precons"   icon={LayoutList} decks={preconDecks}  onRemove={id => removeDeck(id)} onPreview={handlePreview} canRemove={true} />
        <Section label="Mis decks" icon={BookOpen}   decks={customDecks}  onRemove={id => removeDeck(id)} onPreview={handlePreview} canRemove={true} />
      </div>

      {/* Footer */}
      {!isEmpty && (
        <div className="shrink-0 border-t border-border/60 px-4 py-3 space-y-2.5 bg-surface/50">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-muted-foreground text-xs">Total cartas</span>
            <span className="font-bold text-foreground tabular-nums text-sm">{totalCartCards}</span>
          </div>

          {/* Order-level minimum bar (< 30) */}
          {totalCartCards < 30 && (
            <div className="space-y-1">
              <div className="h-1 rounded-full bg-border/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${Math.min((totalCartCards / 30) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-amber-400/80 tabular-nums">
                Minimo 30 cartas · faltan {30 - totalCartCards}
              </p>
            </div>
          )}

          {/* Next bracket hint (30–99 cards) */}
          {totalCartCards >= 30 && totalCartCards < 60 && (
            <p className="text-[10px] text-muted-foreground/60 leading-snug">
              Con 60 cartas o mas baja el precio por carta
            </p>
          )}
          {totalCartCards >= 60 && totalCartCards < 100 && (
            <p className="text-[10px] text-accent-blue/70 leading-snug">
              Mejor precio a partir de 100 cartas · te faltan {100 - totalCartCards}
            </p>
          )}

          <button
            onClick={() => { router.push("/deckbox"); setOpen(false) }}
            className={cn(
              "w-full h-10 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold tracking-widest uppercase font-display transition-colors",
              totalCartCards < 30
                ? "bg-surface-raised text-muted-foreground cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            )}
            disabled={totalCartCards < 30}
          >
            <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
            {totalCartCards < 30 ? `Faltan ${30 - totalCartCards} cartas` : "Comprar"}
          </button>
        </div>
      )}
    </aside>
  )
}
