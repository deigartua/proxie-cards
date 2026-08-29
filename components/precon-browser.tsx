"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Search, X, BookOpen, ChevronRight, Loader2, RotateCcw, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ScryfallCard } from "@/types/scryfall"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScryfallSet {
  code: string
  name: string
  set_type: string
  released_at?: string
  card_count: number
  icon_svg_uri: string
  search_uri: string
}

interface PreconCard {
  card: ScryfallCard
  quantity: number
}

interface PreconBrowserProps {
  onLoadDeck: (cards: PreconCard[]) => void
}

// ── Scryfall set types considered "preconstructed" ────────────────────────────
const PRECON_SET_TYPES = ["commander", "duel_deck", "starter", "planechase", "archenemy", "box"]

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchPreconSets(): Promise<ScryfallSet[]> {
  const res = await fetch("https://api.scryfall.com/sets")
  if (!res.ok) throw new Error("No se pudieron cargar los sets")
  const data = await res.json()
  return (data.data as ScryfallSet[]).filter(
    (s) => PRECON_SET_TYPES.includes(s.set_type) && s.card_count >= 10
  )
}

async function fetchAllCardsInSet(searchUri: string): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = []
  let url: string | null = searchUri
  while (url) {
    const res: Response = await fetch(url)
    if (!res.ok) break
    const data: { data: ScryfallCard[]; has_more: boolean; next_page: string } = await res.json()
    cards.push(...data.data)
    url = data.has_more ? data.next_page : null
  }
  return cards
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PreconBrowser({ onLoadDeck }: PreconBrowserProps) {
  const [sets, setSets] = useState<ScryfallSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selectedSet, setSelectedSet] = useState<ScryfallSet | null>(null)
  const [loadingCards, setLoadingCards] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load sets on mount
  useEffect(() => {
    setLoading(true)
    fetchPreconSets()
      .then((data) => {
        // Sort by release date descending (newest first)
        const sorted = data.sort((a, b) => {
          if (!a.released_at || !b.released_at) return 0
          return b.released_at.localeCompare(a.released_at)
        })
        setSets(sorted)
        setError(null)
      })
      .catch(() => setError("No se pudo conectar con Scryfall"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = query.trim()
    ? sets.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.code.toLowerCase().includes(query.toLowerCase()))
    : sets

  const handleSelectSet = useCallback(async (set: ScryfallSet) => {
    setSelectedSet(set)
    setLoadingCards(true)
    try {
      // Build a search URI for the set — Scryfall search for all cards in set
      const searchUrl = `https://api.scryfall.com/cards/search?q=set:${set.code}&order=set&unique=cards`
      const cards = await fetchAllCardsInSet(searchUrl)

      // Scryfall doesn't expose quantities for precon sets, so default to 1 per unique card.
      // Commander precons typically have 1 of each card (99+commander = 100).
      const deckCards: PreconCard[] = cards.map((card) => ({ card, quantity: 1 }))
      onLoadDeck(deckCards)
    } catch {
      setError("No se pudieron cargar las cartas del mazo")
    } finally {
      setLoadingCards(false)
    }
  }, [onLoadDeck])

  const handleReset = useCallback(() => {
    setSelectedSet(null)
    setQuery("")
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // ── Selected set loading state ───────────────────────────────────────────
  if (loadingCards) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-accent-gold" />
        <p className="text-sm">Cargando cartas de <span className="font-semibold text-foreground">{selectedSet?.name}</span>…</p>
      </div>
    )
  }

  // ── Selected set confirmation ────────────────────────────────────────────
  if (selectedSet) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <BookOpen className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="font-bold text-sm text-foreground">{selectedSet.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{selectedSet.card_count} cartas cargadas</p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> Elegir otro mazo
        </button>
      </div>
    )
  }

  // ── Set browser ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      {/* Header */}
      <div className="shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">
          Mazos preconstruidos
        </p>
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar mazo…"
            className={cn(
              "w-full rounded-lg border border-input bg-surface-raised pl-8 pr-8 py-2 text-xs",
              "text-foreground placeholder:text-muted-foreground/50",
              "focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow",
            )}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Cargando sets…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 py-4 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground/60 py-4 text-center">
            No se encontraron mazos para "{query}"
          </p>
        )}

        {!loading && !error && filtered.map((set) => (
          <button
            key={set.code}
            onClick={() => handleSelectSet(set)}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors group",
              "hover:bg-surface-raised"
            )}
          >
            {/* Set icon */}
            <img
              src={set.icon_svg_uri}
              alt=""
              aria-hidden="true"
              className="shrink-0 h-5 w-5 opacity-50 group-hover:opacity-80 transition-opacity invert"
            />

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">{set.name}</p>
              <p className="text-[10px] text-muted-foreground/60 tabular-nums">
                {set.card_count} cartas
                {set.released_at ? ` · ${set.released_at.slice(0, 4)}` : ""}
              </p>
            </div>

            <ChevronRight className="shrink-0 h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-accent-gold transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
