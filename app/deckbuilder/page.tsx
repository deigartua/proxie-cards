"use client"

import { useState, useCallback, useMemo, Suspense, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"

import { usePrintStore, GAME_FORMATS } from "@/providers/print-store-provider"
import { Navbar } from "@/components/navbar"
import { SearchPanel } from "@/components/search-panel"
import { CardDetailModal } from "@/components/card-detail-modal"
import { ImportDeckModal } from "@/components/import-deck-modal"
import { BuilderCartPanel } from "@/components/builder-cart-panel"
import { RuleWarningDialog } from "@/components/rule-warning-dialog"
import type { ScryfallCard, PrintListEntry, GameFormat, GameFormatConfig } from "@/types/scryfall"
import { ShoppingBag, AlertTriangle, X, Minus, Plus, CloudCheck, HelpCircle, ArrowRight, ChevronLeft, ChevronRight, Palette, Maximize2, LayoutGrid, Rows3, Swords, ArrowLeft, Save, BookOpen, Trash2, Pencil, Wand2, MoreVertical, ImagePlus, Crown } from "lucide-react"
import { DeckRowItem } from "@/components/deck-row-item"
import type { DeckItem } from "@/types/scryfall"
import { cn } from "@/lib/utils"
import { getRuleViolationReason, isEligibleCommander, getCommanderIneligibleReason } from "@/lib/format-rules"



function getDeckSize(cfg: GameFormatConfig | undefined): number {
  return cfg?.deckSize ?? 60
}
function isSingleton(cfg: GameFormatConfig | undefined): boolean {
  return (cfg?.maxCopies ?? Infinity) === 1
}
/** Basic lands (Plains, Island, Swamp, Mountain, Forest, Wastes and variants) are exempt from singleton */
function isBasicLand(card: ScryfallCard): boolean {
  const typeLine = (card.type_line ?? "").toLowerCase()
  return typeLine.includes("basic") && typeLine.includes("land")
}
/** Any land card (basic or nonbasic), used to relax singleton for lands in Commander */
function isLand(card: ScryfallCard): boolean {
  const typeLine = (card.type_line ?? "").toLowerCase()
  return typeLine.includes("land")
}
/**
 * In Commander, all lands (not just basics) may repeat freely — singleton is
 * ignored for them. User-uploaded custom cards are also exempt from
 * singleton in every format, since they have no real Scryfall identity to
 * deduplicate against.
 */
function isSingletonExempt(card: ScryfallCard, isCommanderFormat: boolean): boolean {
  if (card.isCustomUpload) return true
  return isBasicLand(card) || (isCommanderFormat && isLand(card))
}

const FORMAT_RULES: Record<string, { description: string; rules: string[] }> = {
  singles: {
    description: "Sin restricciones de formato. Pedí cualquier carta en cualquier cantidad.",
    rules: ["Sin limite de cartas", "Sin limite de copias por carta", "Cualquier carta es valida"],
  },
  commander: {
    description: "Formato multijugador de 100 cartas exactas, completamente singleton.",
    rules: ["100 cartas exactas (incluyendo el comandante)", "Solo 1 copia de cada carta (singleton)", "Las Tierras Basicas pueden repetirse", "1 carta Legendaria como Comandante", "La identidad de color del mazo debe coincidir con el Comandante"],
  },
  standard: {
    description: "Formato rotativo con los sets mas recientes de los ultimos 2 anos.",
    rules: ["Minimo 60 cartas", "Hasta 4 copias de cada carta (excepto Tierras Basicas)", "Solo sets legales en Standard vigente", "Rotacion anual de sets"],
  },
  pioneer: {
    description: "Formato no rotativo con sets desde Return to Ravnica (2012) en adelante.",
    rules: ["Minimo 60 cartas", "Hasta 4 copias de cada carta", "Sets desde Return to Ravnica (Oct 2012)", "Sin Fetch Lands originales ni Power 9"],
  },
  modern: {
    description: "Formato no rotativo con sets desde 8th Edition / Mirrodin (2003).",
    rules: ["Minimo 60 cartas", "Hasta 4 copias de cada carta", "Sets desde 8th Edition / Mirrodin (2003)", "Lista de cartas baneadas activa"],
  },
  legacy: {
    description: "Formato con casi todo el catalogo de Magic permitido.",
    rules: ["Minimo 60 cartas", "Hasta 4 copias de cada carta", "Casi todo el catalogo de cartas", "Lista de baneados activa (más restrictiva que Modern)"],
  },
  vintage: {
    description: "El formato mas permisivo — incluye las Power 9.",
    rules: ["Minimo 60 cartas", "Hasta 4 copias de cada carta", "Power 9 y otras cartas restringidas a 1 copia", "Muy pocas cartas totalmente baneadas"],
  },
  pauper: {
    description: "Solo cartas de rareza comun (Common).",
    rules: ["Minimo 60 cartas", "Hasta 4 copias de cada carta", "Solo cartas de rareza Common", "Formato economico y accesible"],
  },
  oathbreaker: {
    description: "Como Commander pero con un Planeswalker como lider y 60 cartas.",
    rules: ["60 cartas exactas (singleton)", "1 Planeswalker como Oathbreaker (lider)", "1 Hechizo Emblema asociado al Planeswalker", "La identidad de color debe coincidir"],
  },
  brawl: {
    description: "Como Commander pero con cartas Standard-legal y 60 cartas.",
    rules: ["60 cartas exactas (singleton)", "1 carta Legendaria o Planeswalker como Comandante", "Solo cartas legales en Standard vigente", "Formato de Arena Online principalmente"],
  },
  historic: {
    description: "Formato de Arena Online con sets adicionales via Anthologies.",
    rules: ["Minimo 60 cartas", "Hasta 4 copias de cada carta", "Incluye sets de Anthologies y Jumpstart", "Exclusivo de Magic: The Gathering Arena"],
  },
}

interface Slot {
  entry: PrintListEntry
  copyIndex: number
  slotIndex: number
}

function buildSlots(entries: PrintListEntry[], _singleton: boolean, _isCommanderFormat = false, commanderEntryId?: string | null): Slot[] {
  // Format rules (singleton, max-copies, etc.) are guidance, not enforcement —
  // every copy the player actually added is shown as its own slot. Cards that
  // break the active format's rules get flagged with a warning border instead
  // of being hidden or capped (see copyLimitEntryIds in the main component).
  // The Commander (if marked) is always sorted to the front of the grid.
  const ordered = commanderEntryId
    ? [...entries].sort((a, b) => (a.id === commanderEntryId ? -1 : b.id === commanderEntryId ? 1 : 0))
    : entries
  const slots: Slot[] = []
  for (const entry of ordered) {
    for (let i = 0; i < entry.quantity; i++) {
      slots.push({ entry, copyIndex: i, slotIndex: slots.length })
    }
  }
  return slots
}

interface FilledSlotProps {
  slot: Slot
  singleton: boolean
  maxCopies: number
  isCommanderFormat: boolean
  onRemove: (id: string) => void
  onQtyChange: (id: string, qty: number) => void
  isIllegal: boolean
  /** Copy count breaks the active format's rules (e.g. 2nd copy in a singleton format) —
   *  shown as a non-blocking amber warning; the player can still add/keep the copies. */
  isOverCopyLimit: boolean
  /** Human-readable explanation of the violation, shown in the warning popup. */
  violationReason: string | null
  onViewDetail: (card: ScryfallCard) => void
  onChangeArt: (card: ScryfallCard) => void
  /** True when this entry is the deck's marked Commander */
  isCommanderCard?: boolean
  /** Toggle this entry as the deck's Commander (only shown in Commander-format decks) */
  onToggleCommander?: (entryId: string) => void
}

function FilledSlot({ slot, singleton, maxCopies, isCommanderFormat, onRemove, onQtyChange, isIllegal, isOverCopyLimit, violationReason, onViewDetail, onChangeArt, isCommanderCard, onToggleCommander }: FilledSlotProps) {
  const { entry, copyIndex } = slot
  const imgSrc =
    entry.selectedPrint?.image_uris?.normal ??
    entry.card.image_uris?.normal ??
    entry.card.card_faces?.[0]?.image_uris?.normal
  // Lands are exempt from singleton in Commander, so they never need the warning
  const exempt = isSingletonExempt(entry.card, isCommanderFormat)
  // The stepper is always available and never caps out — format rules guide the
  // player via the amber warning border instead of blocking the action outright.
  const canAdjustQty = true
  const effectiveMaxCopies = 99
  const showCopyLabel = exempt || singleton || maxCopies > 1
  const hasViolation = isIllegal || isOverCopyLimit
  // Only legendary creatures (or cards that explicitly grant it) can be the
  // Commander. Ineligible cards still show the action (muted) — clicking it
  // routes through onToggleCommander, which surfaces the reason via a popup
  // instead of silently doing nothing.
  const commanderEligible = isCommanderCard || isEligibleCommander(entry.card)

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAlign, setMenuAlign] = useState<"left" | "right">("right")
  const [warningOpen, setWarningOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Close the mobile menu on any outside tap
  useEffect(() => {
    if (!menuOpen) return
    function handler(e: Event) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [menuOpen])

  // Flip the popup's anchor so it never spills off-screen for left-column cards
  const toggleMenu = () => {
    if (!menuOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const menuWidth = 208
      setMenuAlign(rect.right - menuWidth < 8 ? "left" : "right")
    }
    setMenuOpen(v => !v)
  }

  return (
    <div className="group relative aspect-[63/88] select-none">
      {/* Card visual (clipped) — tap opens preview */}
      <div
        className={cn(
          "absolute inset-0 rounded-md overflow-hidden border-2 transition-all duration-150 cursor-pointer",
          isCommanderCard
            ? "border-white shadow-[0_0_10px_rgba(255,255,255,0.35)]"
            : isIllegal
              ? "border-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.25)]"
              : isOverCopyLimit
                ? "border-amber-400/80 shadow-[0_0_6px_rgba(251,191,36,0.25)]"
                : "border-transparent hover:border-accent-blue/50"
        )}
        title={entry.card.name}
        onClick={() => onViewDetail(entry.card)}
      >
        {imgSrc ? (
          <img src={imgSrc} alt={entry.card.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 bg-surface-raised flex items-center justify-center p-1">
            <span className="text-[7px] text-muted-foreground text-center leading-tight">{entry.card.name}</span>
          </div>
        )}
        {isIllegal && (
          <div className="absolute top-0.5 left-0.5 bg-red-600/90 rounded-sm p-0.5" title="No legal en este formato">
            <AlertTriangle className="h-2 w-2 text-white" />
          </div>
        )}
        {!isIllegal && isOverCopyLimit && (
          <div className="absolute top-0.5 left-0.5 bg-amber-500/90 rounded-sm p-0.5" title="Supera el límite de copias de este formato">
            <AlertTriangle className="h-2 w-2 text-white" />
          </div>
        )}
        {entry.card.isCustomUpload && (
          <div className="absolute top-0.5 right-0.5 bg-black/70 rounded-sm p-0.5" title="Imagen propia">
            <ImagePlus className="h-2 w-2 text-white" />
          </div>
        )}
        {isCommanderCard && (
          <div className="absolute bottom-0 inset-x-0 bg-white text-background text-[8px] font-bold text-center py-0.5 tracking-wide uppercase flex items-center justify-center gap-0.5">
            <Crown className="h-2 w-2" /> Comandante
          </div>
        )}
        {!isCommanderCard && showCopyLabel && (
          <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-white/70 text-[8px] font-bold px-1 py-0.5 rounded-sm leading-none tabular-nums">
            #{copyIndex + 1}
          </div>
        )}
      </div>

      {/* Rule-violation warning popup — shared between mobile menu and desktop overlay */}
      {warningOpen && violationReason && (
        <RuleWarningDialog reason={violationReason} onClose={() => setWarningOpen(false)} />
      )}

      {/* ── Mobile: always-visible three-dots trigger + popup menu ─────────── */}
      <div ref={menuRef} className="sm:hidden">
        <button
          ref={triggerRef}
          onClick={e => { e.stopPropagation(); toggleMenu() }}
          className={cn(
            "absolute top-1 right-1 z-20 h-7 w-7 flex items-center justify-center rounded-full border backdrop-blur-md transition-all duration-150",
            menuOpen
              ? "bg-accent-blue border-accent-blue text-white shadow-lg shadow-accent-blue/40 scale-105"
              : "bg-black/55 border-white/15 text-white/90 shadow-sm active:bg-black/75 active:scale-90"
          )}
          aria-label="Opciones de la carta"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            onClick={e => e.stopPropagation()}
            className={cn(
              "absolute top-9 z-30 w-52 rounded-2xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/70 ring-1 ring-white/5 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150",
              menuAlign === "left" ? "left-1 origin-top-left" : "right-1 origin-top-right"
            )}
          >
            <div className="px-3.5 py-2.5 border-b border-border/50">
              <p className="text-[11px] font-semibold text-foreground truncate">{entry.card.name}</p>
            </div>

            {/* Qty row — hidden only when strict singleton blocks this card */}
            {canAdjustQty && (
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border/50 bg-surface-raised/50">
                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Copias{exempt && singleton ? " · sin límite" : ""}
                </span>
                <div className="flex items-center gap-1 rounded-full bg-surface-raised border border-border p-0.5">
                  <button
                    onClick={() => onQtyChange(entry.id, entry.quantity - 1)}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-foreground hover:bg-background active:scale-90 transition-all"
                    aria-label="Quitar una copia"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-foreground text-xs font-bold w-5 text-center tabular-nums">{entry.quantity}</span>
                  <button
                    onClick={() => onQtyChange(entry.id, Math.min(entry.quantity + 1, effectiveMaxCopies))}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-foreground hover:bg-background active:scale-90 transition-all"
                    aria-label="Agregar una copia"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {hasViolation && violationReason && (
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); setWarningOpen(true) }}
                className="w-full min-h-11 flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-amber-400 active:bg-amber-500/10 transition-colors text-left"
              >
                <span className="h-7 w-7 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                </span>
                No permitida — ver motivo
              </button>
            )}
            {isCommanderFormat && onToggleCommander && (commanderEligible || isCommanderCard) && (
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); onToggleCommander(entry.id) }}
                className={cn(
                  "w-full min-h-11 flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium active:bg-surface-raised transition-colors text-left",
                  hasViolation && violationReason && "border-t border-border/40",
                  isCommanderCard ? "text-white" : commanderEligible ? "text-foreground" : "text-muted-foreground/60"
                )}
              >
                <span className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", isCommanderCard ? "bg-white/15" : "bg-surface-raised border border-border")}>
                  <Crown className={cn("h-3.5 w-3.5", isCommanderCard ? "text-white" : commanderEligible ? "text-muted-foreground" : "text-muted-foreground/40")} />
                </span>
                {isCommanderCard ? "Quitar como comandante" : commanderEligible ? "Marcar como comandante" : "Marcar como comandante (no elegible)"}
              </button>
            )}
            {!entry.card.isCustomUpload && (
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); onChangeArt(entry.card) }}
                className="w-full min-h-11 flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-foreground active:bg-surface-raised transition-colors text-left border-t border-border/40"
              >
                <span className="h-7 w-7 rounded-full bg-accent-blue/15 flex items-center justify-center shrink-0">
                  <Palette className="h-3.5 w-3.5 text-accent-blue" />
                </span>
                Cambiar arte
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onViewDetail(entry.card) }}
              className="w-full min-h-11 flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-foreground active:bg-surface-raised transition-colors text-left border-t border-border/40"
            >
              <span className="h-7 w-7 rounded-full bg-surface-raised border border-border flex items-center justify-center shrink-0">
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              Ver carta
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); onRemove(entry.id) }}
              className="w-full min-h-11 flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-red-400 active:bg-red-500/10 transition-colors text-left border-t border-border/40"
            >
              <span className="h-7 w-7 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <X className="h-3.5 w-3.5 text-red-400" />
              </span>
              Quitar carta
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop: hover overlay ────────────────────────────────────────── */}
      <div
        className="absolute inset-0 rounded-md overflow-hidden bg-gradient-to-t from-black/92 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 hidden sm:flex flex-col justify-end px-1.5 pb-2 gap-1"
        onClick={e => e.stopPropagation()}
      >
        {/* Qty controls — hidden only when strict singleton blocks this card */}
        {canAdjustQty && (
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <button
              onClick={() => onQtyChange(entry.id, entry.quantity - 1)}
              className="h-5 w-5 rounded-md bg-white/15 border border-white/20 text-white flex items-center justify-center hover:bg-red-500/70 active:scale-90 transition-all"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="text-white text-[10px] font-bold w-5 text-center tabular-nums">{entry.quantity}</span>
            <button
              onClick={() => onQtyChange(entry.id, Math.min(entry.quantity + 1, effectiveMaxCopies))}
              className="h-5 w-5 rounded-md bg-white/15 border border-white/20 text-white flex items-center justify-center hover:bg-accent-blue/70 active:scale-90 transition-all"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        )}

        {/* Advertencia de regla — sits above Cambiar arte, never blocks the card */}
        {hasViolation && violationReason && (
          <button
            onClick={() => setWarningOpen(true)}
            className="w-full py-1.5 rounded-md bg-amber-500 text-white text-[9px] font-bold hover:bg-amber-400 active:scale-95 transition-all flex items-center justify-center gap-1 shadow-md"
          >
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
            No permitida
          </button>
        )}

        {/* Marcar/quitar como Comandante — Commander-format decks only. Ineligible
            cards (not legendary) still show the muted action; clicking routes
            through onToggleCommander, which explains why via a popup. */}
        {isCommanderFormat && onToggleCommander && (commanderEligible || isCommanderCard) && (
          <button
            onClick={() => onToggleCommander(entry.id)}
            className={cn(
              "w-full py-1.5 rounded-md text-[9px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1 shadow-md",
              isCommanderCard
                ? "bg-white text-background hover:bg-white/90"
                : commanderEligible
                  ? "bg-white/10 border border-white/20 text-white hover:bg-white/20"
                  : "bg-white/5 border border-white/10 text-white/40 hover:bg-white/10"
            )}
          >
            <Crown className="h-2.5 w-2.5 shrink-0" />
            {isCommanderCard ? "Quitar comandante" : "Marcar comandante"}
          </button>
        )}

        {/* Cambiar arte — primary (not applicable to custom-uploaded images) */}
        {!entry.card.isCustomUpload && (
          <button
            onClick={() => onChangeArt(entry.card)}
            className="w-full py-1.5 rounded-md bg-accent-blue text-white text-[9px] font-bold hover:bg-accent-blue/90 active:scale-95 transition-all flex items-center justify-center gap-1 shadow-md"
          >
            <Palette className="h-2.5 w-2.5 shrink-0" />
            Cambiar arte
          </button>
        )}

        {/* Ver carta + Quitar — side by side */}
        <div className="flex gap-1">
          <button
            onClick={() => onViewDetail(entry.card)}
            className="flex-1 py-1.5 rounded-md bg-white/10 border border-white/15 text-white text-[9px] font-semibold hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <Maximize2 className="h-2.5 w-2.5 shrink-0" />
            Ver carta
          </button>
          <button
            onClick={() => onRemove(entry.id)}
            className="px-2 py-1.5 rounded-md bg-red-600/80 border border-red-500/30 text-white hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center"
            title="Quitar carta"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptySlot({ index, highlight }: { index: number; highlight: boolean }) {
  return (
    <div className={cn(
      "aspect-[63/88] rounded-md border border-dashed flex flex-col items-center justify-center gap-1 transition-all duration-150",
      highlight
        ? "border-accent-blue/70 bg-accent-blue/12 shadow-[inset_0_0_12px_rgba(59,130,246,0.08)]"
        : "border-white/12 bg-white/[0.025]"
    )}>
      <span className={cn(
        "select-none text-[11px] font-bold tabular-nums leading-none",
        highlight ? "text-accent-blue/60" : "text-white/15"
      )}>
        {index + 1}
      </span>
    </div>
  )
}

