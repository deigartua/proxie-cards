"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, ChevronDown, ChevronRight, Plus, Check, ExternalLink, ArrowLeft, X, Package, BookOpen, LayoutList, Layers, ShoppingCart, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ScryfallCard, ScryfallSearchResponse, DeckItem } from "@/types/scryfall"
import { usePrintStore, SINGLES_DECK_ID } from "@/providers/print-store-provider"
import { Navbar } from "@/components/navbar"

// ── Stacked card layout constants (identical to precons) ─────────────────────
const CARD_HEIGHT   = 300
const STRIP_HEIGHT  = 40
const PUSH_DOWN     = CARD_HEIGHT - STRIP_HEIGHT

function getCardImage(card: ScryfallCard): string | null {
  return (
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal ??
    card.image_uris?.large ??
    null
  )
}

// Fetches EVERY card in a set by walking Scryfall's pagination (`next_page`)
// to completion, independent of whatever has been manually loaded into the
// browsing UI so far. A short delay between requests keeps us well under
// Scryfall's rate limits instead of firing pages back-to-back.
async function fetchAllCardsForSet(searchUrl: string): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = []
  let url: string | null = searchUrl
  let first = true
  while (url) {
    if (!first) await new Promise(r => setTimeout(r, 120))
    first = false
    const res = await fetch(url)
    if (!res.ok) break
    const data: ScryfallSearchResponse = await res.json()
    cards.push(...(data.data ?? []))
    url = data.has_more ? (data.next_page ?? null) : null
  }
  return cards
}

const CARD_TYPE_GROUPS_SETS = [
  { key: "Creature",    label: "Criaturas",      match: (t: string) => t.includes("Creature") },
  { key: "Instant",     label: "Hechizos",       match: (t: string) => t.includes("Instant") || t.includes("Sorcery") },
  { key: "Artifact",    label: "Artefactos",     match: (t: string) => t.includes("Artifact") },
  { key: "Enchantment", label: "Encantamientos", match: (t: string) => t.includes("Enchantment") },
  { key: "Planeswalker",label: "Planeswalkers",  match: (t: string) => t.includes("Planeswalker") },
  { key: "Land",        label: "Tierras",        match: (t: string) => t.includes("Land") },
  { key: "Other",       label: "Otros",          match: () => true },
]

function groupByType(cards: ScryfallCard[]) {
  const buckets = new Map<string, ScryfallCard[]>()
  CARD_TYPE_GROUPS_SETS.forEach(g => buckets.set(g.key, []))
  for (const card of cards) {
    const t = card.type_line ?? ""
    const g = CARD_TYPE_GROUPS_SETS.find(g => g.match(t))
    buckets.get(g?.key ?? "Other")!.push(card)
  }
  return CARD_TYPE_GROUPS_SETS
    .map(g => ({ group: g, cards: buckets.get(g.key)! }))
    .filter(({ cards }) => cards.length > 0)
}

// ── Scryfall set types we care about (matching Scryfall taxonomy) ────────────
interface ScryfallSet {
  id: string
  code: string
  name: string
  set_type: string
  released_at: string
  card_count: number
  icon_svg_uri: string
  search_uri: string
  scryfall_uri: string
}

interface ScryfallSetsResponse {
  object: "list"
  data: ScryfallSet[]
}

// Set type groupings (matching Scryfall's own categories)
const SET_TYPE_LABELS: Record<string, string> = {
  core:          "Ediciones Base",
  expansion:     "Expansiones",
  masters:       "Masters",
  draft_innovation: "Draft Innovation",
  commander:     "Commander",
  planechase:    "Planechase",
  archenemy:     "Archenemy",
  memorabilia:   "Memorabilia",
  funny:         "Un-Sets",
  starter:       "Starter",
  box:           "Box Sets",
  promo:         "Promos",
  token:         "Tokens",
  alchemy:       "Alchemy",
  treasure_chest:"Treasure Chest",
  minigame:      "Mini Game",
  spellbook:     "Spellbook",
}

const BROWSEABLE_TYPES = new Set([
  "core", "expansion", "masters", "commander", "draft_innovation",
  "planechase", "archenemy", "funny", "starter", "box",
])

