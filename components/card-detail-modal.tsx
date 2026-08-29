"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  X, Plus, Check, RotateCcw, Loader2, ChevronLeft, ChevronRight,
  Palette, BookOpen, Star, Sparkles, Info, Maximize2,
  Package, LayoutList, MoreVertical,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ScryfallCard, PrintListEntry, DeckItem } from "@/types/scryfall"
import { usePrintStore, SINGLES_DECK_ID, SINGLES_DECK_NAME } from "@/providers/print-store-provider"
import { useDeckbox } from "@/providers/deckbox-provider"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDoubleFaced(card: ScryfallCard): boolean {
  return (
    Array.isArray(card.card_faces) &&
    card.card_faces.length >= 2 &&
    !!card.card_faces[0].image_uris
  )
}

function getFaceImages(card: ScryfallCard): { label: string; url: string }[] {
  if (isDoubleFaced(card) && card.card_faces) {
    return card.card_faces
      .filter((f) => f.image_uris?.large || f.image_uris?.normal)
      .map((f) => ({ label: f.name, url: (f.image_uris?.large ?? f.image_uris?.normal)! }))
  }
  const url = card.image_uris?.large ?? card.image_uris?.normal
  return url ? [{ label: card.name, url }] : []
}

function getOracleText(card: ScryfallCard): string {
  if (card.oracle_text) return card.oracle_text
  if (card.card_faces) return card.card_faces.map((f) => f.oracle_text ?? "").filter(Boolean).join("\n—\n")
  return ""
}

function getManaCost(card: ScryfallCard): string {
  if (card.mana_cost) return card.mana_cost
  if (card.card_faces?.[0]?.mana_cost) return card.card_faces[0].mana_cost
  return ""
}

function getRarityConfig(rarity?: string): { color: string; bg: string; label: string; icon: React.ReactNode } {
  switch (rarity) {
    case "mythic":  return { color: "text-orange-300", bg: "bg-orange-500/15 border-orange-500/30", label: "Mítica",      icon: <Sparkles className="h-3 w-3" /> }
    case "rare":    return { color: "text-yellow-300", bg: "bg-yellow-500/15 border-yellow-500/30", label: "Rara",         icon: <Star className="h-3 w-3" /> }
    case "uncommon":return { color: "text-slate-300",  bg: "bg-slate-500/15 border-slate-500/30",   label: "Infrecuente",  icon: <Info className="h-3 w-3" /> }
    default:        return { color: "text-zinc-400",   bg: "bg-zinc-500/10 border-zinc-500/20",     label: "Común",        icon: <BookOpen className="h-3 w-3" /> }
  }
}

const MANA_SYMBOL: Record<string, { bg: string; text: string }> = {
  W: { bg: "bg-yellow-50",  text: "text-yellow-900" },
  U: { bg: "bg-blue-600",   text: "text-white" },
  B: { bg: "bg-zinc-900",   text: "text-zinc-200" },
  R: { bg: "bg-red-600",    text: "text-white" },
  G: { bg: "bg-green-700",  text: "text-white" },
  C: { bg: "bg-zinc-500",   text: "text-white" },
}

