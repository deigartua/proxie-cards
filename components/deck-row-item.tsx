"use client"

/**
 * DeckRowItem — shared deck row used across:
 *  - deckbox-side-panel (compact sidebar)
 *  - /deckbox page (full checkout view)
 *  - deckbuilder "Mis mazos" panel
 *
 * Design intent:
 *  - Type is communicated via a small icon ABOVE the name, not a text badge
 *  - Modified precons show only a pencil icon next to the name, nothing else
 *  - Actions: expand (open in new tab) + delete — always visible on mobile,
 *    hover-reveal on desktop
 */

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { usePrintStore, GAME_FORMATS } from "@/providers/print-store-provider"
import type { DeckItem, ScryfallCard } from "@/types/scryfall"
import {
  BookOpen, Package, LayoutList, Swords,
  Pencil, Trash2, Expand, Plus,
} from "lucide-react"

// ── Type icon — tiny icon placed above the deck name ─────────────────────────

function DeckTypeIcon({ deck }: { deck: DeckItem }) {
  if (deck.type === "singles")
    return <Package className="h-3 w-3 text-muted-foreground/50 shrink-0" aria-label="Singles" />
  if (deck.type === "precon")
    return <LayoutList className="h-3 w-3 text-purple-400/60 shrink-0" aria-label="Preconstruido" />
  if (deck.type === "set")
    return <Swords className="h-3 w-3 text-accent-blue/60 shrink-0" aria-label="Set" />
  // custom: show format initial if known, fallback BookOpen
  return <BookOpen className="h-3 w-3 text-accent-gold/50 shrink-0" aria-label="Deck personalizado" />
}

// ── Progress bar (only for custom decks with a known deckSize) ────────────────