const RARITY_ORDER = ["common", "uncommon", "rare", "mythic", "special", "bonus"]
const RARITY_COLOR: Record<string, string> = {
  common:   "text-white/50",
  uncommon: "text-slate-300",
  rare:     "text-yellow-300",
  mythic:   "text-orange-400",
  special:  "text-purple-400",
  bonus:    "text-pink-400",
}

// ── Card detail mini popup ───────────────────────────────────────────────────
// ── Deck picker popover (Pinterest-style) ────────────────────────────────────

function DeckIcon({ type }: { type: DeckItem["type"] }) {
  if (type === "singles") return <Package className="h-3 w-3 shrink-0" />
  if (type === "precon" || type === "set") return <LayoutList className="h-3 w-3 shrink-0" />
  return <BookOpen className="h-3 w-3 shrink-0" />
}

function CardAddWithPicker({ card, added }: { card: ScryfallCard; added: boolean }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { addSingleCard, addCardToDeck, cartDecks } = usePrintStore()

  // Close on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [pickerOpen])

  if (added) {
    return (
      <div className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md">
        <Check className="h-3 w-3" />
      </div>
    )
  }

  // Non-singles decks (available targets beyond the default singles bucket)
  const otherDecks = cartDecks.filter(d => d.type !== "singles")
  const singlesExist = cartDecks.some(d => d.id === SINGLES_DECK_ID)

  return (
    <div ref={ref} className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Main add-to-singles button */}
      <div className="flex items-stretch rounded-full overflow-hidden shadow-md">
        <button
          onClick={() => { addSingleCard(card, 1) }}
          className="h-6 pl-2 pr-1.5 flex items-center gap-1 bg-accent-blue text-white text-[10px] font-bold hover:bg-accent-blue/90 transition-colors whitespace-nowrap"
          title="Agregar a Singles"
        >
          <Plus className="h-3 w-3 shrink-0" />
          Singles
        </button>
        {/* Expander chevron */}
        <button
          onClick={e => { e.stopPropagation(); setPickerOpen(v => !v) }}
          className="h-6 px-1.5 bg-accent-blue/80 hover:bg-accent-blue text-white transition-colors border-l border-white/20"
          title="Elegir mazo"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", pickerOpen && "rotate-180")} />
        </button>
      </div>

      {/* Picker dropdown */}
      {pickerOpen && (
        <div className="absolute right-0 top-7 w-44 rounded-xl border border-border bg-surface shadow-xl overflow-hidden z-20">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-3 pt-2.5 pb-1">Agregar a...</p>
          {/* Singles default */}
          <button
            onClick={() => { addSingleCard(card, 1); setPickerOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface-raised transition-colors text-left"
          >
            <Package className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">Singles {!singlesExist && <span className="text-muted-foreground/50">(nuevo)</span>}</span>
          </button>
          {/* Other decks */}
          {otherDecks.map(deck => (
            <button
              key={deck.id}
              onClick={() => { addCardToDeck(deck.id, card, 1); setPickerOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface-raised transition-colors text-left"
            >
              <DeckIcon type={deck.type} />
              <span className="truncate">{deck.name}</span>
            </button>
          ))}
          {otherDecks.length === 0 && (
            <p className="px-3 pb-2.5 text-[10px] text-muted-foreground/40">No hay otros mazos</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stacked card components (same system as precons) ─────────────────────────

function SetStackedCard({
  card,
  addedIds,
  stackIndex,
  isHovered,
  isTopCard,
  pushDown,
  onHoverEnter,
  onHoverLeave,
  onClick,
}: {
  card: ScryfallCard
  addedIds: Set<string>
  stackIndex: number
  isHovered: boolean
  isTopCard: boolean
  pushDown: boolean
  onHoverEnter: () => void
  onHoverLeave: () => void
  onClick: () => void
}) {
  const art = getCardImage(card)
  const inDeck = addedIds.has(card.oracle_id ?? card.name)
  const top = stackIndex * STRIP_HEIGHT + (pushDown ? PUSH_DOWN : 0)

  return (
    <div
      className="group absolute left-0 right-0 cursor-pointer transition-all duration-300"
      style={{
        top: `${top}px`,
        height: `${CARD_HEIGHT}px`,
        zIndex: isHovered ? 50 : stackIndex + 1,
        clipPath: isTopCard || isHovered
          ? "none"
          : `inset(0 0 ${PUSH_DOWN}px 0 round 8px)`,
      }}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onClick={onClick}
      draggable
      onDragStart={e => {
        e.stopPropagation()
        e.dataTransfer.setData("application/x-mtg-card", JSON.stringify(card))
        e.dataTransfer.effectAllowed = "copy"
      }}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      aria-label={card.name}
    >
      <div className={cn(
        "w-full h-full rounded-lg border shadow-lg overflow-hidden",
        "transition-[box-shadow,border-color,filter] duration-300 ease-out",
        "border-border/50",
        isHovered && "shadow-2xl border-accent-blue/60 brightness-110"
      )}>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt={card.name} className="w-full h-full object-cover object-[center_15%]" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-surface-raised flex items-start p-2 pt-3">
            <span className="text-[9px] font-medium text-foreground leading-tight">{card.name}</span>
          </div>
        )}
        {inDeck && (
          <div className="absolute top-2 right-2 rounded-full bg-green-500 p-0.5">
            <Check className="h-2 w-2 text-white" />
          </div>
        )}
        {/* Add to deckbox picker — reuse sets CardAddWithPicker */}
        <CardAddWithPicker card={card} added={inDeck} />
      </div>
    </div>
  )
}

function SetStackedColumn({
  cards,
  addedIds,
  onCardClick,
}: {
  cards: ScryfallCard[]
  addedIds: Set<string>
  onCardClick: (card: ScryfallCard) => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const canExpand = cards.length > 1
  const colHeight = CARD_HEIGHT + (cards.length - 1) * STRIP_HEIGHT + (canExpand && hoveredIndex !== null ? PUSH_DOWN : 0)

  return (
    <div className="relative transition-all duration-300" style={{ height: `${colHeight}px` }}>
      {cards.map((card, idx) => (
        <SetStackedCard
          key={`${card.id}-${idx}`}
          card={card}
          addedIds={addedIds}
          stackIndex={idx}
          isHovered={canExpand && hoveredIndex === idx}
          isTopCard={idx === cards.length - 1}
          pushDown={canExpand && hoveredIndex !== null && idx > hoveredIndex}
          onHoverEnter={() => canExpand && setHoveredIndex(idx)}
          onHoverLeave={() => canExpand && setHoveredIndex(null)}
          onClick={() => onCardClick(card)}
        />
      ))}
    </div>
  )
}

// ── Set detail view (stacked columns) ────────────────────────────────────────
function SetDetailView({
  set,
  onBack,
  onAddCard,
  addedIds,
  addPreconToCart,
}: {
  set: ScryfallSet
  onBack: () => void
  onAddCard: (card: ScryfallCard) => void
  addedIds: Set<string>
  addPreconToCart: (name: string, entries: DeckItem["entries"], cover?: ScryfallCard) => void
}) {
  const [cards, setCards] = useState<ScryfallCard[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [nextPage, setNextPage] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState("")
  const [addingAll, setAddingAll] = useState(false)
  const [addedAll, setAddedAll] = useState(false)

  useEffect(() => {
    setLoading(true)
    setCards([])
    const url = `https://api.scryfall.com/cards/search?q=set%3A${set.code}+unique%3Aprints&order=set&include_multilingual=false`
    fetch(url)
      .then(r => r.json())
      .then((data: ScryfallSearchResponse) => {
        setCards(data.data ?? [])
        setHasMore(data.has_more)
        setNextPage(data.next_page ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [set.code])

  const loadMore = useCallback(() => {
    if (!nextPage || loadingMore) return
    setLoadingMore(true)
    fetch(nextPage)
      .then(r => r.json())
      .then((data: ScryfallSearchResponse) => {
        setCards(prev => [...prev, ...(data.data ?? [])])
        setHasMore(data.has_more)
        setNextPage(data.next_page ?? null)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [nextPage, loadingMore])

  const filtered = cards.filter(c =>
    !filter || c.name.toLowerCase().includes(filter.toLowerCase())
  )

  // Group by card type (same as precons)
  const byType = groupByType(filtered)

  // "Add whole set" handler — reuses whatever's already loaded, then walks the
  // rest of Scryfall's pagination to completion before adding, regardless of
  // how much the user has scrolled/loaded in the browser above. This is what
  // fixes sets getting added as a partial 175-card slice.
  async function handleAddAll() {
    if (!cards.length) return
    setAddingAll(true)
    try {
      const remaining = hasMore && nextPage ? await fetchAllCardsForSet(nextPage) : []
      const allCards = [...cards, ...remaining]
      const entries = allCards.map(c => ({
        id: c.oracle_id ?? c.name,
        card: c,
        quantity: 1,
      }))
      addPreconToCart(`Set: ${set.name}`, entries, allCards[0])
      setAddedAll(true)
      setTimeout(() => setAddedAll(false), 3000)
    } finally {
      setAddingAll(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Set header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> Volver a todos los sets
        </button>
        <div className="flex items-start gap-4">
          {/* Set icon */}
          <div className="shrink-0 h-12 w-12 rounded-xl bg-surface-raised border border-border flex items-center justify-center overflow-hidden">
            <img
              src={set.icon_svg_uri}
              alt={set.name}
              className="h-8 w-8 object-contain invert opacity-80"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{set.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-md bg-surface-raised border border-border text-muted-foreground font-mono uppercase">{set.code}</span>
              <a
                href={set.scryfall_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-blue hover:underline flex items-center gap-0.5"
              >
                <ExternalLink className="h-3 w-3" /> Ver en Scryfall
              </a>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{new Date(set.released_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}</span>
              <span>·</span>
              <span>{cards.length} / {set.card_count} cartas cargadas</span>
            </div>
          </div>
        </div>

        {/* Search + add-all */}
        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar en el set..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface rounded-lg border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-blue/50"
            />
          </div>
          <button
            onClick={handleAddAll}
            disabled={addingAll || !cards.length}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap",
              addedAll
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : "bg-accent-blue/10 border-accent-blue/30 text-accent-blue hover:bg-accent-blue hover:text-white hover:border-accent-blue disabled:opacity-40"
            )}
          >
            {addedAll ? (
              <><Check className="h-3 w-3" /> Agregado</>
            ) : addingAll ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Cargando cartas...</>
            ) : (
              <><ShoppingCart className="h-3 w-3" /> Agregar set</>
            )}
          </button>
        </div>
      </div>

      {/* Stacked columns by card type — same layout as precons */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 rounded-full border-2 border-accent-blue/30 border-t-accent-blue animate-spin" />
          </div>
        ) : (
          <div className="space-y-10">
            {byType.map(({ group, cards: groupCards }) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">· {groupCards.length} cartas</span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
                <div className="flex flex-wrap gap-3">
                  {groupCards.map(card => (
                    <div key={card.id} style={{ width: `${CARD_HEIGHT * 0.72}px` }}>
                      <SetStackedColumn
                        cards={[card]}
                        addedIds={addedIds}
                        onCardClick={onAddCard}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-accent-blue/40 transition-colors flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <span className="h-4 w-4 rounded-full border-2 border-accent-blue/30 border-t-accent-blue animate-spin" />
                ) : (
                  "Cargar mas cartas"
                )}
              </button>
            )}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No se encontraron cartas con ese filtro
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Set type label helpers ────────────────────────────────────────────────────
const SET_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  commander:        { label: "Commander",  cls: "bg-accent-gold/20 text-accent-gold border-accent-gold/30" },
  expansion:        { label: "Expansión",  cls: "bg-accent-blue/20 text-accent-blue border-accent-blue/30" },
  core:             { label: "Base",       cls: "bg-surface-raised text-muted-foreground border-border" },
  masters:          { label: "Masters",    cls: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  draft_innovation: { label: "Draft",      cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  box:              { label: "Box Set",    cls: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  funny:            { label: "Un-Set",     cls: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  starter:          { label: "Starter",    cls: "bg-surface-raised text-muted-foreground border-border" },
  planechase:       { label: "Planechase", cls: "bg-surface-raised text-muted-foreground border-border" },
  archenemy:        { label: "Archenemy",  cls: "bg-surface-raised text-muted-foreground border-border" },
}

// ── Visual set card (precon-style) ────────────────────────────────────────────
function SetVisualCard({ set, onSelect }: { set: ScryfallSet; onSelect: (s: ScryfallSet) => void }) {
  const [artUrl, setArtUrl] = useState<string | null>(null)
  const [miniCards, setMiniCards] = useState<string[]>([])

  // Fetch a handful of card art crops to use as background
  useEffect(() => {
    let cancelled = false
    // Try to get the first rare/mythic art crops for visual richness
    fetch(`https://api.scryfall.com/cards/search?q=set%3A${set.code}+rarity%3Ar&order=set&unique=art`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.data?.length) {
          // Fallback: any card in the set
          return fetch(`https://api.scryfall.com/cards/search?q=set%3A${set.code}&order=set`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (!cancelled && d?.data?.length) {
                const crops = (d.data as ScryfallCard[])
                  .slice(0, 6)
                  .map(c => c.image_uris?.art_crop ?? c.card_faces?.[0]?.image_uris?.art_crop)
                  .filter(Boolean) as string[]
                if (crops.length) {
                  setArtUrl(crops[0])
                  setMiniCards(crops.slice(1, 4))
                }
              }
            })
        }
        if (!cancelled && data.data.length) {
          const crops = (data.data as ScryfallCard[])
            .slice(0, 6)
            .map((c: ScryfallCard) => c.image_uris?.art_crop ?? c.card_faces?.[0]?.image_uris?.art_crop)
            .filter(Boolean) as string[]
          if (crops.length) {
            setArtUrl(crops[0])
            setMiniCards(crops.slice(1, 4))
          }
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [set.code])

  const badge = SET_TYPE_BADGE[set.set_type]

  return (
    <button
      onClick={() => onSelect(set)}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData("application/x-mtg-set", JSON.stringify({ code: set.code, name: set.name, card_count: set.card_count }))
        e.dataTransfer.effectAllowed = "copy"
      }}
      className="group relative rounded-2xl overflow-hidden border border-border/40 bg-surface hover:border-accent-blue/40 transition-all duration-300 hover:shadow-2xl hover:shadow-accent-blue/10 text-left cursor-grab active:cursor-grabbing"
      style={{ aspectRatio: "3/2" }}
    >
      {/* Background art */}
      {artUrl ? (
        <img
          src={artUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-surface-raised" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />

      {/* Mini card thumbnails top-right */}
      {miniCards.length > 0 && (
        <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          {miniCards.map((src, i) => (
            <div
              key={i}
              className="w-7 h-10 rounded-md overflow-hidden border border-white/20 shadow-lg"
              style={{ transform: `rotate(${i % 2 === 0 ? "-3" : "3"}deg)` }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Set icon + type badge top-left */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
        <div className="h-6 w-6 rounded-md bg-black/60 border border-white/10 flex items-center justify-center backdrop-blur-sm">
          <img src={set.icon_svg_uri} alt="" className="h-4 w-4 object-contain invert opacity-90" />
        </div>
        {badge && (
          <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border backdrop-blur-sm", badge.cls)}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-6">
        <p className="text-white font-bold text-sm leading-tight text-balance line-clamp-2 group-hover:text-accent-blue/90 transition-colors">
          {set.name}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-mono uppercase text-white/40">{set.code}</span>
          <span className="text-[10px] text-white/30">·</span>
          <span className="text-[10px] text-white/50">{set.card_count} cartas</span>
          <span className="text-[10px] text-white/30">·</span>
          <span className="text-[10px] text-white/40">
            {new Date(set.released_at).toLocaleDateString("es-AR", { month: "short", year: "numeric" })}
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Current year visual grid ──────────────────────────────────────────────────
function CurrentYearSection({
  year,
  sets,
  onSelect,
}: {
  year: string
  sets: ScryfallSet[]
  onSelect: (s: ScryfallSet) => void
}) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-2xl font-black text-foreground">{year}</h2>
        <span className="text-sm text-muted-foreground">{sets.length} sets</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent-blue/70 border border-accent-blue/30 rounded-full px-2 py-0.5">
          Recientes
        </span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {sets.map(set => (
          <SetVisualCard key={set.id} set={set} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

// ── Compact year group (older years) ─────────────────────────────────────────
function YearGroup({
  year,
  sets,
  onSelect,
  defaultOpen,
}: {
  year: string
  sets: ScryfallSet[]
  onSelect: (s: ScryfallSet) => void
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-surface hover:bg-surface-raised transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground">{year}</span>
          <span className="text-xs text-muted-foreground">{sets.length} set{sets.length !== 1 ? "s" : ""}</span>
        </div>
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-90")} />
      </button>

      {open && (
        <div className="px-4 py-3 bg-background grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
          {sets.map(set => {
            const badge = SET_TYPE_BADGE[set.set_type]
            return (
              <button
                key={set.id}
                onClick={() => onSelect(set)}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData("application/x-mtg-set", JSON.stringify({ code: set.code, name: set.name, card_count: set.card_count }))
                  e.dataTransfer.effectAllowed = "copy"
                }}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-surface hover:bg-surface-raised hover:border-accent-blue/40 transition-all text-left group cursor-grab active:cursor-grabbing"
              >
                <div className="shrink-0 h-9 w-9 rounded-lg bg-surface-raised border border-border/50 flex items-center justify-center overflow-hidden">
                  <img src={set.icon_svg_uri} alt="" className="h-5 w-5 object-contain invert opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate group-hover:text-accent-blue transition-colors leading-tight">
                    {set.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {badge && (
                      <span className={cn("text-[9px] font-bold uppercase tracking-wide px-1 py-px rounded border", badge.cls)}>
                        {badge.label}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 font-mono uppercase">{set.code}</span>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <span className="text-[10px] text-muted-foreground/60">{set.card_count}c</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SetsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SetsPageInner />
    </Suspense>
  )
}

function SetsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addSingleCard, addPreconToCart, cartDecks } = usePrintStore()

  const [allSets, setAllSets]         = useState<ScryfallSet[]>([])
  const [loading, setLoading]         = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter]   = useState<string>(
    () => searchParams.get("type") ?? "all"
  )
  const [selectedSet, setSelectedSet] = useState<ScryfallSet | null>(null)
  const [addedIds, setAddedIds]       = useState<Set<string>>(new Set())
  const [showDeckHint, setShowDeckHint] = useState(false)
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync typeFilter when URL ?type= changes (navbar links)
  useEffect(() => {
    const t = searchParams.get("type") ?? "all"
    setTypeFilter(t)
  }, [searchParams])

  // Load all sets from Scryfall
  useEffect(() => {
    fetch("https://api.scryfall.com/sets")
      .then(r => r.json())
      .then((data: ScryfallSetsResponse) => {
        // Filter to browseable sets with a release date
        const filtered = data.data.filter(s =>
          s.released_at && BROWSEABLE_TYPES.has(s.set_type)
        )
        setAllSets(filtered)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Auto-open a set when ?set=CODE is in the URL (e.g. from navbar links)
  useEffect(() => {
    if (allSets.length === 0) return
    const code = searchParams.get("set")
    if (!code) return
    const found = allSets.find(s => s.code.toLowerCase() === code.toLowerCase())
    if (found) setSelectedSet(found)
  }, [allSets, searchParams])

  // Track which card oracle_ids are already in any cart deck (singles or otherwise)
  useEffect(() => {
    const ids = new Set<string>()
    cartDecks.forEach(d => d.entries.forEach(e => ids.add(e.id)))
    setAddedIds(ids)
  }, [cartDecks])

  const handleAddCard = useCallback((card: ScryfallCard) => {
    addSingleCard(card, 1)
    const id = card.oracle_id ?? card.name
    setAddedIds(prev => new Set([...prev, id]))
    setShowDeckHint(true)
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
    hintTimeoutRef.current = setTimeout(() => setShowDeckHint(false), 3000)
  }, [addSingleCard])

  // Filter + search sets
  const displaySets = allSets.filter(s => {
    const matchType = typeFilter === "all" || s.set_type === typeFilter
    const matchSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase())
    return matchType && matchSearch
  })

  // Group by year, sorted within each year by released_at descending (newest first)
  const byYear = displaySets.reduce<Record<string, ScryfallSet[]>>((acc, s) => {
    const year = s.released_at.slice(0, 4)
    ;(acc[year] ??= []).push(s)
    return acc
  }, {})
  // Sort sets within each year by released_at descending
  Object.values(byYear).forEach(arr =>
    arr.sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime())
  )
  const sortedYears = Object.keys(byYear).sort((a, b) => Number(b) - Number(a))

  // Available set types for filter tabs
  const availableTypes = [...new Set(allSets.map(s => s.set_type))].filter(t => BROWSEABLE_TYPES.has(t))

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {selectedSet ? (
        /* ── Set detail view ── */
        <div className="flex-1 max-w-7xl mx-auto w-full">
          <SetDetailView
            set={selectedSet}
            onBack={() => setSelectedSet(null)}
            onAddCard={handleAddCard}
            addedIds={addedIds}
            addPreconToCart={addPreconToCart}
          />
        </div>
      ) : (
        /* ── Sets browser ── */
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
          {/* Page title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Sets de Magic</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Explorá los sets de Magic: The Gathering y agregá cartas a tu mazo de singles
            </p>
          </div>

          {/* Search + type filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar set por nombre o código..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-surface rounded-xl border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => { setTypeFilter("all"); router.replace("/sets", { scroll: false }) }}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-bold border transition-colors",
                  typeFilter === "all"
                    ? "bg-accent-blue border-accent-blue text-white"
                    : "bg-surface border-border text-muted-foreground hover:border-accent-blue/30 hover:text-foreground"
                )}
              >
                Todos
              </button>
              {availableTypes.map(t => (
                <button
                  key={t}
                  onClick={() => { setTypeFilter(t); router.replace(`/sets?type=${encodeURIComponent(t)}`, { scroll: false }) }}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-bold border transition-colors",
                    typeFilter === t
                      ? "bg-accent-blue border-accent-blue text-white"
                      : "bg-surface border-border text-muted-foreground hover:border-accent-blue/30 hover:text-foreground"
                  )}
                >
                  {SET_TYPE_LABELS[t] ?? t}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-accent-blue/30 border-t-accent-blue animate-spin" />
                <p className="text-sm text-muted-foreground">Cargando sets desde Scryfall...</p>
              </div>
            </div>
          ) : sortedYears.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No se encontraron sets con esa busqueda
            </div>
          ) : (
            <div>
              {/* Current (newest) year as visual card grid */}
              {sortedYears[0] && (
                <CurrentYearSection
                  key={`${typeFilter}-${searchQuery}-${sortedYears[0]}`}
                  year={sortedYears[0]}
                  sets={byYear[sortedYears[0]]}
                  onSelect={setSelectedSet}
                />
              )}
              {/* Older years as compact collapsible rows */}
              {sortedYears.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Anos anteriores</p>
                  {sortedYears.slice(1).map(year => (
                    <YearGroup
                      key={`${typeFilter}-${searchQuery}-${year}`}
                      year={year}
                      sets={byYear[year]}
                      onSelect={setSelectedSet}
                      defaultOpen={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* Toast notification when card is added */}
      {showDeckHint && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-raised border border-accent-blue/40 shadow-xl text-sm text-foreground animate-card-in">
          <Check className="h-4 w-4 text-accent-blue" />
          Carta agregada a Singles
          <Link href="/deckbox" className="text-accent-blue font-bold hover:underline ml-1">
            Ver deckbox →
          </Link>
        </div>
      )}
    </div>
  )
}