function ManaCostDisplay({ cost }: { cost: string }) {
  const symbols = cost.match(/\{[^}]+\}/g) ?? []
  if (!symbols.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      {symbols.map((s, i) => {
        const inner = s.replace(/[{}]/g, "")
        const cfg = MANA_SYMBOL[inner]
        return (
          <span
            key={i}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-[11px] font-bold leading-none shadow-sm ${
              cfg ? `${cfg.bg} ${cfg.text}` : "bg-zinc-700 text-zinc-200"
            }`}
          >
            {inner}
          </span>
        )
      })}
    </div>
  )
}

// ─── Single print thumbnail ───────────────────────────────────────────────────

function PrintThumb({
  print,
  isActive,
  onSelect,
  size = "normal",
}: {
  print: ScryfallCard
  isActive: boolean
  onSelect: (p: ScryfallCard) => void
  size?: "normal" | "large"
}) {
  const thumb = size === "large"
    ? (print.image_uris?.normal ?? print.card_faces?.[0]?.image_uris?.normal)
    : (print.image_uris?.small ?? print.card_faces?.[0]?.image_uris?.small)

  return (
    <button
      onClick={() => onSelect(print)}
      className={`group relative overflow-hidden rounded-lg transition-all duration-150 ${
        isActive
          ? "ring-2 ring-accent-gold ring-offset-2 ring-offset-[#0f1020] shadow-[0_0_12px_2px] shadow-accent-gold/30"
          : "ring-1 ring-border hover:ring-accent-gold/60 hover:scale-[1.03]"
      }`}
      title={`${print.set_name} · #${print.collector_number}`}
      aria-label={`Seleccionar edición ${print.set_name}`}
      aria-pressed={isActive}
    >
      {thumb ? (
        <img
          src={thumb}
          alt={`${print.set_name} #${print.collector_number}`}
          className="aspect-[63/88] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="aspect-[63/88] w-full bg-surface flex items-center justify-center">
          <span className="text-[8px] text-muted-foreground font-mono">{print.set.toUpperCase()}</span>
        </div>
      )}

      {/* Set code label */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 pt-3 pb-0.5">
        <p className="text-center text-[7px] font-bold text-white/90 font-mono leading-none">
          {print.set.toUpperCase()}
        </p>
      </div>

      {/* Active checkmark */}
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gold shadow-lg">
            <Check className="h-3.5 w-3.5 text-surface" strokeWidth={3} />
          </div>
        </div>
      )}
    </button>
  )
}

// ─── Art Grid (inline + expandable overlay) ───────────────────────────────────

interface ArtGridProps {
  card: ScryfallCard
  activePrintId: string
  onSelectPrint: (print: ScryfallCard) => void
}

function ArtGrid({ card, activePrintId, onSelectPrint }: ArtGridProps) {
  const [prints, setPrints] = useState<ScryfallCard[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const fetchedRef = useRef(false)

  const fetchPrints = useCallback(async () => {
    if (fetchedRef.current || !card.prints_search_uri) return
    fetchedRef.current = true
    setLoading(true)
    try {
      const res = await fetch(card.prints_search_uri)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPrints(data.data ?? [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [card.prints_search_uri])

  useEffect(() => { fetchPrints() }, [fetchPrints])

  // Close expanded overlay on Escape (separate handler so it doesn't close the whole modal)
  useEffect(() => {
    if (!expanded) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [expanded])

  if (!card.prints_search_uri) return null

  return (
    <>
      {/* ── Inline compact grid ── */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-accent-gold shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Arte alternativo
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
          {!loading && prints.length > 0 && (
            <>
              <span className="text-[10px] text-muted-foreground/60 ml-auto">{prints.length} ediciones</span>
              <button
                onClick={() => setExpanded(true)}
                className="ml-1.5 flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-accent-gold/50 hover:text-accent-gold transition-colors"
                aria-label="Expandir selector de artes"
              >
                <Maximize2 className="h-2.5 w-2.5" />
                Expandir
              </button>
            </>
          )}
        </div>

        {loading && (
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[63/88] animate-pulse rounded-lg bg-surface-raised" />
            ))}
          </div>
        )}

        {!loading && prints.length > 0 && (
          <div
            className="grid grid-cols-4 gap-1.5"
            onWheel={e => e.stopPropagation()}
          >
            {/* Show max 3 arts, then a "Ver todos" button as 4th */}
            {prints.slice(0, 3).map((p) => (
              <PrintThumb
                key={p.id}
                print={p}
                isActive={p.id === activePrintId}
                onSelect={onSelectPrint}
              />
            ))}
            {prints.length > 3 && (
              <button
                onClick={() => setExpanded(true)}
                className="aspect-[63/88] rounded-lg border border-dashed border-border bg-transparent hover:bg-accent-gold/5 hover:border-accent-gold/50 flex items-center justify-center transition-all group"
                title={`Ver los ${prints.length - 3} artes restantes`}
                aria-label={`Ver todos los ${prints.length} artes disponibles`}
              >
                <div className="flex flex-col items-center gap-1">
                  <Plus className="h-5 w-5 text-muted-foreground group-hover:text-accent-gold transition-colors" />
                  <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-accent-gold transition-colors">Ver todos</span>
                </div>
              </button>
            )}
          </div>
        )}

        {!loading && fetchedRef.current && prints.length === 0 && (
          <p className="text-xs text-muted-foreground/60">No se encontraron otras ediciones.</p>
        )}
      </div>

      {/* ── Expanded full-screen overlay ── */}
      {expanded && prints.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Selector de artes"
        >
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => setExpanded(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col w-full max-w-4xl max-h-[calc(100vh-120px)] rounded-2xl border border-white/10 bg-card shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground text-base">{card.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{prints.length} ediciones disponibles · cliqueá para seleccionar</p>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Grid */}
            <div
              className="flex-1 overflow-y-auto p-5"
              onWheel={e => e.stopPropagation()}
            >
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {prints.map((p) => (
                  <div key={p.id} className="flex flex-col gap-1">
                    <PrintThumb
                      print={p}
                      isActive={p.id === activePrintId}
                      onSelect={(selected) => {
                        onSelectPrint(selected)
                        setExpanded(false)
                      }}
                      size="large"
                    />
                    <p className="text-[9px] text-center text-muted-foreground leading-tight px-0.5 truncate">
                      {p.set_name}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Seleccionada:{" "}
                <span className="font-medium text-accent-gold">
                  {prints.find(p => p.id === activePrintId)?.set_name ?? card.set_name}
                </span>
              </p>
              <button
                onClick={() => setExpanded(false)}
                className="px-4 py-2 rounded-lg bg-accent-gold text-background text-sm font-semibold hover:brightness-110 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export interface CardDetailModalProps {
  card: ScryfallCard
  entry?: PrintListEntry
  isInDeck: boolean
  onClose: () => void
  onAdd: (card: ScryfallCard) => void
  /** Always provided — used to persist art selection for both new and existing deck entries */
  onUpdatePrint: (entryId: string, print: ScryfallCard) => void
}

export function CardDetailModal({
  card,
  entry,
  isInDeck,
  onClose,
  onAdd,
  onUpdatePrint,
}: CardDetailModalProps) {
  const dfc = isDoubleFaced(card)
  const oracle = getOracleText(card)
  const mana = getManaCost(card)
  const rarityConfig = getRarityConfig(card.rarity)

  // Store hooks for deck picker
  const { cartDecks, addSingleCard, addCardToDeck } = usePrintStore()
  const { lastDeckId, setLastDeckId } = useDeckbox()

  // Resolve the target deck: use lastDeckId if it still exists in cart, else Singles
  const resolvedTargetId = (lastDeckId && cartDecks.some(d => d.id === lastDeckId))
    ? lastDeckId
    : cartDecks[0]?.id ?? null
  const targetDeck = cartDecks.find(d => d.id === resolvedTargetId) ?? null
  const targetName = targetDeck ? targetDeck.name : SINGLES_DECK_NAME

  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    function handler(e: Event) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [pickerOpen])

  // Local state: which face is previewed
  const [faceIndex, setFaceIndex] = useState(0)

  // LOCAL selected print — initialise from persisted entry, or default to the card itself
  const [localPrint, setLocalPrint] = useState<ScryfallCard>(entry?.selectedPrint ?? card)

  const faces = getFaceImages(localPrint)
  const currentFaceImg = faces[faceIndex]?.url

  // Keep faceIndex in bounds when print changes
  useEffect(() => {
    setFaceIndex(0)
  }, [localPrint.id])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  function handleSelectPrint(print: ScryfallCard) {
    setLocalPrint(print)
    if (entry) {
      onUpdatePrint(entry.id, print)
    }
  }

  function handleAdd() {
    onAdd(card)
    if (localPrint.id !== card.id) {
      const entryKey = card.oracle_id ?? card.name
      setTimeout(() => { onUpdatePrint(entryKey, localPrint) }, 0)
    }
    onClose()
  }

  /** Add to a specific cart deck (or singles), updating lastDeckId */
  function handleAddToDeck(deckId: string | null) {
    setPickerOpen(false)
    const target = deckId ?? SINGLES_DECK_ID
    if (target === SINGLES_DECK_ID) {
      addSingleCard(card, 1)
    } else {
      addCardToDeck(target, card, 1)
    }
    setLastDeckId(target)
    // Also update art if a non-default print is selected
    if (localPrint.id !== card.id) {
      const entryKey = card.oracle_id ?? card.name
      setTimeout(() => { onUpdatePrint(entryKey, localPrint) }, 0)
    }
    onClose()
  }

  function DeckPickerIcon({ type }: { type: DeckItem["type"] }) {
    if (type === "singles") return <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
    if (type === "precon" || type === "set") return <LayoutList className="h-4 w-4 shrink-0 text-muted-foreground" />
    return <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${card.name}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — on mobile the whole card scrolls as one flow (image included) so
          you drag past the art instead of hunting for a tiny inner scrollbox; only
          the footer CTA stays pinned. On desktop (md+) the two-column layout with
          an independently scrolling info panel is unchanged. */}
      <div className="relative z-10 flex w-full max-w-4xl flex-col overflow-y-auto md:overflow-hidden rounded-2xl border border-white/8 bg-card shadow-[0_32px_80px_rgba(0,0,0,0.8)] md:flex-row" style={{ maxHeight: "94dvh" }}>

        {/* ── Left: card image ── */}
        <div className="relative flex shrink-0 flex-col items-center justify-center gap-3 bg-surface p-5 md:w-80 lg:w-96 md:min-h-0">
          {/* Glow behind card */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {currentFaceImg && (
              <div
                className="absolute inset-0 scale-110 blur-3xl opacity-20"
                style={{ backgroundImage: `url(${currentFaceImg})`, backgroundSize: "cover", backgroundPosition: "center" }}
              />
            )}
          </div>

          {/* Floating close button — overlaid directly on the art so it's always
              obvious and reachable on mobile, instead of hiding below the image
              inside the header row. Desktop keeps the header's close button. */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white border border-white/15 backdrop-blur-sm hover:bg-black/80 transition-all md:hidden"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative mx-auto aspect-[63/88] h-[44dvh] w-auto md:h-auto md:w-full">
            {currentFaceImg ? (
              <img
                src={currentFaceImg}
                alt={faces[faceIndex]?.label ?? card.name}
                className="w-full h-full object-cover rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-surface-raised flex items-center justify-center border border-border">
                <span className="text-xs text-muted-foreground">Sin imagen</span>
              </div>
            )}
          </div>

          {dfc && (
            <button
              onClick={() => setFaceIndex(f => f === 0 ? 1 : 0)}
              className="relative flex items-center justify-center h-7 w-7 rounded-lg bg-accent-gold/10 border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/20 hover:border-accent-gold/50 transition-all"
              title="Carta doble — clic para rotar"
              aria-label="Rotar carta doble"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* ── Right: info ── */}
        <div className="flex flex-1 min-h-0 flex-col">

          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/60">
            <div className="min-w-0 flex-1">
              <h2 className="text-pretty text-lg font-bold text-foreground leading-tight tracking-tight">
                {card.name}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                {card.type_line ?? card.card_faces?.map((f) => f.type_line).filter(Boolean).join(" // ")}
              </p>
            </div>
            {/* Desktop-only close button — mobile uses the floating one over the art */}
            <button
              onClick={onClose}
              className="hidden md:flex shrink-0 h-7 w-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-surface-raised hover:text-foreground hover:border-border transition-all"
              aria-label="Cerrar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body — scrolls independently on desktop; on mobile it has no bounded
              height so it just flows as part of the single outer scroll */}
          <div className="flex flex-1 flex-col gap-4 md:overflow-y-auto px-5 py-4 min-h-0">

            {/* Art picker — placed right below the name/type header so alternate
                editions are the first thing you see, passes localPrint.id as
                activePrintId so selection is always reflected */}
            <ArtGrid
              card={card}
              activePrintId={localPrint.id}
              onSelectPrint={handleSelectPrint}
            />

            {/* Selected edition indicator when a non-default is active */}
            {localPrint.id !== card.id && (
              <div className="flex items-center gap-2 rounded-lg bg-accent-gold/10 border border-accent-gold/25 px-3 py-2">
                <Check className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                <p className="text-xs text-accent-gold leading-tight">
                  <span className="font-semibold">{localPrint.set_name}</span>
                  {localPrint.collector_number && ` · #${localPrint.collector_number}`}
                  {localPrint.artist && ` · Illus. ${localPrint.artist}`}
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border/40" />

            {/* Mana + Rarity */}
            <div className="flex flex-wrap items-center gap-2">
              {mana && <ManaCostDisplay cost={mana} />}
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${rarityConfig.bg} ${rarityConfig.color}`}>
                {rarityConfig.icon}
                {rarityConfig.label}
              </span>
            </div>

            {/* Set info row */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono font-medium text-foreground/70">{card.set.toUpperCase()}</span>
              <span>{card.set_name}</span>
              {card.collector_number && <span>#{card.collector_number}</span>}
              {card.artist && <span>Illus. {card.artist}</span>}
              {card.released_at && <span>{new Date(card.released_at).getFullYear()}</span>}
            </div>

            {/* Oracle text */}
            {oracle && (
              <div className="rounded-xl border border-border/60 bg-surface px-3.5 py-3">
                <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-foreground/85 font-[system-ui,serif] italic">
                  {oracle}
                </p>
              </div>
            )}
          </div>

          {/* Footer CTA — always pinned to the bottom of the info column (sticky on
              mobile within the single outer scroll, static-but-fixed-position on
              desktop's independently-scrolling column) so it never requires
              scrolling past the art grid to reach it */}
          <div className="sticky bottom-0 z-10 shrink-0 bg-card border-t border-border/60 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div ref={pickerRef} className="relative w-full">
              {/* Main action row: primary button + three-dots options menu */}
              <div className="flex items-stretch w-full gap-2">
                {/* Main action */}
                {isInDeck ? (
                  <button
                    onClick={handleAdd}
                    className="flex-1 min-h-11 flex items-center justify-center gap-2 rounded-xl border border-accent-gold/40 bg-accent-gold/10 text-foreground font-semibold text-sm hover:bg-accent-gold/20 hover:border-accent-gold/60 transition-all px-4"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate">Agregar 1 copia más</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleAddToDeck(resolvedTargetId)}
                    className="flex-1 min-h-11 flex items-center justify-center gap-2 rounded-xl bg-accent-gold text-surface font-bold text-sm hover:brightness-105 transition-all px-4 shadow-lg shadow-black/20"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      Agregar a <span className="font-black">{targetName}</span>
                    </span>
                  </button>
                )}

                {/* Three-dots — opens the deck list */}
                <button
                  onClick={() => setPickerOpen(v => !v)}
                  className={cn(
                    "shrink-0 min-h-11 w-11 flex items-center justify-center rounded-xl border transition-all",
                    pickerOpen
                      ? "border-accent-gold/60 bg-accent-gold/15 text-accent-gold"
                      : "border-border bg-surface-raised text-muted-foreground hover:border-accent-gold/50 hover:text-foreground"
                  )}
                  aria-label="Más opciones — elegir mazo"
                  aria-expanded={pickerOpen}
                  aria-haspopup="menu"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>

              {/* Options list — opens upward, scrollable, large touch targets */}
              {pickerOpen && (
                <div
                  role="menu"
                  className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-20 max-h-[min(50dvh,20rem)] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl shadow-black/60"
                  onWheel={e => e.stopPropagation()}
                >
                  <p className="sticky top-0 bg-card text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-4 pt-3.5 pb-2 border-b border-border/40">
                    Agregar a...
                  </p>
                  {/* Singles (always available) */}
                  <button
                    role="menuitem"
                    onClick={() => handleAddToDeck(SINGLES_DECK_ID)}
                    className={cn(
                      "w-full min-h-12 flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-raised active:bg-surface-raised transition-colors text-left",
                      resolvedTargetId === SINGLES_DECK_ID && "bg-accent-gold/5"
                    )}
                  >
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-foreground">{SINGLES_DECK_NAME}</span>
                    {resolvedTargetId === SINGLES_DECK_ID
                      ? <Check className="h-4 w-4 text-accent-gold shrink-0" />
                      : <Plus className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                  </button>
                  {/* Other decks */}
                  {cartDecks.filter(d => d.type !== "singles").map(deck => (
                    <button
                      key={deck.id}
                      role="menuitem"
                      onClick={() => handleAddToDeck(deck.id)}
                      className={cn(
                        "w-full min-h-12 flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-raised active:bg-surface-raised transition-colors text-left border-t border-border/40",
                        resolvedTargetId === deck.id && "bg-accent-gold/5"
                      )}
                    >
                      <DeckPickerIcon type={deck.type} />
                      <span className="flex-1 truncate text-foreground">{deck.name}</span>
                      {resolvedTargetId === deck.id
                        ? <Check className="h-4 w-4 text-accent-gold shrink-0" />
                        : <Plus className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                    </button>
                  ))}
                  {cartDecks.filter(d => d.type !== "singles").length === 0 && (
                    <p className="px-4 py-3 text-xs text-muted-foreground/40 border-t border-border/40">
                      No hay mazos en el deckbox — se agregará a Singles.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