function DeckProgress({ deck, count }: { deck: DeckItem; count: number }) {
  if (deck.type !== "custom") return null
  const cfg      = GAME_FORMATS.find(f => f.key === deck.format)
  const deckSize = cfg?.deckSize
  if (!deckSize) return null
  const pct  = Math.min((count / deckSize) * 100, 100)
  const done = count >= deckSize
  return (
    <div className="mt-1 h-0.5 rounded-full bg-border/40 overflow-hidden w-full max-w-[140px]">
      <div
        className={cn("h-full rounded-full transition-all duration-500", done ? "bg-green-500" : "bg-accent-gold")}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface DeckRowItemProps {
  deck: DeckItem
  /** Whether to accept card drops onto this row */
  acceptDrop?: boolean
  /** Called when the row is clicked (edit/select) */
  onClick?: () => void
  /** Called when the delete button is pressed */
  onRemove?: () => void
  /** If true, the delete button shows in a danger/confirming state */
  isConfirmingDelete?: boolean
  /** Show a checkbox (for /deckbox selection) */
  isSelectable?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
  /** Compact mode — used in the side panel */
  compact?: boolean
  /** Whether actions (expand, delete) are always visible */
  alwaysShowActions?: boolean
}

export function DeckRowItem({
  deck,
  acceptDrop = false,
  onClick,
  onRemove,
  isConfirmingDelete = false,
  isSelectable = false,
  isSelected = false,
  onToggleSelect,
  compact = false,
  alwaysShowActions = false,
}: DeckRowItemProps) {
  const { addCardToDeck, addSingleCard } = usePrintStore()
  const [dragOver, setDragOver]         = useState(false)

  const count    = deck.entries.reduce((s, e) => s + e.quantity, 0)
  const sbCount  = (deck.sideboard ?? []).reduce((s, e) => s + e.quantity, 0)
  const coverImg =
    deck.coverCard?.image_uris?.small ??
    deck.coverCard?.card_faces?.[0]?.image_uris?.small ??
    deck.entries[0]?.selectedPrint?.image_uris?.small ??
    deck.entries[0]?.card.image_uris?.small

  const cfg      = GAME_FORMATS.find(f => f.key === deck.format)
  const deckSize = cfg?.deckSize

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    if (!acceptDrop) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
    setDragOver(true)
  }
  function handleDragLeave() { setDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    if (!acceptDrop) return
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    try {
      const card: ScryfallCard = JSON.parse(e.dataTransfer.getData("application/x-mtg-card"))
      if (deck.type === "singles") addSingleCard(card, 1)
      else addCardToDeck(deck.id, card, 1)
    } catch { /* ignore malformed drag data */ }
  }

  // Both variants now share the same enlarged thumbnail/text sizing — the
  // deckbox side panel (compact) used to render noticeably smaller rows than
  // the full deck list; they're unified here so the panel isn't cramped.
  const thumbH  = "h-16"
  const thumbW  = "w-11"

  return (
    <div
      className={cn(
        "group relative rounded-xl border transition-all overflow-hidden",
        dragOver
          ? "border-accent-gold bg-accent-gold/10 shadow-lg shadow-accent-gold/20 scale-[1.01]"
          : isSelected
          ? "border-accent-gold bg-accent-gold/5"
          : "border-border/60 bg-surface/40 hover:bg-surface/80 hover:border-border",
        isConfirmingDelete && "opacity-60"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={cn("flex items-center gap-3.5", compact ? "p-3" : "p-3.5")}>

        {/* Optional checkbox */}
        {isSelectable && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggleSelect?.() }}
            className={cn(
              "shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
              isSelected ? "bg-accent-gold border-accent-gold" : "border-border bg-transparent"
            )}
          >
            {isSelected && (
              <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-background" aria-hidden>
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}

        {/* Cover thumbnail */}
        <div
          className={cn(
            "rounded-lg overflow-hidden bg-black/40 border border-white/8 shrink-0 shadow-md pointer-events-none",
            thumbW, thumbH
          )}
        >
          {coverImg
            ? <img src={coverImg} alt={deck.name} className="w-full h-full object-cover" loading="lazy" />
            : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground/20" />
              </div>
            )
          }
        </div>

        {/* Info */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onClick}
        >
          {/* Type icon row — above name */}
          <div className="flex items-center gap-1 mb-0.5">
            <DeckTypeIcon deck={deck} />
            {/* Modified precon: small pencil only */}
            {deck.type === "precon" && deck.isModified && (
              <Pencil className="h-2.5 w-2.5 text-accent-blue/50 shrink-0" aria-label="Editado" />
            )}
          </div>

          <p className="font-semibold text-foreground truncate leading-tight text-[15px]">
            {deck.name}
          </p>
          <p className="text-[12px] text-muted-foreground tabular-nums mt-0.5">
            {count}{deckSize ? <span className="text-muted-foreground/40"> / {deckSize}</span> : ""} cartas
            {sbCount > 0 && <span className="ml-1.5 text-accent-gold/70">+{sbCount} sb</span>}
          </p>
          <DeckProgress deck={deck} count={count} />

          {/* Drop hint */}
          {dragOver && (
            <p className="text-[10px] text-accent-gold font-semibold mt-0.5 flex items-center gap-1">
              <Plus className="h-3 w-3" /> Soltar para agregar
            </p>
          )}
        </div>

        {/* Actions */}
        <div
          className={cn(
            "flex flex-col items-center gap-1 shrink-0 transition-opacity pointer-events-auto",
            alwaysShowActions ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          )}
          onClick={e => e.stopPropagation()}
        >
          {/* Open deck in new tab */}
          <Link
            href={`/deckbox/${deck.id}`}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-raised rounded-lg transition-all"
            title="Ver cartas del mazo"
          >
            <Expand className="h-3.5 w-3.5" />
          </Link>

          {/* Delete */}
          {onRemove && (
            <button
              onClick={onRemove}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                isConfirmingDelete
                  ? "text-red-400 bg-red-500/15"
                  : "text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10"
              )}
              title={isConfirmingDelete ? "Click para confirmar" : "Eliminar"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
