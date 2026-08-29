"use client"

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search,
  X,
  Layers,
  Loader2,
  AlertCircle,
  Plus,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  SlidersHorizontal,
  Check,
  FileUp,
  LayoutGrid,
  List,
  Rows3,
  Calendar,
  Hash,
  Sword,
  Package,
  BookOpen as BookOpenIcon,
  LayoutList,
} from "lucide-react"
import { usePrintStore, SINGLES_DECK_ID, SINGLES_DECK_NAME } from "@/providers/print-store-provider"
import { useDeckbox } from "@/providers/deckbox-provider"
import { CardDetailModal } from "@/components/card-detail-modal"
import { ImportDeckModal } from "@/components/import-deck-modal"
import { Navbar } from "@/components/navbar"
import { looksLikeDeckList } from "@/lib/deck-import"
import { cn } from "@/lib/utils"
import { fetchDecksMetadata, fetchCardsForDeck } from "@/lib/deck-utils"
import type { DeckCard, DeckMetadata } from "@/lib/deck-utils"
import type { ScryfallCard, DeckItem } from "@/types/scryfall"

// ── Card type grouping ────────────────────────────────────────────────────────

const CARD_TYPE_GROUPS = [
  { key: "Commander",      label: "Commander",     match: (t: string) => t.includes("Commander") || false },
  { key: "Planeswalker",   label: "Planeswalkers", match: (t: string) => t.includes("Planeswalker") },
  { key: "Creature",       label: "Criaturas",     match: (t: string) => t.includes("Creature") },
  { key: "Instant",        label: "Hechizos",      match: (t: string) => t.includes("Instant") || t.includes("Sorcery") },
  { key: "Artifact",       label: "Artefactos",    match: (t: string) => t.includes("Artifact") },
  { key: "Enchantment",    label: "Encantamientos",match: (t: string) => t.includes("Enchantment") },
  { key: "Land",           label: "Tierras",       match: (t: string) => t.includes("Land") },
  { key: "Other",          label: "Otros",         match: () => true },
]

