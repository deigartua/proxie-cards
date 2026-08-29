"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Trash2, ShoppingBag, Plus, Minus, X, ExternalLink, Clipboard, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PACK_SIZES,
  getPriceForCount,
  formatARS,
  type MaterialId,
} from "@/lib/materials"
import type { ScryfallCard, PrintListEntry, DeckMode } from "@/types/scryfall"

// ── Export helpers ────────────────────────────────────────────────────────────

function exportPlainText(entries: PrintListEntry[]): string {
  return entries
    .map((e) => `${e.quantity} ${e.card.name}`)
    .join("\n")
}

function exportMoxfield(entries: PrintListEntry[]): string {
  return entries
    .map((e) => {
      const card = e.selectedPrint ?? e.card
      const set = card.set?.toUpperCase() ?? ""
      const num = card.collector_number ?? ""
      if (set && num) return `${e.quantity} ${card.name} (${set}) ${num}`
      return `${e.quantity} ${card.name}`
    })
    .join("\n")
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getArt(entry: PrintListEntry): string | undefined {
  const c = entry.selectedPrint ?? entry.card
  return c.image_uris?.normal ?? c.image_uris?.large ?? c.card_faces?.[0]?.image_uris?.normal
}

// ── CartPanel ─────────────────────────────────────────────────────────────────

export interface CartPanelProps {
  mode: DeckMode
  materialId: MaterialId
  entries: PrintListEntry[]
  totalCards: number
  onSetQuantity: (id: string, qty: number) => void
  onRemoveCard: (id: string) => void
  onClearAll: () => void
  onCheckout: () => void
  onViewDetail?: (card: ScryfallCard) => void
}

const MIN_SLOTS = 15

export function CartPanel({
  mode,
  materialId,
  entries,
  totalCards,
  onSetQuantity,
  onRemoveCard,
  onClearAll,
  onCheckout,
  onViewDetail,
}: CartPanelProps) {

  const total = useMemo(
    () => (totalCards > 0 ? getPriceForCount(materialId, totalCards) : 0),
    [materialId, totalCards]
  )

  const nextTier = PACK_SIZES.find((s) => s > totalCards) ?? null
  const canCheckout = totalCards >= MIN_SLOTS

  // ── Export dropdown ──────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [exportOpen])

  function copyToClipboard(text: string, format: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFormat(format)
      setExportOpen(false)
      setTimeout(() => setCopiedFormat(null), 2000)
    })
  }

  // Flatten entries into individual "slot" items respecting quantities
  // Each unique entry shows its art once; quantity shown as badge
  const flatEntries = entries

  // Total slots shown: max(actual unique cards, MIN_SLOTS), rounded up to multiple of 3
  const uniqueCount = flatEntries.length
  const rawSlots = Math.max(uniqueCount, MIN_SLOTS)
  const slotCount = Math.ceil(rawSlots / 3) * 3 // always a multiple of 3

  // Build numbered slot array
  const slots = Array.from({ length: slotCount }, (_, i) => ({
    index: i,
    entry: i < flatEntries.length ? flatEntries[i] : null,
  }))

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-accent-gold" />
          <span className="text-sm font-bold text-foreground">Mi mazo</span>
          {totalCards > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-gold text-background text-[10px] font-bold px-1.5">
              {totalCards}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {nextTier && totalCards > 0 && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Faltan <span className="font-semibold text-accent-gold">{nextTier - totalCards}</span> para Pack {nextTier}
            </span>
          )}

          {/* Export dropdown */}
          {entries.length > 0 && (
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setExportOpen(v => !v)}
                className={cn(
                  "flex items-center gap-1 text-[11px] font-medium transition-colors rounded-md px-2 py-1 border",
                  copiedFormat
                    ? "text-green-400 border-green-400/40 bg-green-400/5"
                    : "text-muted-foreground border-border hover:text-foreground hover:border-border/80"
                )}
                aria-label="Exportar lista"
              >
                {copiedFormat ? (
                  <><Check className="h-3 w-3" /> Copiado</>
                ) : (
                  <><Clipboard className="h-3 w-3" /> Exportar <ChevronDown className="h-2.5 w-2.5" /></>
                )}
              </button>

              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-border bg-surface shadow-xl shadow-black/30 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border/60">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Formato de exportación</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(exportPlainText(entries), "plain")}
                    className="w-full text-left px-3 py-2.5 hover:bg-background transition-colors group"
                  >
                    <p className="text-xs font-semibold text-foreground group-hover:text-accent-gold transition-colors">Texto estándar</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">1 Lightning Bolt</p>
                  </button>
                  <button
                    onClick={() => copyToClipboard(exportMoxfield(entries), "moxfield")}
                    className="w-full text-left px-3 py-2.5 hover:bg-background transition-colors group border-t border-border/40"
                  >
                    <p className="text-xs font-semibold text-foreground group-hover:text-accent-gold transition-colors">MTG Arena / Moxfield</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">1 Lightning Bolt (LEA) 161</p>
                  </button>
                </div>
              )}
            </div>
          )}

          {entries.length > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Vaciar mazo"
            >
              <Trash2 className="h-3 w-3" />
              Vaciar
            </button>
          )}
        </div>
      </div>

      {/* Progress bar toward next tier */}
      {totalCards > 0 && nextTier && (
        <div className="shrink-0 h-1 bg-border overflow-hidden">
          <div
            className="h-full bg-accent-gold transition-all duration-500"
            style={{ width: `${Math.min((totalCards / nextTier) * 100, 100)}%` }}
          />
        </div>
      )}

      {/* ── Card art grid ── */}
      <div
        className="flex-1 overflow-y-auto min-h-0 p-3"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-3 gap-2">
          {slots.map(({ index, entry }) => (
            <SlotCard
              key={entry ? entry.id : `empty-${index}`}
              index={index}
              entry={entry}
              onSetQuantity={onSetQuantity}
              onRemove={onRemoveCard}
              onViewDetail={onViewDetail}
            />
          ))}
        </div>
      </div>

      {/* ── Footer: total + CTA ── */}
      <div className="shrink-0 px-3 py-3 border-t border-border bg-background">
        {totalCards > 0 && (
          <div className="flex items-baseline justify-between mb-2.5">
            <span className="text-xs text-muted-foreground">
              {totalCards} {totalCards === 1 ? "carta" : "cartas"}
            </span>
            <span className="text-xl font-extrabold text-foreground tabular-nums">
              {formatARS(total)}
            </span>
          </div>
        )}

        {totalCards > 0 && totalCards < MIN_SLOTS && (
          <p className="text-[10px] text-muted-foreground/70 text-center mb-2">
            Mínimo {MIN_SLOTS} cartas{" "}
            <span className="text-accent-gold font-semibold">(faltan {MIN_SLOTS - totalCards})</span>
          </p>
        )}

        <button
          onClick={onCheckout}
          disabled={!canCheckout}
          className={cn(
            "w-full rounded-xl py-2.5 text-sm font-bold transition-all",
            canCheckout
              ? "bg-accent-gold text-background hover:brightness-105 shadow-sm hover:shadow-md"
              : "bg-border text-muted-foreground cursor-not-allowed opacity-60",
          )}
        >
          {canCheckout ? "Hacer pedido" : `Mínimo ${MIN_SLOTS} cartas`}
        </button>
      </div>
    </div>
  )
}