function DeckNameInput({ value, onChange, hasWarning }: { value: string; onChange: (v: string) => void; hasWarning: boolean }) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setDraft(value) }, [value])
  const commit = () => {
    const final = draft.trim() || "Deck 1"
    onChange(final)
    setDraft(final)
  }
  return (
    <div className="relative flex items-center min-w-0 flex-1">
      {hasWarning && <AlertTriangle className="absolute left-3 h-3.5 w-3.5 text-red-400 shrink-0 pointer-events-none z-10" />}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") { commit(); inputRef.current?.blur() }
          if (e.key === "Escape") { setDraft(value); inputRef.current?.blur() }
        }}
        maxLength={40}
        placeholder="Nombre del deck"
        className={cn(
          "w-full h-9 rounded-lg border bg-surface-raised px-3 text-sm font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-colors",
          hasWarning ? "pl-8 border-red-500/60 focus:border-red-400 text-red-300" : "border-border focus:border-accent-blue hover:border-accent-blue/50"
        )}
      />
    </div>
  )
}

function FormatRulesModal({ formatKey, onClose }: { formatKey: string; onClose: () => void }) {
  const rules = FORMAT_RULES[formatKey]
  const cfg   = GAME_FORMATS.find(f => f.key === formatKey)
  if (!rules) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">{cfg?.label}</h3>
            {cfg?.deckSize && (
              <span className="text-[11px] text-accent-blue font-semibold">{cfg.deckSize} cartas · {cfg.maxCopies === 1 ? "Singleton" : `Hasta ${cfg.maxCopies} copias`}</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{rules.description}</p>
        <ul className="space-y-1.5">
          {rules.rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-accent-blue shrink-0" />
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function FormatTooltip({ formatKey, children }: { formatKey: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rules = FORMAT_RULES[formatKey]
  const cfg   = GAME_FORMATS.find(f => f.key === formatKey)

  const show = () => { timerRef.current = setTimeout(() => setVisible(true), 800) }
  const hide = () => { if (timerRef.current) clearTimeout(timerRef.current); setVisible(false) }

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && rules && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 bg-surface border border-border rounded-lg p-2.5 shadow-xl pointer-events-none">
          <p className="text-[10px] font-bold text-foreground mb-1">{cfg?.label}</p>
          <p className="text-[9px] text-muted-foreground leading-relaxed">{rules.description}</p>
          {cfg?.deckSize && (
            <p className="text-[9px] text-accent-blue font-semibold mt-1">{cfg.deckSize} cartas · {cfg.maxCopies === 1 ? "Singleton" : `Max ${cfg.maxCopies}x`}</p>
          )}
        </div>
      )}
    </div>
  )
}

function FormatSelector({ value, onChange, onShowRules }: { value: GameFormat; onChange: (f: GameFormat) => void; onShowRules: (key: string) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {GAME_FORMATS.map(f => {
        const isActive = value === f.key
        return (
          <div key={f.key} className="flex items-center">
            <FormatTooltip formatKey={f.key}>
              <button
                onClick={() => onChange(f.key)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-bold transition-all duration-150 whitespace-nowrap",
                  isActive ? "rounded-l-md" : "rounded-md",
                  isActive
                    ? "bg-accent-blue text-white shadow-sm"
                    : "bg-surface-raised border border-border text-muted-foreground hover:border-accent-blue/50 hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            </FormatTooltip>
            {isActive && (
              <button
                onClick={() => onShowRules(f.key)}
                className="px-1.5 py-1 rounded-r-md bg-accent-blue/70 text-white hover:bg-accent-blue/90 transition-colors border-l border-white/20"
                title={`Ver reglas de ${f.label}`}
              >
                <HelpCircle className="h-3 w-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Deck setup screen shown on first load ───��────────────────────────────────
// Fills the right panel. User picks format, name, optional description, then
// confirms to unlock the builder. The left search panel is blurred until done.

const FORMAT_ICONS: Record<string, string> = {
  singles:     "◆",
  commander:   "⚔",
  standard:    "★",
  pioneer:     "◎",
  modern:      "⬡",
  legacy:      "∞",
  vintage:     "♾",
  pauper:      "◇",
  oathbreaker: "⊕",
  brawl:       "⚡",
  historic:    "⌛",
}

// Representative card art for each format banner — Scryfall named card API for stable access
const FORMAT_BANNERS: Record<string, string> = {
  singles:     "https://api.scryfall.com/cards/named?exact=Lightning+Bolt&set=m10&format=image&version=art_crop",
  commander:   "https://api.scryfall.com/cards/named?exact=Sol+Ring&set=c21&format=image&version=art_crop",
  standard:    "https://api.scryfall.com/cards/named?exact=Atraxa%2C+Grand+Unifier&format=image&version=art_crop",
  pioneer:     "https://api.scryfall.com/cards/named?exact=Thoughtseize&set=ths&format=image&version=art_crop",
  modern:      "https://api.scryfall.com/cards/named?exact=Snapcaster+Mage&format=image&version=art_crop",
  legacy:      "https://api.scryfall.com/cards/named?exact=Force+of+Will&set=all&format=image&version=art_crop",
  vintage:     "https://api.scryfall.com/cards/named?exact=Black+Lotus&format=image&version=art_crop",
  pauper:      "https://api.scryfall.com/cards/named?exact=Counterspell&set=7ed&format=image&version=art_crop",
  oathbreaker: "https://api.scryfall.com/cards/named?exact=Nicol+Bolas%2C+Dragon-God&format=image&version=art_crop",
  brawl:       "https://api.scryfall.com/cards/named?exact=Moxfield+Brawl+Champion&format=image&version=art_crop",
  historic:    "https://api.scryfall.com/cards/named?exact=Atraxa%2C+Praetors+Voice&format=image&version=art_crop",
}

interface DeckSetupScreenProps {
  name: string
  onNameChange: (v: string) => void
  format: GameFormat
  onFormatChange: (f: GameFormat) => void
  relaxedRules: boolean
  onRelaxedRulesChange: (v: boolean) => void
  onConfirm: () => void
  onShowRules: (key: string) => void
}

// ── Draft picker — shown when drafts exist before creating a new deck ────────
interface DraftPickerProps {
  drafts: DeckItem[]
  onResume: (id: string) => void
  onDelete: (id: string) => void
  onNewDeck: () => void
}

function DraftPicker({ drafts, onResume, onDelete, onNewDeck }: DraftPickerProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border">
        <p className="text-[10px] font-bold tracking-widest uppercase text-amber-400 mb-1">Borradores guardados</p>
        <h2 className="text-lg font-bold text-foreground">Terminar mazos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tenes decks sin terminar. Continualos o empieza uno nuevo.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {drafts.map(draft => {
          const cover = draft.coverCard ?? draft.entries[0]?.card
          const fmtCfg = GAME_FORMATS.find(f => f.key === draft.format)
          const cardCount = draft.entries.reduce((s, e) => s + e.quantity, 0)
          const target = fmtCfg?.deckSize
          const pct = target ? Math.min(100, Math.round((cardCount / target) * 100)) : null

          return (
            <div
              key={draft.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-raised hover:border-accent-blue/40 transition-colors group"
            >
              {/* Cover art */}
              <div className="h-14 w-10 shrink-0 rounded-lg overflow-hidden bg-surface border border-border">
                {cover?.image_uris?.border_crop ? (
                  <img
                    src={cover.image_uris.border_crop}
                    alt={cover.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground/30 text-lg">
                    {FORMAT_ICONS[draft.format]}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{draft.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {FORMAT_ICONS[draft.format]} {fmtCfg?.label ?? draft.format}
                  {" · "}
                  <span className="tabular-nums">{cardCount}</span>
                  {target && <span className="text-muted-foreground/50">/{target}</span>} cartas
                </p>
                {pct !== null && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-blue transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onResume(draft.id)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
                >
                  Continuar
                </button>
                <button
                  onClick={() => onDelete(draft.id)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="Eliminar borrador"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* New deck CTA */}
      <div className="shrink-0 px-5 py-4 border-t border-border bg-surface">
        <button
          onClick={onNewDeck}
          className="w-full h-11 border border-accent-blue/40 text-accent-blue font-bold text-sm rounded-xl hover:bg-accent-blue/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          Crear deck nuevo
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Deck setup screen — format carousel + name/description ──��─���──────────────
function DeckSetupScreen({
  name, onNameChange, format, onFormatChange, relaxedRules, onRelaxedRulesChange, onConfirm,
}: Omit<DeckSetupScreenProps, "onShowRules" | "description" | "onDescChange">) {
  const [carouselIdx, setCarouselIdx] = useState(
    () => Math.max(0, GAME_FORMATS.findIndex(f => f.key === format))
  )

  // Keep format in sync with selected index
  useEffect(() => {
    onFormatChange(GAME_FORMATS[carouselIdx].key)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselIdx])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border">
        <p className="text-[10px] font-bold tracking-widest uppercase text-accent-blue mb-1">Nuevo deck</p>
        <h2 className="text-lg font-bold text-foreground">Configurá tu deck</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Elegí formato y nombre para empezar a buscar cartas.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            Nombre del deck
          </label>
          <input
            type="text"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="Mi deck Commander..."
            maxLength={40}
            autoFocus
            className="w-full h-10 bg-surface-raised border border-border rounded-lg px-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent-blue transition-colors"
          />
        </div>

        {/* Format carousel — scrollable horizontal selection */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            Modalidad de juego
          </label>
          
          {/* Carousel container */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 snap-x snap-mandatory">
            {GAME_FORMATS.map((fmt, i) => {
              const isSelected = i === carouselIdx
              return (
                <button
                  key={fmt.key}
                  onClick={() => setCarouselIdx(i)}
                  className={cn(
                    "flex-shrink-0 w-32 transition-all duration-200 snap-center",
                    isSelected ? "opacity-100" : "opacity-60 hover:opacity-80"
                  )}
                >
                  {/* Card with background */}
                  <div className={cn(
                    "relative rounded-lg overflow-hidden aspect-[2/3] border-2 transition-all duration-200 group",
                    isSelected
                      ? "border-accent-blue ring-2 ring-accent-blue/30 shadow-lg shadow-accent-blue/20"
                      : "border-border/50 hover:border-accent-blue/50"
                  )}>
                    {/* Art background */}
                    {FORMAT_BANNERS[fmt.key] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={FORMAT_BANNERS[fmt.key]}
                        aria-hidden
                        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-surface-raised" />
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-accent-blue flex items-center justify-center">
                        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M10 3L5 9 2 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}

                    {/* Label */}
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-[10px] font-bold text-white leading-tight truncate drop-shadow">{fmt.label}</p>
                    </div>
                  </div>

                  {/* Description below card */}
                  <div className="mt-2 text-center">
                    <p className={cn(
                      "text-[10px] font-semibold leading-tight transition-colors",
                      isSelected ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {fmt.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* Sticky CTA */}
      <div className="shrink-0 px-5 py-4 border-t border-border bg-surface space-y-3">
        {/* Highlight-violations toggle — ON (amber, default) flags cards that break the
            format's rules; OFF is free mode with zero warnings. Never blocks adding a
            card either way — this is guidance, not enforcement. Internally still backed
            by the `relaxedRules` field (relaxedRules=false → highlighting ON). */}
        {format !== "singles" && (
          <button
            type="button"
            onClick={() => onRelaxedRulesChange(!relaxedRules)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
              !relaxedRules
                ? "border-amber-500/40 bg-amber-500/8"
                : "border-border/60 bg-surface-raised hover:border-border"
            )}
          >
            {/* Toggle pill */}
            <div className={cn(
              "relative shrink-0 h-5 w-9 rounded-full transition-colors duration-200",
              !relaxedRules ? "bg-amber-500" : "bg-border"
            )}>
              <div className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200",
                !relaxedRules ? "left-[18px]" : "left-0.5"
              )} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className={cn(
                "text-[12px] font-bold leading-tight",
                !relaxedRules ? "text-amber-400" : "text-muted-foreground"
              )}>
                Resaltar reglas del formato
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-snug">
                {!relaxedRules
                  ? "Marca cartas ilegales o que superan el límite de copias"
                  : "Modo libre — sin avisos de singleton, tamaño ni legalidad"
                }
              </p>
            </div>
          </button>
        )}

        <button
          onClick={onConfirm}
          disabled={!name.trim()}
          className="w-full h-11 bg-accent-blue text-white font-bold text-sm rounded-xl hover:bg-accent-blue/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          Empezar a armar el deck
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function MazoInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") ?? ""
  const deckIdParam = searchParams.get("id") ?? ""
  const setupParam = searchParams.get("setup") === "true"

  const {
  entries, addCard, removeCard, setQuantity, replaceAll, updatePrint,
  totalCards, saveBuilderToCart, editingCartDeckId, builderDeck,
  setBuilderName, completeBuilderSetup, setRelaxedRules, setCommander, hydrated, resetBuilder,
  cartDecks, saveSideboardToCart, removeDeck, editCartDeck, editPreconDeck,
} = usePrintStore()

  // Auto-load deck from URL param (when clicking a deck from the sidebar)
  // Default to deck browser view if no deck is selected
  // Auto-load setup screen if setup=true parameter
  useEffect(() => {
    if (hydrated) {
      if (setupParam) {
        // setup=true: show setup screen directly
        setShowDeckboxView(false)
      } else if (deckIdParam) {
        const deck = cartDecks.find(d => d.id === deckIdParam)
        if (deck) {
          if (deck.type === "precon") editPreconDeck(deckIdParam)
          else editCartDeck(deckIdParam)
          setShowDeckboxView(false)
        }
      } else {
        // No deck param or setup param: show deck browser by default (unless actively editing)
        if (!editingCartDeckId) {
          setShowDeckboxView(true)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, setupParam, deckIdParam])

  // Sideboard mode: when builderDeck.sideboardMode is true, the deck panel
  // shows a sideboard zone (up to 15 extra cards) instead of full deck editing.
  const isSideboardMode = builderDeck.sideboardMode === true && !!editingCartDeckId
  const [sideboardEntries, setSideboardEntries] = useState<PrintListEntry[]>([])

  // Load sideboard from the cart deck when entering sideboard mode
  useEffect(() => {
    if (isSideboardMode && editingCartDeckId) {
      const cartDeck = cartDecks.find(d => d.id === editingCartDeckId)
      setSideboardEntries(cartDeck?.sideboard ?? [])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSideboardMode, editingCartDeckId])

  const sideboardTotal = sideboardEntries.reduce((s, e) => s + e.quantity, 0)
  const SIDEBOARD_MAX  = 15

  function addToSideboard(card: ScryfallCard) {
    const id  = card.oracle_id ?? card.name
    const cur = sideboardEntries.find(e => e.id === id)
    if (cur) {
      if (sideboardTotal >= SIDEBOARD_MAX) return
      setSideboardEntries(prev => prev.map(e => e.id === id ? { ...e, quantity: e.quantity + 1 } : e))
    } else {
      if (sideboardEntries.length >= SIDEBOARD_MAX || sideboardTotal >= SIDEBOARD_MAX) return
      setSideboardEntries(prev => [...prev, { id, card, quantity: 1 }])
    }
  }

  function removeFromSideboard(id: string) {
    setSideboardEntries(prev => prev.filter(e => e.id !== id))
  }

  function saveSideboard() {
    if (!editingCartDeckId) return
    saveSideboardToCart(editingCartDeckId, sideboardEntries)
    router.push("/deckbox")
  }

  const [showImport,    setShowImport]    = useState(false)
  const [importText,    setImportText]    = useState("")
  const [cartPanelOpen,    setCartPanelOpen]    = useState(false)
  const [mobileTab,        setMobileTab]        = useState<"search" | "deck">("search")
  const [showDeckboxView, setShowDeckboxView]   = useState(false)
  const [deletingDeckId, setDeletingDeckId]     = useState<string | null>(null)
  const [detailCard,    setDetailCard]    = useState<ScryfallCard | null>(null)
  const [detailEntry,   setDetailEntry]   = useState<PrintListEntry | undefined>(undefined)
  const [isDragOver,    setIsDragOver]    = useState(false)
  const [showRulesFor,  setShowRulesFor]  = useState<string | null>(null)
  const [savedFlash,    setSavedFlash]    = useState(false)

  // Local setup wizard state (transient — not persisted until confirmed)
  const [setupName,          setSetupName]          = useState("Deck 1")
  const [setupFormat,        setSetupFormat]        = useState<GameFormat>("commander")
  const [setupRelaxedRules,  setSetupRelaxedRules]  = useState(false)

  // Sync local name when deck name changes (e.g. coming back to an in-progress deck)
  useEffect(() => {
    if (hydrated && builderDeck.name) setSetupName(builderDeck.name)
  }, [hydrated, builderDeck.name])

  // Show setup screen when: hydrated + deck has never had setup completed
  const isSetupRequired = hydrated && !builderDeck.setupCompleted

  const handleConfirmSetup = useCallback(() => {
    completeBuilderSetup(setupName, setupFormat, setupRelaxedRules)
    setMobileTab("search")
  }, [setupName, setupFormat, setupRelaxedRules, completeBuilderSetup])

  // relaxedRules: true → bypass singleton, deck size cap, maxCopies, and legality checks
  const relaxedRules = builderDeck.relaxedRules ?? false

  const formatConfig     = GAME_FORMATS.find(f => f.key === (builderDeck.setupCompleted ? builderDeck.format : setupFormat))
  const singleton        = relaxedRules ? false : isSingleton(formatConfig)
  const deckSize         = relaxedRules ? 0 : getDeckSize(formatConfig)
  const maxCopies        = relaxedRules ? 99 : (formatConfig?.maxCopies ?? 99)
  const isUnlimited      = relaxedRules || formatConfig?.key === "singles"
  // Commander allows any land (not just basics) to repeat freely, ignoring singleton
  const isCommanderFormat = formatConfig?.key === "commander"

  const illegalEntryIds = useMemo(() => {
    if (relaxedRules || !formatConfig?.legalityKey) return new Set<string>()
    const key = formatConfig.legalityKey
    return new Set(entries.filter(e => {
      // Custom-uploaded "cards" have no real Scryfall legality — never flag them as illegal.
      if (e.card.isCustomUpload) return false
      const s = e.card.legalities?.[key]
      return s !== undefined && s !== "legal"
    }).map(e => e.id))
  }, [relaxedRules, entries, formatConfig])

  const hasLegalityWarning = illegalEntryIds.size > 0

  // Cards whose quantity breaks the active format's copy-limit rule (e.g. a 2nd
  // copy in a singleton format, or a 5th copy where the format caps at 4).
  // This is guidance only — the amber border warns the player without blocking
  // them from keeping the extra copies.
  const copyLimitEntryIds = useMemo(() => {
    if (relaxedRules || maxCopies >= 99) return new Set<string>()
    return new Set(entries.filter(e => {
      if (isSingletonExempt(e.card, isCommanderFormat)) return false
      return e.quantity > maxCopies
    }).map(e => e.id))
  }, [relaxedRules, entries, maxCopies, isCommanderFormat])

  // The deck's marked Commander (Commander-format decks only)
  const commanderEntryId = isCommanderFormat ? (builderDeck.commanderEntryId ?? null) : null

  // Info/confirm popup for Commander assignment — either explains why a card
  // is ineligible (dismiss-only) or asks to replace the current Commander
  // since only one is allowed per deck (confirm-to-replace).
  const [commanderDialog, setCommanderDialog] = useState<
    { kind: "ineligible"; reason: string } | { kind: "replace"; entryId: string; currentName: string } | null
  >(null)

  const toggleCommander = useCallback((entryId: string) => {
    // Unmarking the current Commander never needs validation.
    if (entryId === commanderEntryId) {
      setCommander(entryId)
      return
    }
    const target = entries.find(e => e.id === entryId)
    if (!target) return

    const ineligibleReason = getCommanderIneligibleReason(target.card)
    if (ineligibleReason) {
      setCommanderDialog({ kind: "ineligible", reason: ineligibleReason })
      return
    }

    // Only one Commander is admitted per deck — ask before replacing an existing one.
    if (commanderEntryId) {
      const current = entries.find(e => e.id === commanderEntryId)
      setCommanderDialog({ kind: "replace", entryId, currentName: current?.card.name ?? "el comandante actual" })
      return
    }

    setCommander(entryId)
  }, [commanderEntryId, entries, setCommander])

  // Human-readable reason each rule-breaking entry violates the active format —
  // powers the warning popup on both the deck-slot and search-result buttons.
  const violationReasonByEntryId = useMemo(() => {
    const map = new Map<string, string>()
    if (relaxedRules || !formatConfig) return map
    for (const e of entries) {
      const reason = getRuleViolationReason(e.card, formatConfig, {
        alreadyInDeck: copyLimitEntryIds.has(e.id),
        isCommanderFormat,
      })
      if (reason) map.set(e.id, reason)
    }
    return map
  }, [relaxedRules, formatConfig, entries, copyLimitEntryIds, isCommanderFormat])

  const filledSlots        = useMemo(() => buildSlots(entries, singleton, isCommanderFormat, commanderEntryId), [entries, singleton, isCommanderFormat, commanderEntryId])
  // Use slot count so basic land copies in Commander count toward the total (e.g. 6 Forest = 6 slots)
  const filledCount        = filledSlots.length
  const SINGLES_MIN        = 30

  // meetsMinimum: whether the deck satisfies format/quantity requirements to be considered "complete"
  const meetsMinimum       = isUnlimited ? totalCards >= SINGLES_MIN : filledCount >= deckSize
  // canAddToDeckbox: allow adding to deckbox as long as there are any cards (shows warnings otherwise)
  const canAddToDeckbox    = builderDeck.setupCompleted && totalCards > 0

  // Legacy alias used in progress + empty-slot rendering
  const canSave            = meetsMinimum
  const emptyCount         = isUnlimited ? 0 : Math.max(0, deckSize - filledCount)

  // Format-level warnings shown in yellow (non-blocking)
  const formatWarnings = useMemo<string[]>(() => {
    const w: string[] = []
    if (!builderDeck.setupCompleted || totalCards === 0) return w
    // When relaxed rules are active, skip all format-specific warnings
    if (relaxedRules) return w
    if (isUnlimited && totalCards < SINGLES_MIN) {
      w.push(`Mínimo ${SINGLES_MIN} cartas para el pedido (tenés ${totalCards})`)
    }
    if (!isUnlimited && filledCount < deckSize) {
      w.push(`Faltan ${deckSize - filledCount} carta${deckSize - filledCount !== 1 ? "s" : ""} para completar el mazo`)
    }
    if (singleton && entries.some(e => !isSingletonExempt(e.card, isCommanderFormat) && e.quantity > 1)) {
      w.push("Hay cartas repetidas (formato singleton solo permite 1 copia por carta)")
    }
    return w
  }, [relaxedRules, builderDeck.setupCompleted, totalCards, isUnlimited, filledCount, deckSize, singleton, entries, isCommanderFormat])

  const handleManualSave = useCallback(() => {
    saveBuilderToCart(builderDeck.name || "Deck 1")
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)
  }, [saveBuilderToCart, builderDeck.name])

  // Derive whether this builder deck is already saved in cart (for real-time AÑADIDO state)
  const builderDeckInCart = useMemo(() => {
    if (!canAddToDeckbox) return false
    return cartDecks.some(d => d.id === editingCartDeckId || d.name === (builderDeck.name || "Deck 1"))
  }, [cartDecks, editingCartDeckId, builderDeck, canAddToDeckbox])

  // Format rules (singleton, copy limits) are guidance, not enforcement — the player
  // can always add the quantity they asked for. Cards that break the active format's
  // rules get flagged with an amber warning (see copyLimitEntryIds) instead of having
  // the add silently capped or dropped.
  const handleAddCard = useCallback((card: ScryfallCard, qty = 1) => {
  addCard(card, qty)
  setMobileTab("deck")
  }, [addCard])

  const handleImport = useCallback((cards: { card: ScryfallCard; quantity: number }[], replace: boolean) => {
    if (replace) {
      // For replace, enforce singleton but respect basic lands (and, in Commander, any land)
      if (singleton) {
        const deduplicated = cards.map(({ card, quantity }) => ({
          card,
          quantity: isSingletonExempt(card, isCommanderFormat) ? quantity : 1,
        }))
        replaceAll(deduplicated)
      } else {
        replaceAll(cards)
      }
    } else {
      cards.forEach(({ card, quantity }) => handleAddCard(card, quantity))
    }
  }, [replaceAll, handleAddCard, singleton, isCommanderFormat])

  const openDetail = useCallback((card: ScryfallCard) => {
    const existing = entries.find(e => e.card.oracle_id === card.oracle_id || e.card.name === card.name)
    setDetailEntry(existing)
    setDetailCard(card)
  }, [entries])

  const closeDetail = useCallback(() => { setDetailCard(null); setDetailEntry(undefined) }, [])
  const deckIds = useMemo<Set<string>>(() => new Set(entries.map(e => e.card.oracle_id ?? e.card.name)), [entries])
  const [deckView, setDeckView] = useState<"grid" | "category">("grid")

  // Group entries by card type category for category view
  const CATEGORY_ORDER = ["Comandante", "Criaturas", "Hechizos", "Artefactos", "Encantamientos", "Tierras", "Otros"]
  const groupedEntries = useMemo(() => {
    const groups: Record<string, PrintListEntry[]> = {}
    CATEGORY_ORDER.forEach(k => { groups[k] = [] })
    for (const entry of entries) {
      const t = (entry.card.type_line ?? "").toLowerCase()
      if (t.includes("legendary") && (entry.card as any).isCommander) groups["Comandante"].push(entry)
      else if (t.includes("creature")) groups["Criaturas"].push(entry)
      else if (t.includes("instant") || t.includes("sorcery")) groups["Hechizos"].push(entry)
      else if (t.includes("artifact")) groups["Artefactos"].push(entry)
      else if (t.includes("enchantment")) groups["Encantamientos"].push(entry)
      else if (t.includes("land")) groups["Tierras"].push(entry)
      else groups["Otros"].push(entry)
    }
    return groups
  }, [entries])

  return (
    <div className="bg-background">
      <Navbar
        onCartClick={undefined}
        onAddDeck={undefined}
        deckJustAdded={false}
      />

      <div className="fixed inset-0 top-14 flex flex-col md:flex-row overflow-hidden">

        {/* LEFT / SEARCH PANEL — desktop side-by-side, mobile top strip */}
        <main
          className={cn(
            "flex flex-col overflow-hidden min-w-0 bg-background border-r border-border relative",
            "md:flex-1 md:max-w-[50%]",
            isSetupRequired
              ? showDeckboxView ? "hidden md:flex md:flex-1 md:max-w-[50%]" : "hidden md:flex md:flex-1 md:max-w-[50%]"
              : "shrink-0 w-full md:shrink md:flex-1"
          )}
        >
          {/* Nudge overlay: shown when setup is not yet done (desktop only) */}
          {isSetupRequired && (
            <div className="hidden md:flex absolute inset-0 z-10 bg-background/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 px-8 text-center pointer-events-none">
              <div className="h-12 w-12 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-accent-blue" />
              </div>
              <p className="text-sm font-bold text-foreground">Configura tu deck primero</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                Elegí un formato y ponele un nombre a tu deck antes de empezar a buscar cartas.
              </p>
            </div>
          )}
          <div className={cn("flex-1 overflow-hidden px-4 py-3 min-h-0", isSetupRequired && "hidden md:flex md:flex-col")}>
            <SearchPanel
              deckIds={deckIds}
              deckId={builderDeck.id}
              onAddCard={isSetupRequired ? () => {} : isSideboardMode ? (card) => { addToSideboard(card) } : handleAddCard}
              onViewDetail={isSetupRequired ? () => {} : openDetail}
              onOpenImport={(text) => { setImportText(text ?? ""); setShowImport(true) }}
  initialQuery={initialQuery}
  formatConfig={formatConfig}
  relaxedRules={relaxedRules}
  />
          </div>
        </main>

        {/* RIGHT / DECK PANEL — desktop side-by-side, mobile fills remaining height */}
        <aside
          className={cn(
            "overflow-hidden flex flex-col relative",
            "md:shrink-0 md:flex-1 md:max-w-[50%]",
            isSetupRequired
              ? "flex-1 w-full"
              : "flex-1 w-full min-h-0"
          )}
          aria-label="Deck activo"
          onDragOver={e => { if (!isSetupRequired) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setIsDragOver(true) } }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => {
            if (isSetupRequired) return
            e.preventDefault(); setIsDragOver(false)
            const raw = e.dataTransfer.getData("application/proxie-card")
            if (!raw) return
            try { const { card, qty } = JSON.parse(raw) as { card: ScryfallCard; qty: number }; handleAddCard(card, qty ?? 1) } catch { /* ignore */ }
          }}
        >
          {/* Deck browser view — show list of decks (in mobile, always show when no deck editing) */}
          {showDeckboxView ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
                <p className="text-sm font-bold text-foreground">Mis mazos</p>
                <p className="text-xs text-muted-foreground">Click en un mazo para editar</p>
              </div>
              {/* Deck list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Create new deck button */}
                <button
                  onClick={() => { resetBuilder(); setShowDeckboxView(false) }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-accent-blue/40 bg-accent-blue/5 hover:border-accent-blue/70 hover:bg-accent-blue/10 transition-all group"
                >
                  <div className="w-10 h-14 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center group-hover:bg-accent-blue/20 transition-colors">
                    <Plus className="h-5 w-5 text-accent-blue" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-bold text-accent-blue leading-tight">Crear nuevo deck</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Elegí formato y empezá a armar</p>
                  </div>
                </button>

                {cartDecks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
                    <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground/60">No hay mazos aún</p>
                    <p className="text-xs text-muted-foreground/40">Crea uno nuevo para empezar</p>
                  </div>
                ) : (
                  <>
                    {/* Singles */}
                    {cartDecks.filter(d => d.type === "singles").length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Singles</p>
                        <div className="space-y-2">
                          {cartDecks.filter(d => d.type === "singles").map(deck => (
                            <DeckRowItem
                              key={deck.id}
                              deck={deck}
                              acceptDrop={true}
                              onClick={() => { editCartDeck(deck.id); setShowDeckboxView(false) }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Precons */}
                    {cartDecks.filter(d => d.type === "precon").length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Decks preconstruidos</p>
                        <div className="space-y-2">
                          {cartDecks.filter(d => d.type === "precon").map(deck => (
                            <DeckRowItem
                              key={deck.id}
                              deck={deck}
                              acceptDrop={true}
                              onClick={() => { editPreconDeck(deck.id); setShowDeckboxView(false) }}
                              onRemove={deletingDeckId === deck.id
                                ? () => { removeDeck(deck.id); setDeletingDeckId(null) }
                                : () => setDeletingDeckId(deck.id)
                              }
                              isConfirmingDelete={deletingDeckId === deck.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Customs */}
                    {cartDecks.filter(d => d.type === "custom").length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Mis decks</p>
                        <div className="space-y-2">
                          {cartDecks.filter(d => d.type === "custom").map(deck => (
                            <DeckRowItem
                              key={deck.id}
                              deck={deck}
                              acceptDrop={true}
                              onClick={() => { editCartDeck(deck.id); setShowDeckboxView(false) }}
                              onRemove={deletingDeckId === deck.id
                                ? () => { removeDeck(deck.id); setDeletingDeckId(null) }
                                : () => setDeletingDeckId(deck.id)
                              }
                              isConfirmingDelete={deletingDeckId === deck.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : isSetupRequired ? (
            <div className="flex flex-col">
              <DeckSetupScreen
                name={setupName}
                onNameChange={setSetupName}
                format={setupFormat}
                onFormatChange={setSetupFormat}
                relaxedRules={setupRelaxedRules}
                onRelaxedRulesChange={setSetupRelaxedRules}
                onConfirm={handleConfirmSetup}
              />
            </div>
          ) : isSideboardMode ? (
          <>
          {/* ── Sideboard mode ────────────���────────────────────────────── */}
          <div className="shrink-0 border-b border-border bg-amber-950/30 px-4 py-3 flex items-center gap-3">
            <Swords className="h-4 w-4 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Editando sideboard</p>
              <p className="text-xs text-muted-foreground">{builderDeck.name} · {sideboardTotal} / {SIDEBOARD_MAX} cartas</p>
            </div>
            <button
              onClick={saveSideboard}
              className="flex items-center gap-1.5 h-8 px-3 bg-accent-gold text-background text-xs font-bold rounded-lg hover:brightness-105 transition-all"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar
            </button>
          </div>

          {/* Sideboard progress bar */}
          <div className="shrink-0 px-4 py-2 bg-surface/50 border-b border-border/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Sideboard</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{sideboardTotal} / {SIDEBOARD_MAX}</span>
            </div>
            <div className="h-1 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-accent-gold transition-all duration-300 rounded-full"
                style={{ width: `${(sideboardTotal / SIDEBOARD_MAX) * 100}%` }}
              />
            </div>
          </div>

          {/* Sideboard card list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {sideboardEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
                <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center">
                  <Swords className="h-4 w-4 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground/60">
                  Buscá cartas y agregálas al sideboard
                </p>
                <p className="text-xs text-muted-foreground/40">Máximo 15 cartas</p>
              </div>
            ) : (
              sideboardEntries.map(entry => {
                const img = entry.selectedPrint?.image_uris?.small ?? entry.card.image_uris?.small ?? entry.card.card_faces?.[0]?.image_uris?.small
                return (
                  <div key={entry.id} className="flex items-center gap-2.5 bg-surface/50 rounded-lg px-3 py-2 border border-border/40">
                    {img && <img src={img} alt={entry.card.name} className="h-9 w-6 rounded object-cover shrink-0" loading="lazy" />}
                    <span className="flex-1 text-xs font-medium text-foreground truncate">{entry.card.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          if (entry.quantity <= 1) removeFromSideboard(entry.id)
                          else setSideboardEntries(prev => prev.map(e => e.id === entry.id ? { ...e, quantity: e.quantity - 1 } : e))
                        }}
                        className="h-5 w-5 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent-gold/40 transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs tabular-nums w-4 text-center text-foreground font-bold">{entry.quantity}</span>
                      <button
                        onClick={() => { if (sideboardTotal < SIDEBOARD_MAX) setSideboardEntries(prev => prev.map(e => e.id === entry.id ? { ...e, quantity: e.quantity + 1 } : e)) }}
                        disabled={sideboardTotal >= SIDEBOARD_MAX}
                        className="h-5 w-5 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent-gold/40 transition-colors disabled:opacity-30"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeFromSideboard(entry.id)} className="ml-1 p-0.5 text-muted-foreground hover:text-red-400 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Sideboard footer */}
          <div className="shrink-0 border-t border-border bg-surface px-3 py-3">
            <button
              onClick={saveSideboard}
              disabled={sideboardTotal === 0}
              className="w-full h-9 bg-accent-gold text-background text-sm font-bold rounded-xl hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar sideboard ({sideboardTotal} cartas)
            </button>
          </div>
          </>
          ) : (
          <>
          {/* Header */}
          <div className="shrink-0 border-b border-border bg-surface px-3 py-2">
            <div className="flex items-center gap-2">
              {/* Back to deckbox / deck list */}
              <button
                onClick={() => setShowDeckboxView(v => !v)}
                className={cn(
                  "shrink-0 h-10 w-10 flex items-center justify-center rounded-xl border transition-colors",
                  showDeckboxView
                    ? "border-accent-blue/60 bg-accent-blue/10 text-accent-blue"
                    : "border-border bg-surface-raised text-muted-foreground hover:text-foreground hover:border-accent-blue/40"
                )}
                title={showDeckboxView ? "Ver este deck" : "Ver mis mazos"}
              >
                <ChevronLeft className={cn("h-4 w-4 transition-transform", showDeckboxView && "rotate-180")} />
              </button>
              <DeckNameInput value={builderDeck.name || "Deck 1"} onChange={setBuilderName} hasWarning={hasLegalityWarning} />
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Format badge — same height as search input */}
                <button
                  onClick={() => setShowRulesFor(builderDeck.format ?? "singles")}
                  className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-surface-raised border border-border text-[12px] font-bold text-foreground hover:border-accent-blue/40 hover:text-accent-blue transition-colors"
                  title="Ver reglas del formato"
                >
                  <span className="hidden sm:contents">
                    {FORMAT_ICONS[builderDeck.format ?? "singles"]}
                    <span>{formatConfig?.label ?? "Singles"}</span>
                  </span>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              {/* Highlight-violations toggle — only for non-singles formats. ON (amber,
                  default) flags rule-breaking cards without ever blocking them. */}
              {builderDeck.format !== "singles" && (
                <button
                  onClick={() => setRelaxedRules(!relaxedRules)}
                  title={!relaxedRules ? "Resaltando reglas — click para modo libre" : "Modo libre — click para resaltar reglas del formato"}
                  className={cn(
                    "h-10 w-10 flex items-center justify-center rounded-xl border transition-colors",
                    !relaxedRules
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                      : "border-border bg-surface-raised text-muted-foreground/50 hover:text-muted-foreground hover:border-border"
                  )}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                </button>
              )}
                {/* View toggle */}
                <div className="flex items-center gap-0.5 bg-surface-raised rounded-xl border border-border p-0.5 h-10">
                  <button
                    onClick={() => setDeckView("grid")}
                    title="Vista cuadrícula"
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                      deckView === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeckView("category")}
                    title="Vista por categorías"
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                      deckView === "category" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Rows3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-20 bg-accent-blue/10 border-2 border-accent-blue/50 rounded flex items-center justify-center pointer-events-none">
              <span className="text-sm font-bold text-accent-blue">Suelta para agregar al deck</span>
            </div>
          )}

          {/* Legality banner — red, illegal cards */}
          {hasLegalityWarning && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-red-950/70 border-b border-red-500/30 text-red-400 text-[11px]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span><strong>{illegalEntryIds.size}</strong> carta{illegalEntryIds.size !== 1 ? "s no son legales" : " no es legal"} en <strong>{formatConfig?.label}</strong></span>
            </div>
          )}





          {/* Deckbox view — shown when back button is toggled */}
          {showDeckboxView && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {/* Crear nuevo deck — always first */}
              <button
                onClick={() => { resetBuilder(); setShowDeckboxView(false) }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-accent-blue/40 bg-accent-blue/5 hover:border-accent-blue/70 hover:bg-accent-blue/10 transition-all group text-left"
              >
                <div className="w-9 h-12 rounded-lg bg-accent-blue/10 border border-accent-blue/20 shrink-0 flex items-center justify-center group-hover:bg-accent-blue/20 transition-colors">
                  <Plus className="h-5 w-5 text-accent-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-accent-blue leading-tight">Crear nuevo deck</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Elegí formato y empezá a armar</p>
                </div>
                <ChevronRight className="h-4 w-4 text-accent-blue/40 group-hover:text-accent-blue/70 shrink-0 transition-colors" />
              </button>

              {cartDecks.map(deck => (
                <DeckRowItem
                  key={deck.id}
                  deck={deck}
                  acceptDrop={true}
                  compact={true}
                  onClick={() => {
                    if (deck.type === "precon") editPreconDeck(deck.id)
                    else editCartDeck(deck.id)
                    setShowDeckboxView(false)
                  }}
                  onRemove={deck.type === "singles" ? undefined : () => {
                    if (deletingDeckId === deck.id) {
                      removeDeck(deck.id)
                      setDeletingDeckId(null)
                    } else {
                      setDeletingDeckId(deck.id)
                      setTimeout(() => setDeletingDeckId(null), 3000)
                    }
                  }}
                  isConfirmingDelete={deletingDeckId === deck.id}
                />
              ))}
            </div>
          )}

          {/* Gallery */}
          {!showDeckboxView && <div className="flex-1 overflow-y-auto p-2">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
                <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground/60">
                  {isUnlimited ? "Agrega cartas para armar tu pedido" : `Agrega cartas — ${deckSize} slots disponibles`}
                </p>
                <p className="text-xs text-muted-foreground/40">Buscá, arrastrá o usá el botón Agregar</p>
              </div>
            ) : deckView === "category" ? (
              /* ── Category view: horizontal carousels per type ── */
              <div className="space-y-4 pb-2">
                {CATEGORY_ORDER.map(cat => {
                  const catEntries = groupedEntries[cat]
                  if (!catEntries.length) return null
                  const catSlots = buildSlots(catEntries, singleton, isCommanderFormat, commanderEntryId)
                  const total = catEntries.reduce((s, e) => s + e.quantity, 0)
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cat}</span>
                        <span className="text-[10px] text-muted-foreground bg-surface-raised px-1.5 py-0.5 rounded-full border border-border">{total}</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {catSlots.map(slot => (
                          <div key={`${slot.entry.id}-copy-${slot.copyIndex}`} className="shrink-0 w-[128px]">
                            <FilledSlot
                              slot={slot}
                              singleton={singleton}
                              maxCopies={maxCopies}
                              isCommanderFormat={isCommanderFormat}
                              onRemove={removeCard}
                              onQtyChange={setQuantity}
                              isIllegal={illegalEntryIds.has(slot.entry.id)}
                              isOverCopyLimit={copyLimitEntryIds.has(slot.entry.id)}
                              violationReason={violationReasonByEntryId.get(slot.entry.id) ?? null}
                              onViewDetail={openDetail}
                              onChangeArt={openDetail}
                              isCommanderCard={slot.entry.id === commanderEntryId}
                              onToggleCommander={toggleCommander}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* ── Grid view (default): numbered slots ── */
              <div
                className="grid gap-2.5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))" }}
              >
                {filledSlots.map(slot => (
                  <FilledSlot
                    key={`${slot.entry.id}-copy-${slot.copyIndex}`}
                    slot={slot}
                    singleton={singleton}
                    maxCopies={maxCopies}
                    isCommanderFormat={isCommanderFormat}
                    onRemove={removeCard}
                    onQtyChange={setQuantity}
                    isIllegal={illegalEntryIds.has(slot.entry.id)}
                    isOverCopyLimit={copyLimitEntryIds.has(slot.entry.id)}
                    violationReason={violationReasonByEntryId.get(slot.entry.id) ?? null}
                    onViewDetail={openDetail}
                    onChangeArt={openDetail}
                    isCommanderCard={slot.entry.id === commanderEntryId}
                    onToggleCommander={toggleCommander}
                  />
                ))}
                {Array.from({ length: emptyCount }).map((_, i) => (
                  <EmptySlot key={`slot-${filledSlots.length + i}`} index={filledSlots.length + i} highlight={isDragOver} />
                ))}
              </div>
            )}
          </div>}

          {/* Footer — count + status + CTA */}
          <div className="shrink-0 border-t border-border bg-surface">
            {/* Count row */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs font-bold tabular-nums text-muted-foreground">
                {isUnlimited ? `${totalCards} cartas` : `${filledCount} / ${deckSize}`}
              </span>
              {formatWarnings.length === 0 && meetsMinimum && (
                <span className="text-xs font-bold text-green-400">Listo</span>
              )}
              {formatWarnings.length > 0 && (
                <span className="text-xs font-medium text-amber-400/80">{formatWarnings.length} aviso{formatWarnings.length !== 1 ? "s" : ""}</span>
              )}
            </div>


          </div>
          </>
          )}
        </aside>
      </div>

      {showImport && <ImportDeckModal onClose={() => { setShowImport(false); setImportText("") }} onImport={handleImport} initialText={importText} />}

      {showRulesFor && <FormatRulesModal formatKey={showRulesFor} onClose={() => setShowRulesFor(null)} />}

      <BuilderCartPanel open={cartPanelOpen} onClose={() => setCartPanelOpen(false)} />

  {detailCard && (
    <CardDetailModal
  card={detailCard}
  entry={detailEntry}
  isInDeck={deckIds.has(detailCard.oracle_id ?? detailCard.name)}
  onAdd={(card) => { handleAddCard(card); closeDetail() }}
  onUpdatePrint={updatePrint}
  onClose={closeDetail}
  />
  )}

  {/* Commander assignment feedback — ineligible card (dismiss-only) or the
      "only one Commander allowed" confirm-to-replace flow. */}
  {commanderDialog?.kind === "ineligible" && (
    <RuleWarningDialog
      title="No puede ser el comandante"
      reason={commanderDialog.reason}
      onClose={() => setCommanderDialog(null)}
    />
  )}
  {commanderDialog?.kind === "replace" && (
    <RuleWarningDialog
      title="Solo se admite un comandante"
      reason={`"${commanderDialog.currentName}" ya es el comandante de este mazo. Solo se permite uno — al confirmar, lo reemplazarás.`}
      confirmLabel="Reemplazar comandante"
      onConfirm={() => setCommander(commanderDialog.entryId)}
      onClose={() => setCommanderDialog(null)}
    />
  )}
  </div>
  )
}

export default function MazoPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-background flex items-center justify-center"><div className="text-muted-foreground text-sm">Cargando builder...</div></div>}>
      <MazoInner />
    </Suspense>
  )
}