function groupCardsByType(cards: ScryfallCard[]): { group: typeof CARD_TYPE_GROUPS[0]; cards: ScryfallCard[] }[] {
  const buckets = new Map<string, ScryfallCard[]>()
  CARD_TYPE_GROUPS.forEach(g => buckets.set(g.key, []))

  for (const card of cards) {
    const typeLine = card.type_line ?? ""
    const isCommander = (card as any).isCommander
    if (isCommander) {
      buckets.get("Commander")!.push(card)
      continue
    }
    const group = CARD_TYPE_GROUPS.slice(1).find(g => g.match(typeLine))
    buckets.get(group?.key ?? "Other")!.push(card)
  }

  return CARD_TYPE_GROUPS
    .map(g => ({ group: g, cards: buckets.get(g.key)! }))
    .filter(({ cards }) => cards.length > 0)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = [
  { id: "W", label: "Blanco", symbol: "☀", hex: "#f9faf4" },
  { id: "U", label: "Azul",   symbol: "💧", hex: "#aae0fa" },
  { id: "B", label: "Negro",  symbol: "💀", hex: "#cbc2bf" },
  { id: "R", label: "Rojo",   symbol: "🔥", hex: "#f9aa8f" },
  { id: "G", label: "Verde",  symbol: "🌲", hex: "#9bd3ae" },
]

const COLOR_DOT: Record<string, string> = {
  W: "bg-[#f0ede0] border border-[#c8c0a0]",
  U: "bg-[#aae0fa] border border-[#5baad4]",
  B: "bg-[#333] border border-[#666]",
  R: "bg-[#e67c5a] border border-[#c04030]",
  G: "bg-[#5ca85c] border border-[#3a7a3a]",
}

// ── Curated type groups (Gemini recommendation) ──────────────────────────────

// Types to hide — MTGO digital, Arena-only, and freebie sample decks
const HIDDEN_TYPES = new Set([
  "MTGO Commander Deck",
  "MTGO Duel Deck",
  "MTGO Redemption",
  "MTGO Theme Deck",
  "MTGO Event Deck",
  "Historic Brawl Precon Deck",
  "Sample Deck",
  "Demo Deck",
  "Welcome Deck",
  "Welcome Booster",
])

interface TypeGroup {
  label: string
  types: string[]
  defaultOpen: boolean
}

const TYPE_GROUPS: TypeGroup[] = [
  {
    label: "Commander",
    types: ["Commander Deck"],
    defaultOpen: true,
  },
  {
    label: "Standard",
    types: ["Starter Kit", "Arena Starter Kit", "Challenger Deck", "Event Deck"],
    defaultOpen: false,
  },
  {
    label: "Pioneer",
    types: ["Pioneer Challenger Deck"],
    defaultOpen: false,
  },
  {
    label: "Modern",
    types: ["Modern Event Deck"],
    defaultOpen: false,
  },
  {
    label: "Brawl / Historic",
    types: ["Brawl Deck", "Historic Brawl Deck"],
    defaultOpen: false,
  },
  {
    label: "Pauper",
    types: ["Pauper Deck"],
    defaultOpen: false,
  },
  {
    label: "Otros",
    types: [
      "Secret Lair Drop",
      "World Championship Deck",
      "Pro Tour Deck",
      "Duel Deck",
      "Planechase Deck",
      "Archenemy Deck",
      "Jumpstart",
      "Game Night Deck",
      "Dandan Deck",
      "Box Set",
      "Theme Deck",
      "Intro Pack",
      "Guild Kit",
      "Planeswalker Deck",
    ],
    defaultOpen: false,
  },
]

const PAGE_SIZE = 40

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSetIconUrl(code: string) {
  return `https://svgs.scryfall.io/card-symbols/sets/${code.toLowerCase()}.svg`
}

function formatDate(date: string | null) {
  if (!date) return null
  const d = new Date(date)
  return d.toLocaleDateString("es-AR", { year: "numeric", month: "short" })
}



function getCardImage(card: ScryfallCard) {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal
}

function getArtCrop(card: ScryfallCard) {
  return card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop
}

function getCommanderArtUrl(scryfallId: string | null) {
  if (!scryfallId) return null
  // Scryfall image CDN: /cards/{id}?version=art_crop
  return `https://cards.scryfall.io/art_crop/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`
}

// ── Color pip component ───────────────────────────────────────────────────────

function ColorPips({ colors }: { colors: string[] }) {
  if (!colors.length) return <span className="text-[10px] text-muted-foreground">Sin color</span>
  return (
    <div className="flex items-center gap-0.5">
      {colors.map(c => (
        <span key={c} className={cn("inline-block w-3.5 h-3.5 rounded-full", COLOR_DOT[c] || "bg-muted")} title={c} />
      ))}
    </div>
  )
}

// ── Stacked card constants ────────────────────────────────────────────────────
const CARD_HEIGHT = 300  // full card height in px (increased for better visibility)
const STRIP_HEIGHT = 40  // visible strip height per card when collapsed
const PUSH_DOWN = CARD_HEIGHT - STRIP_HEIGHT  // extra offset for cards below hovered

// Smaller version for grid columns
const CARD_HEIGHT_COMPACT = 220
const STRIP_HEIGHT_COMPACT = 30
const PUSH_DOWN_COMPACT = CARD_HEIGHT_COMPACT - STRIP_HEIGHT_COMPACT

// ── Flat card (search results) ────────────────────────────────────────────────

interface FlatCardProps {
  card: ScryfallCard
  inDeck: boolean
  onClick: () => void
}

function FlatCard({ card, inDeck, onClick }: FlatCardProps) {
  const art = getCardImage(card)
  const isCommander = (card as any).isCommander
  const qty = (card as any).quantity || 1
  return (
    <div
      className={cn(
        "relative aspect-[5/7] rounded-lg overflow-hidden border shadow-sm cursor-pointer transition-all duration-200 hover:scale-105 hover:z-10",
        isCommander ? "border-accent-gold/60 ring-1 ring-accent-gold/40" : "border-border/40",
        "hover:shadow-lg hover:border-accent-gold/40"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      aria-label={card.name}
    >
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-surface flex items-center justify-center p-2">
          <span className="text-[9px] font-medium text-center text-muted-foreground leading-tight">{card.name}</span>
        </div>
      )}
      {isCommander && (
        <div className="absolute top-1 left-1 text-[8px] font-bold px-1.5 py-0.5 bg-accent-gold/90 text-white rounded-md">CMD</div>
      )}
      {qty > 1 && (
        <div className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 bg-black/70 text-white rounded-md">x{qty}</div>
      )}
      {inDeck && (
        <div className="absolute top-1 right-1 rounded-full bg-accent-gold/90 p-0.5">
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </div>
  )
}

// ── Pinterest-style deck picker for individual cards ──────────────────────────

function PreconCardAddPicker({ card }: { card: ScryfallCard }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { addSingleCard, addCardToDeck, cartDecks } = usePrintStore()
  const { lastDeckId, setLastDeckId } = useDeckbox()

  const resolvedId = (lastDeckId && cartDecks.some(d => d.id === lastDeckId)) ? lastDeckId : null
  const targetDeck = resolvedId ? cartDecks.find(d => d.id === resolvedId) : null
  const targetName = targetDeck ? targetDeck.name : SINGLES_DECK_NAME

  useEffect(() => {
    if (!pickerOpen) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [pickerOpen])

  function handleAdd(deckId: string | null) {
    setPickerOpen(false)
    const target = deckId ?? SINGLES_DECK_ID
    if (target === SINGLES_DECK_ID) addSingleCard(card, 1)
    else addCardToDeck(target, card, 1)
    setLastDeckId(target)
  }

  const otherDecks = cartDecks.filter(d => d.type !== "singles")

  return (
    <div ref={ref} className="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="flex items-stretch rounded-full overflow-hidden shadow-lg">
        <button
          onClick={e => { e.stopPropagation(); handleAdd(resolvedId) }}
          className="h-5 px-1.5 flex items-center gap-0.5 bg-accent-blue/95 text-white text-[9px] font-bold hover:bg-accent-blue transition-colors whitespace-nowrap"
          title={`Agregar a ${targetName}`}
        >
          <Plus className="h-2.5 w-2.5 shrink-0" />
          {targetName.length > 8 ? targetName.slice(0, 7) + "…" : targetName}
        </button>
        <button
          onClick={e => { e.stopPropagation(); setPickerOpen(v => !v) }}
          className="h-5 px-1 bg-accent-blue/80 hover:bg-accent-blue text-white transition-colors border-l border-white/20"
          title="Elegir mazo"
        >
          <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", pickerOpen && "rotate-180")} />
        </button>
      </div>

      {pickerOpen && (
        <div className="absolute right-0 top-6 w-40 rounded-xl border border-border bg-surface shadow-2xl overflow-hidden z-30">
          <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 pt-2 pb-1">Agregar a...</p>
          <button
            onClick={e => { e.stopPropagation(); handleAdd(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-foreground hover:bg-surface-raised transition-colors text-left"
          >
            <Package className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{SINGLES_DECK_NAME}</span>
          </button>
          {otherDecks.map(deck => (
            <button
              key={deck.id}
              onClick={e => { e.stopPropagation(); handleAdd(deck.id) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-foreground hover:bg-surface-raised transition-colors text-left"
            >
              <LayoutList className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate">{deck.name}</span>
            </button>
          ))}
          {cartDecks.length === 0 && (
            <p className="px-3 pb-2 text-[10px] text-muted-foreground/40">No hay mazos</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Single stacked card (controlled by parent column) ─────────────────────────

interface StackedCardProps {
  card: ScryfallCard
  inDeck: boolean
  stackIndex: number
  isHovered: boolean
  isTopCard: boolean
  pushDown: boolean
  cardHeight: number       // customizable card height
  stripHeight: number      // customizable strip height
  pushDownHeight: number   // customizable push-down offset
  onHoverEnter: () => void
  onHoverLeave: () => void
  onClick: () => void
}

function StackedCard({
  card, inDeck, stackIndex, isHovered, isTopCard, pushDown,
  cardHeight, stripHeight, pushDownHeight,
  onHoverEnter, onHoverLeave, onClick
}: StackedCardProps) {
  const art = getCardImage(card)
  const isCommander = (card as any).isCommander
  const qty = (card as any).quantity || 1

  const topBase = stackIndex * stripHeight
  const topOffset = pushDown ? pushDownHeight : 0
  const top = topBase + topOffset

  function handleDragStart(e: React.DragEvent) {
    e.stopPropagation()
    e.dataTransfer.setData("application/x-mtg-card", JSON.stringify(card))
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <div
      className="group absolute left-0 right-0 cursor-pointer transition-all duration-300"
      style={{
        top: `${top}px`,
        height: `${cardHeight}px`,
        zIndex: isHovered ? 50 : stackIndex + 1,
        clipPath: isTopCard || isHovered
          ? "none"
          : `inset(0 0 ${pushDownHeight}px 0 round 8px)`,
      }}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      aria-label={card.name}
    >
      <div
        className={cn(
          "w-full h-full rounded-lg border shadow-lg overflow-hidden",
          "transition-[box-shadow,border-color,filter] duration-300 ease-out",
          isCommander ? "border-accent-gold/70 ring-1 ring-accent-gold/40" : "border-border/50",
          isHovered && "shadow-2xl border-accent-gold/60 brightness-110"
        )}
      >
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            alt={card.name}
            className="w-full h-full object-cover object-[center_15%]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-surface-raised flex items-start justify-start p-2 pt-3">
            <span className="text-[9px] font-medium text-foreground leading-tight">{card.name}</span>
          </div>
        )}
        {qty > 1 && (
          <div className="absolute bottom-2 right-2 text-[9px] font-bold px-1.5 bg-black/75 text-white rounded-md">
            x{qty}
          </div>
        )}
        {inDeck && (
          <div className="absolute top-2 right-2 rounded-full bg-accent-gold/90 p-0.5">
            <Check className="h-2 w-2 text-white" />
          </div>
        )}
        {/* Add to deckbox picker */}
        <PreconCardAddPicker card={card} />
      </div>
    </div>
  )
}

// ── Column of stacked cards — owns hover state ────────────────────────────────

interface StackedColumnProps {
  cards: ScryfallCard[]
  deckIds: Set<string>
  onCardClick: (card: ScryfallCard) => void
  cardHeight?: number      // optional: defaults to CARD_HEIGHT
  stripHeight?: number     // optional: defaults to STRIP_HEIGHT
  pushDownHeight?: number  // optional: defaults to PUSH_DOWN
}

function StackedColumn({
  cards, deckIds, onCardClick,
  cardHeight = CARD_HEIGHT,
  stripHeight = STRIP_HEIGHT,
  pushDownHeight = PUSH_DOWN
}: StackedColumnProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  // Single-card columns (e.g. Commander) never need push-down expansion
  const canExpand = cards.length > 1

  // Height: base card + strips for remaining cards + extra room for push-down
  const colHeight = cardHeight + (cards.length - 1) * stripHeight + (canExpand && hoveredIndex !== null ? pushDownHeight : 0)

  return (
    <div className="relative transition-all duration-300" style={{ height: `${colHeight}px` }}>
      {cards.map((card, idx) => (
        <StackedCard
          key={`${card.id}-${idx}`}
          card={card}
          inDeck={deckIds.has(card.oracle_id ?? card.name)}
          stackIndex={idx}
          isHovered={canExpand && hoveredIndex === idx}
          isTopCard={idx === cards.length - 1}
          pushDown={canExpand && hoveredIndex !== null && idx > hoveredIndex}
          cardHeight={cardHeight}
          stripHeight={stripHeight}
          pushDownHeight={pushDownHeight}
          onHoverEnter={() => canExpand && setHoveredIndex(idx)}
          onHoverLeave={() => canExpand && setHoveredIndex(null)}
          onClick={() => onCardClick(card)}
        />
      ))}
    </div>
  )
}

// ── Deck card component ───────────────────────────────────────────────────────

function DeckCard({ deck, onClick }: { deck: DeckMetadata; onClick: () => void }) {
  const [iconError, setIconError] = useState(false)
  const [artError, setArtError] = useState(false)
  const iconCode = (deck.sourceSetCodes?.[0] || deck.code).toLowerCase()
  // Use commander art if available, otherwise use first card art
  const artUrl = getCommanderArtUrl(deck.commanderScryfallId ?? deck.firstCardScryfallId)

  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData("application/x-mtg-precon", JSON.stringify({ id: deck.id, name: deck.name, code: deck.code }))
        e.dataTransfer.effectAllowed = "copy"
      }}
      className="group w-full text-left bg-surface-raised border border-border rounded-xl overflow-hidden hover:border-accent-gold/60 hover:bg-surface transition-all duration-150 hover:shadow-lg hover:shadow-black/20 flex flex-col cursor-grab active:cursor-grabbing"
    >
      {/* Art banner (commander or first card) */}
      <div className="relative w-full h-24 bg-surface overflow-hidden shrink-0">
        {artUrl && !artError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={artUrl}
            alt={deck.commanderName ?? deck.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            onError={() => setArtError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-background flex items-center justify-center">
            <Layers className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        {/* Type badge top-right */}
        {deck.type && (
          <span className="absolute top-2 right-2 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/60 text-white/90 backdrop-blur-sm border border-white/10">
            {deck.type.replace(" Deck", "").replace(" Drop", "")}
          </span>
        )}
        {/* Set icon + code bottom-left over the art */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          {!iconError && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={getSetIconUrl(iconCode)}
              alt={deck.code}
              className="h-4 w-4 object-contain brightness-0 invert opacity-80"
              onError={() => setIconError(true)}
            />
          )}
          <span className="text-[10px] font-mono text-white/80 uppercase tracking-wide">{deck.code}</span>
          {deck.releaseDate && (
            <span className="text-[9px] text-white/50 ml-1">{formatDate(deck.releaseDate)}</span>
          )}
        </div>
      </div>

      {/* Info below art */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-accent-gold transition-colors line-clamp-2 text-balance">
            {deck.name}
          </h3>
          {deck.commanderName && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {deck.commanderName}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-border/40">
          <ColorPips colors={deck.colorIdentity} />
          <span className="text-[10px] text-muted-foreground font-medium">{deck.cardCount} cartas</span>
        </div>
      </div>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PreconsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PreconsPageInner />
    </Suspense>
  )
}

function PreconsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { entries, addCard, updatePrint, replaceAll, addPreconToCart, editPreconDeck, cartDecks } = usePrintStore()
  const deckIds = useMemo(
    () => new Set(entries.map(e => e.card.oracle_id ?? e.card.name)),
    [entries]
  )

  // ── Data ──
  const [decks, setDecks] = useState<DeckMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Import modal ──
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState("")

  function handleImport(cards: { card: ScryfallCard; quantity: number }[], replace: boolean) {
    if (replace) replaceAll(cards)
    else cards.forEach(({ card, quantity }) => addCard(card, quantity))
  }

  function handleSearchPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text")
    if (looksLikeDeckList(pasted)) {
      e.preventDefault()
      setImportText(pasted)
      setShowImport(true)
    }
  }

  // ── Filters ──
  const [query, setQuery] = useState("")
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  // Initialize from URL ?type= param, fall back to "Commander Deck"
  const [selectedType, setSelectedType] = useState<string>(
    () => searchParams.get("type") ?? "Commander Deck"
  )
  const [showFilters, setShowFilters] = useState(false)

  // ── Accordion open state — open the group matching the current type ──
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const typeFromUrl = searchParams.get("type") ?? "Commander Deck"
    const matchingGroup = TYPE_GROUPS.find(g => g.types.includes(typeFromUrl))
    const defaults = new Set(TYPE_GROUPS.filter(g => g.defaultOpen).map(g => g.label))
    if (matchingGroup) defaults.add(matchingGroup.label)
    return defaults
  })

  // Keep selectedType in sync when the URL changes (e.g. navbar link click)
  useEffect(() => {
    const typeFromUrl = searchParams.get("type")
    if (typeFromUrl && typeFromUrl !== selectedType) {
      setSelectedType(typeFromUrl)
      // Also open the accordion group for this type
      const matchingGroup = TYPE_GROUPS.find(g => g.types.includes(typeFromUrl))
      if (matchingGroup) {
        setOpenGroups(prev => new Set([...prev, matchingGroup.label]))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── Pagination ──
  const [page, setPage] = useState(1)

  // ── Selected deck / card view ──
  const [selectedDeck, setSelectedDeck] = useState<DeckMetadata | null>(null)
  const [deckCards, setDeckCards] = useState<ScryfallCard[]>([])
  const [deckCardsLoading, setDeckCardsLoading] = useState(false)
  const [deckCardsError, setDeckCardsError] = useState<string | null>(null)
  const [cardQuery, setCardQuery] = useState("")

  const [detailCard, setDetailCard] = useState<ScryfallCard | null>(null)
  const detailEntry = useMemo(
    () => detailCard ? entries.find(e => e.card.oracle_id === detailCard.oracle_id || e.card.name === detailCard.name) : undefined,
    [detailCard, entries]
  )
  const isDetailInDeck = useMemo(
    () => detailCard ? deckIds.has(detailCard.oracle_id ?? detailCard.name) : false,
    [detailCard, deckIds]
  )

  // Load decks
  useEffect(() => {
    fetchDecksMetadata()
      .then(setDecks)
      .catch(() => setError("No se pudieron cargar los decks"))
      .finally(() => setLoading(false))
  }, [])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [query, selectedColors, selectedType])

  // ── Filtering ──
  const filteredDecks = useMemo(() => {
    // Always strip MTGO/digital/sample types
    let result = decks.filter(d => !d.type || !HIDDEN_TYPES.has(d.type))
    
    // ALWAYS filter by the selected type (no "all" option anymore)
    if (selectedType) {
      result = result.filter(d => d.type === selectedType)
    }
    
    // Search query — if there's a query, filter results
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.commanderName?.toLowerCase().includes(q) ?? false)
      )
    }
    
    // Color filter
    if (selectedColors.length > 0) {
      result = result.filter(d =>
        selectedColors.every(c => d.colorIdentity.includes(c))
      )
    }
    
    return result
  }, [decks, query, selectedColors, selectedType])

  const visibleDecks = useMemo(
    () => filteredDecks.slice(0, page * PAGE_SIZE),
    [filteredDecks, page]
  )

  // ── Handlers ──
  const toggleColor = (c: string) =>
    setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  const handleSelectDeck = useCallback(async (deck: DeckMetadata) => {
    setSelectedDeck(deck)
    setDeckCards([])
    setCardQuery("")
    setDeckCardsLoading(true)
    setDeckCardsError(null)
    try {
      const fetched = await fetchCardsForDeck(deck)
      setDeckCards(fetched)
    } catch {
      setDeckCardsError("No se pudieron cargar las cartas")
    } finally {
      setDeckCardsLoading(false)
    }
  }, [])

  const [viewMode, setViewMode] = useState<"stacked" | "grid" | "list">("stacked")
  const [cardSearchOpen, setCardSearchOpen] = useState(false)

  // Derive deckAdded directly from cartDecks so it reflects localStorage in real time
  const deckAdded = useMemo(() => {
    if (!selectedDeck) return false
    return cartDecks.some(d => d.name === selectedDeck.name && d.type === "precon")
  }, [cartDecks, selectedDeck])

  const [showCustomizeModal, setShowCustomizeModal] = useState(false)

  const handleLoadDeck = useCallback(() => {
    if (!deckCards.length || !selectedDeck) return
    if (cartDecks.some(d => d.name === selectedDeck.name && d.type === "precon")) return
    // Show the customize-art prompt instead of adding directly
    setShowCustomizeModal(true)
  }, [deckCards, selectedDeck, cartDecks])

  const handleAddDirectly = useCallback(() => {
    if (!deckCards.length || !selectedDeck) return
    const preconEntries: import("@/types/scryfall").PrintListEntry[] = deckCards.map(card => ({
      id: card.oracle_id ?? card.name,
      card,
      quantity: (card as any).quantity || 1,
    }))
    const cover = deckCards.find(c => (c as any).isCommander) ?? deckCards[0]
    addPreconToCart(selectedDeck.name, preconEntries, cover, selectedDeck.id)
    setShowCustomizeModal(false)
  }, [deckCards, selectedDeck, addPreconToCart])

  const handleCustomizeArt = useCallback(() => {
    if (!deckCards.length || !selectedDeck) return
    const preconEntries: import("@/types/scryfall").PrintListEntry[] = deckCards.map(card => ({
      id: card.oracle_id ?? card.name,
      card,
      quantity: (card as any).quantity || 1,
    }))
    const cover = deckCards.find(c => (c as any).isCommander) ?? deckCards[0]
    // Add to cart first, then open it in the builder for art editing
    const added = addPreconToCart(selectedDeck.name, preconEntries, cover, selectedDeck.id)
    editPreconDeck(added.id)
    setShowCustomizeModal(false)
    router.push("/deckbuilder")
  }, [deckCards, selectedDeck, addPreconToCart, editPreconDeck, router])

  const filteredDeckCards = useMemo(() => {
    if (!cardQuery.trim()) return deckCards
    const q = cardQuery.toLowerCase()
    return deckCards.filter(c =>
      c.name.toLowerCase().includes(q) || c.type_line?.toLowerCase().includes(q)
    )
  }, [deckCards, cardQuery])

  const hasActiveFilters = selectedColors.length > 0 || selectedType !== null
  const uniqueTypes = useMemo(
    () => Array.from(new Set(
      decks.map(d => d.type).filter((t): t is string => !!t && !HIDDEN_TYPES.has(t))
    )).sort(),
    [decks]
  )

  // ── Render: deck detail view ──────────────────────────────────────────────
  if (selectedDeck) {
    const setCode = (selectedDeck.sourceSetCodes?.[0] || selectedDeck.code).toLowerCase()
    const deckTypeCleaned = selectedDeck.type?.replace(" Deck", "").replace(" Drop", "") ?? null

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />

        {/* Customize art modal */}
        {showCustomizeModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setShowCustomizeModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl p-6 space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Agregar al Deckbox</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">{selectedDeck?.name}</span> — {deckCards.length} cartas
                </p>
              </div>

              <div className="rounded-xl border border-accent-gold/20 bg-accent-gold/5 px-4 py-3">
                <p className="text-xs text-accent-gold/90 leading-relaxed">
                  Si queres cambiar el arte de alguna carta o agregar un sideboard, podes hacerlo desde el Deckbuilder. No tiene costo extra.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleAddDirectly}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-surface-raised hover:border-accent-gold/40 hover:bg-surface transition-all text-left group"
                >
                  <div>
                    <p className="text-sm font-bold text-foreground">Agregar directamente</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Usa el arte por defecto de cada carta</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent-gold transition-colors" />
                </button>

                <button
                  onClick={handleCustomizeArt}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-accent-blue/30 bg-accent-blue/5 hover:border-accent-blue/60 hover:bg-accent-blue/10 transition-all text-left group"
                >
                  <div>
                    <p className="text-sm font-bold text-accent-blue">Personalizar artes</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Abre el Deckbuilder para elegir artes o agregar sideboard</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent-blue transition-colors" />
                </button>
              </div>

              <button
                onClick={() => setShowCustomizeModal(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Unified deck header (single bar) ─────────────────────────── */}
        <header className="shrink-0 border-b border-border bg-surface z-20">
          {/* Row 1: back + name + mana colors + search + view modes */}
          <div className="flex items-center gap-3 px-4 h-13 py-2.5">
            <button
              onClick={() => setSelectedDeck(null)}
              className="flex items-center gap-1.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Volver</span>
            </button>
            <div className="w-px h-5 bg-border" />
            <h1 className="text-sm font-bold text-foreground truncate">{selectedDeck.name}</h1>

            {/* Mana color symbols — prominent, using Scryfall SVG symbols */}
            {selectedDeck.colorIdentity.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {selectedDeck.colorIdentity.map(c => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={c}
                    src={`https://svgs.scryfall.io/card-symbols/${c}.svg`}
                    alt={c}
                    title={c}
                    className="h-5 w-5 object-contain drop-shadow-sm"
                  />
                ))}
              </div>
            )}

            <div className="flex-1" />

            {/* Search toggle */}
            <div className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-background transition-all duration-200",
              cardSearchOpen ? "w-44 px-2.5 py-1" : "px-2 py-1"
            )}>
              <button
                onClick={() => { setCardSearchOpen(v => !v); if (cardSearchOpen) setCardQuery("") }}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              {cardSearchOpen && (
                <>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar..."
                    value={cardQuery}
                    onChange={e => setCardQuery(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground min-w-0 w-full"
                  />
                  {cardQuery && (
                    <button onClick={() => setCardQuery("")} className="shrink-0 text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* View mode toggles */}
            <div className="flex items-center gap-0.5 bg-background rounded-lg border border-border p-0.5 shrink-0">
              {([
                { mode: "stacked", icon: Rows3,     title: "Apiladas" },
                { mode: "grid",    icon: LayoutGrid, title: "Cuadrícula" },
                { mode: "list",    icon: List,        title: "Lista" },
              ] as const).map(({ mode, icon: Icon, title }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={title}
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md transition-all",
                    viewMode === mode
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>

            {/* Add to deckbox — green button, only when cards are loaded */}
            {deckCards.length > 0 && !deckCardsLoading && (
              <button
                onClick={deckAdded ? undefined : handleLoadDeck}
                disabled={deckAdded}
                className={cn(
                  "flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold border transition-all shrink-0",
                  deckAdded
                    ? "bg-emerald-700/40 border-emerald-600/30 text-emerald-300 cursor-default"
                    : "bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 hover:border-emerald-400 active:scale-95"
                )}
              >
                {deckAdded ? (
                  <><Check className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Agregado</span></>
                ) : (
                  <><Plus className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">Agregar al Deckbox</span></>
                )}
              </button>
            )}
          </div>

          {/* Row 2: compact metadata — set, type, commander, date, card count */}
          <div className="flex items-center gap-3 px-4 pb-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getSetIconUrl(setCode)}
                alt={selectedDeck.code}
                className="h-3.5 w-3.5 object-contain opacity-60"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
              <span className="text-[11px] font-mono text-muted-foreground uppercase">{selectedDeck.code}</span>
            </div>
            {deckTypeCleaned && (
              <span className="text-[11px] text-muted-foreground">{deckTypeCleaned}</span>
            )}
            {selectedDeck.commanderName && (
              <>
                <span className="text-muted-foreground/30 text-[11px]">·</span>
                <div className="flex items-center gap-1">
                  <Sword className="h-3 w-3 text-accent-gold shrink-0" />
                  <span className="text-[11px] text-foreground">{selectedDeck.commanderName}</span>
                </div>
              </>
            )}
            {selectedDeck.releaseDate && (
              <>
                <span className="text-muted-foreground/30 text-[11px]">·</span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{formatDate(selectedDeck.releaseDate)}</span>
                </div>
              </>
            )}
            <span className="text-muted-foreground/30 text-[11px]">·</span>
            <span className="text-[11px] text-muted-foreground">{selectedDeck.cardCount} cartas</span>
          </div>
        </header>

        {/* Cards area */}
        <div className="flex-1 overflow-auto p-4">
          {deckCardsLoading && (
            <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Cargando cartas…</span>
            </div>
          )}
          {deckCardsError && (
            <div className="flex items-center justify-center h-48 gap-2 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{deckCardsError}</span>
            </div>
          )}
          {!deckCardsLoading && !deckCardsError && filteredDeckCards.length === 0 && (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              {cardQuery ? "Sin resultados para esa búsqueda" : "No hay cartas"}
            </div>
          )}
          {!deckCardsLoading && filteredDeckCards.length > 0 && (() => {
            const groups = groupCardsByType(cardQuery ? filteredDeckCards : deckCards)

            // ── GRID view: all cards flat, correct aspect ratio, no stretching ──
            if (viewMode === "grid" || cardQuery) {
              return (
                <div className="space-y-6 pb-6">
                  {groups.map(({ group, cards: groupCards }) => {
                    const displayCards = cardQuery
                      ? groupCards.filter(c => filteredDeckCards.some(f => f.id === c.id))
                      : groupCards
                    if (!displayCards.length) return null
                    return (
                      <div key={group.key}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</span>
                          <span className="text-[10px] text-muted-foreground bg-surface px-1.5 py-0.5 rounded-full border border-border">
                            {displayCards.reduce((s, c) => s + ((c as any).quantity || 1), 0)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {displayCards.map((card, idx) => (
                            <div key={`${card.id}-${idx}`} className="w-[120px] shrink-0">
                              <FlatCard
                                card={card}
                                inDeck={deckIds.has(card.oracle_id ?? card.name)}
                                onClick={() => setDetailCard(card)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            // ── LIST view: name + type + quantity rows ──
            if (viewMode === "list") {
              return (
                <div className="space-y-4 pb-6 max-w-2xl">
                  {groups.map(({ group, cards: groupCards }) => {
                    if (!groupCards.length) return null
                    const total = groupCards.reduce((s, c) => s + ((c as any).quantity || 1), 0)
                    return (
                      <div key={group.key}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</span>
                          <span className="text-[10px] text-muted-foreground bg-surface px-1.5 py-0.5 rounded-full border border-border">{total}</span>
                        </div>
                        <div className="divide-y divide-border/40 rounded-lg border border-border overflow-hidden">
                          {groupCards.map((card, idx) => {
                            const qty = (card as any).quantity || 1
                            const inDeck = deckIds.has(card.oracle_id ?? card.name)
                            return (
                              <button
                                key={`${card.id}-${idx}`}
                                onClick={() => setDetailCard(card)}
                                className="w-full flex items-center gap-3 px-3 py-2 bg-surface hover:bg-background/60 transition-colors text-left"
                              >
                                {qty > 1 && (
                                  <span className="text-[11px] font-bold text-muted-foreground w-5 text-right shrink-0">{qty}x</span>
                                )}
                                {qty === 1 && <span className="w-5 shrink-0" />}
                                <span className="flex-1 text-sm text-foreground font-medium truncate">{card.name}</span>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[140px] hidden sm:block">{card.type_line}</span>
                                {inDeck && <Check className="h-3 w-3 text-accent-gold shrink-0" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            // ── STACKED view (default): commander large, other types in columns ──
            return (
              <div className="space-y-8 pb-6">
                {/* Commander: full-width, large */}
                {groups.filter(g => g.group.key === "Commander").map(({ group, cards: groupCards }) => (
                  groupCards.length > 0 && (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</span>
                        <span className="text-[10px] text-muted-foreground bg-surface px-1.5 py-0.5 rounded-full border border-border">
                          {groupCards.reduce((s, c) => s + ((c as any).quantity || 1), 0)}
                        </span>
                      </div>
                      {/* Fixed width column so card proportions are correct */}
                      <div className="flex gap-4">
                        <div className="w-[200px] shrink-0">
                          <StackedColumn
                            cards={groupCards}
                            deckIds={deckIds}
                            onCardClick={setDetailCard}
                            cardHeight={CARD_HEIGHT}
                            stripHeight={STRIP_HEIGHT}
                            pushDownHeight={PUSH_DOWN}
                          />
                        </div>
                      </div>
                    </div>
                  )
                ))}

                {/* Other types: multi-column, compact */}
                {groups.filter(g => g.group.key !== "Commander" && g.cards.length > 0).length > 0 && (
                  <div className="flex flex-wrap gap-6 items-start">
                    {groups
                      .filter(g => g.group.key !== "Commander" && g.cards.length > 0)
                      .map(({ group, cards: groupCards }) => (
                        <div key={group.key} className="flex flex-col w-[160px] shrink-0">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</span>
                            <span className="text-[10px] text-muted-foreground bg-surface px-1.5 py-0.5 rounded-full border border-border">
                              {groupCards.reduce((s, c) => s + ((c as any).quantity || 1), 0)}
                            </span>
                          </div>
                          <StackedColumn
                            cards={groupCards}
                            deckIds={deckIds}
                            onCardClick={setDetailCard}
                            cardHeight={CARD_HEIGHT_COMPACT}
                            stripHeight={STRIP_HEIGHT_COMPACT}
                            pushDownHeight={PUSH_DOWN_COMPACT}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {detailCard && (
          <CardDetailModal
            card={detailCard}
            entry={detailEntry}
            isInDeck={isDetailInDeck}
            onClose={() => setDetailCard(null)}
            onAdd={card => addCard(card, 1)}
            onUpdatePrint={updatePrint}
          />
        )}
      </div>
    )
  }

  // ── Render: deck browser ─────────────────────────────────────��───────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />



      {showImport && (
        <ImportDeckModal
          onClose={() => { setShowImport(false); setImportText("") }}
          onImport={handleImport}
          initialText={importText}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ── Sidebar filters ── */}
        <aside className="shrink-0 w-60 hidden md:flex flex-col border-r border-border bg-surface overflow-y-auto">

          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 bg-background rounded-lg px-2.5 py-1.5 border border-border">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Buscar deck..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onPaste={handleSearchPaste}
                className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground"
              />
              {query && (
                <button onClick={() => setQuery("")}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Color filter with Scryfall mana symbols */}
          <div className="p-3 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">Identidad de color</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleColor(c.id)}
                  title={c.label}
                  className={cn(
                    "relative w-8 h-8 rounded-full transition-all hover:scale-110 focus:outline-none",
                    selectedColors.includes(c.id)
                      ? "ring-2 ring-accent-gold ring-offset-1 ring-offset-surface scale-110"
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://svgs.scryfall.io/card-symbols/${c.id}.svg`}
                    alt={c.label}
                    className="w-full h-full object-contain drop-shadow-sm"
                  />
                </button>
              ))}
            </div>
            {selectedColors.length > 0 && (
              <button onClick={() => setSelectedColors([])} className="mt-2 text-[10px] text-muted-foreground hover:text-accent-gold transition-colors">
                Limpiar filtro
              </button>
            )}
          </div>

          {/* Curated type accordions */}
          <div className="flex-1 overflow-y-auto">
            {TYPE_GROUPS.map(group => {
              const isOpen = openGroups.has(group.label)
              const availableTypes = group.types.filter(t => uniqueTypes.includes(t))
              if (availableTypes.length === 0) return null
              return (
                <div key={group.label} className="border-b border-border/50">
                  <button
                    onClick={() => setOpenGroups(prev => {
                      const next = new Set(prev)
                      if (next.has(group.label)) next.delete(group.label)
                      else next.add(group.label)
                      return next
                    })}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-background/50 transition-colors"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</span>
                    <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="pb-1">
                      {availableTypes.map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            setSelectedType(t)
                            router.replace(`/precons?type=${encodeURIComponent(t)}`, { scroll: false })
                          }}
                          className={cn(
                            "w-full text-left text-xs px-4 py-1.5 transition-colors",
                            selectedType === t
                              ? "text-accent-gold font-semibold bg-accent-gold/8"
                              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                          )}
                        >
                          {t.replace(" Deck", "").replace(" Drop", "").replace(" Pack", "")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Stats */}
          {!loading && (
            <div className="p-3 border-t border-border mt-auto shrink-0">
              <p className="text-[10px] text-muted-foreground">
                {filteredDecks.length.toLocaleString()} de {filteredDecks.length.toLocaleString()} decks
              </p>
            </div>
          )}
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto">
          {/* Toolbar */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
            {/* Mobile search */}
            <div className="flex md:hidden items-center gap-2 bg-surface rounded-lg px-2.5 py-1.5 border border-border flex-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Buscar..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <button
              onClick={() => setShowFilters(f => !f)}
              className={cn(
                "md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                hasActiveFilters
                  ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros {hasActiveFilters && `(${selectedColors.length + (selectedType ? 1 : 0)})`}
            </button>

            <div className="hidden md:flex items-center gap-2 flex-wrap">
              {selectedColors.map(c => (
                <span key={c} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border text-[10px] text-muted-foreground">
                  <span className={cn("w-2.5 h-2.5 rounded-full", COLOR_DOT[c])} />
                  {COLORS.find(col => col.id === c)?.label}
                  <button onClick={() => toggleColor(c)} className="ml-0.5 hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>

            <div className="ml-auto text-xs text-muted-foreground hidden md:block">
              {loading ? "Cargando..." : `${filteredDecks.length.toLocaleString()} decks`}
            </div>
          </div>

          {/* Mobile filter panel */}
          {showFilters && (
            <div className="md:hidden border-b border-border bg-surface p-4 flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Color</p>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => toggleColor(c.id)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        COLOR_DOT[c.id],
                        selectedColors.includes(c.id) ? "ring-2 ring-accent-gold ring-offset-1" : "opacity-70"
                      )}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Tipo</p>
                <div className="flex flex-wrap gap-1">
                  {uniqueTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedType(t)}
                      className={cn(
                        "text-xs px-2 py-1 rounded-md border transition-colors",
                        selectedType === t
                          ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* States */}
          {loading && (
            <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Cargando {decks.length > 0 ? decks.length.toLocaleString() : ""} decks...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-64 gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Deck grid */}
          {!loading && !error && (
            <div className="p-4">
              {filteredDecks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
                  <Filter className="h-8 w-8 opacity-30" />
                  <span className="text-sm">Sin resultados. Ajusta los filtros.</span>
                  <button
                    onClick={() => { setQuery(""); setSelectedColors([]) }}
                    className="text-xs text-accent-gold hover:underline mt-1"
                  >
                    Limpiar búsqueda y colores
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {visibleDecks.map(deck => (
                      <DeckCard key={deck.id} deck={deck} onClick={() => handleSelectDeck(deck)} />
                    ))}
                  </div>

                  {/* Load more */}
                  {visibleDecks.length < filteredDecks.length && (
                    <div className="flex flex-col items-center gap-2 mt-6">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {visibleDecks.length} de {filteredDecks.length.toLocaleString()}
                      </p>
                      <button
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 rounded-lg border border-border bg-surface text-sm font-medium text-foreground hover:border-accent-gold hover:text-accent-gold transition-colors"
                      >
                        Cargar {Math.min(PAGE_SIZE, filteredDecks.length - visibleDecks.length)} más
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