// ── Slot Card ─────────────────────────────────────────────────────────────────

interface SlotCardProps {
  index: number
  entry: PrintListEntry | null
  onSetQuantity: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onViewDetail?: (card: ScryfallCard) => void
}

function SlotCard({ index, entry, onSetQuantity, onRemove, onViewDetail }: SlotCardProps) {
  const slotNumber = index + 1
  const art = entry ? getArt(entry) : undefined

  if (!entry) {
    return (
      <div
        className="relative aspect-[5/7] rounded-lg border-2 border-dashed border-border/40 bg-surface/30 flex flex-col items-center justify-center"
        aria-label={`Slot vacío ${slotNumber}`}
      >
        <span className="text-[10px] font-bold text-border/60 tabular-nums select-none">
          {slotNumber}
        </span>
      </div>
    )
  }

  return (
    <div
      className="relative aspect-[5/7] rounded-lg overflow-hidden border border-border/40 group shadow-sm hover:shadow-md transition-shadow bg-surface-raised"
      onClick={() => onViewDetail?.(entry.card)}
      role={onViewDetail ? "button" : undefined}
      tabIndex={onViewDetail ? 0 : undefined}
      onKeyDown={(e) => e.key === "Enter" && onViewDetail?.(entry.card)}
      aria-label={onViewDetail ? `Ver detalles de ${entry.card.name}` : undefined}
      style={{ cursor: onViewDetail ? "pointer" : "default" }}
    >
      {/* Card art */}
      {art ? (
        <img
          src={art}
          alt={entry.card.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-raised">
          <span className="text-[9px] font-semibold text-muted-foreground text-center px-1 leading-tight">
            {entry.card.name}
          </span>
        </div>
      )}

      {/* Slot number badge — top left */}
      <div className="absolute top-1 left-1 h-4.5 min-w-4.5 px-1 rounded-md bg-black/60 text-white text-[9px] font-bold flex items-center justify-center tabular-nums select-none backdrop-blur-sm">
        {slotNumber}
      </div>

      {/* Quantity badge — top right */}
      {entry.quantity > 1 && (
        <div className="absolute top-1 right-1 h-4.5 min-w-4.5 px-1 rounded-md bg-accent-gold text-background text-[9px] font-bold flex items-center justify-center tabular-nums select-none">
          ×{entry.quantity}
        </div>
      )}

      {/* Hover overlay: qty controls + remove + view card link */}
      <div
        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end pb-2 gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSetQuantity(entry.id, Math.max(1, entry.quantity - 1))}
            className="h-5 w-5 flex items-center justify-center rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
            aria-label="Reducir cantidad"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <span className="w-5 text-center text-[11px] font-bold text-white tabular-nums">
            {entry.quantity}
          </span>
          <button
            onClick={() => onSetQuantity(entry.id, Math.min(99, entry.quantity + 1))}
            className="h-5 w-5 flex items-center justify-center rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
            aria-label="Aumentar cantidad"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRemove(entry.id)}
            className="flex items-center gap-0.5 text-[9px] font-semibold text-white/80 hover:text-red-300 transition-colors"
            aria-label={`Quitar ${entry.card.name}`}
          >
            <X className="h-2.5 w-2.5" />
            Quitar
          </button>
          <span className="text-white/40 select-none">·</span>
          <Link
            href={`/cards/${entry.card.oracle_id ?? entry.card.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[9px] font-semibold text-white/80 hover:text-accent-gold transition-colors"
            aria-label={`Ver página de ${entry.card.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Ver carta
          </Link>
        </div>
      </div>
    </div>
  )
}
