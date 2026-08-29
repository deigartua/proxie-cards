"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { usePrintStore, GAME_FORMATS } from "@/providers/print-store-provider"
import { Navbar } from "@/components/navbar"
import { cn } from "@/lib/utils"
import { isDoubleFacedCard } from "@/lib/generate-pdf"
import {
  ArrowLeft,
  ArrowLeftRight,
  Pencil,
  ShoppingBag,
  Package,
  Wand2,
  Star,
} from "lucide-react"
import type { DeckItem, PrintListEntry } from "@/types/scryfall"

// ── Card type grouping ─────────────────────────────────────────────────────────

const TYPE_ORDER = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Enchantment",
  "Artifact",
  "Land",
  "Other",
] as const

type CardType = (typeof TYPE_ORDER)[number]

function getCardType(typeLine: string): CardType {
  const t = typeLine.toLowerCase()
  if (t.includes("creature"))     return "Creature"
  if (t.includes("planeswalker")) return "Planeswalker"
  if (t.includes("instant"))      return "Instant"
  if (t.includes("sorcery"))      return "Sorcery"
  if (t.includes("enchantment"))  return "Enchantment"
  if (t.includes("artifact"))     return "Artifact"
  if (t.includes("land"))         return "Land"
  return "Other"
}

const TYPE_LABELS: Record<CardType, string> = {
  Creature:     "Criaturas",
  Planeswalker: "Planeswalkers",
  Instant:      "Instantes",
  Sorcery:      "Conjuros",
  Enchantment:  "Encantamientos",
  Artifact:     "Artefactos",
  Land:         "Tierras",
  Other:        "Otros",
}

// ── Format badge ───────────────────────────────────────────────────────────────

function FormatBadge({ deck }: { deck: DeckItem }) {
  if (deck.type === "precon" && deck.isModified)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-accent-blue/15 text-accent-blue border border-accent-blue/20 uppercase"><Wand2 className="h-2.5 w-2.5" />Precon editado</span>
  if (deck.type === "precon")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/20 uppercase"><Package className="h-2.5 w-2.5" />Precon</span>
  if (deck.type === "set")
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-accent-blue/15 text-accent-blue border border-accent-blue/20 uppercase">Set</span>
  if (deck.type === "singles")
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-surface-raised text-muted-foreground border border-border uppercase">Singles</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-accent-gold/15 text-accent-gold border border-accent-gold/20 uppercase"><Star className="h-2.5 w-2.5" />Custom</span>
}

// ── Single card display (DFC-aware) ───────────────────────────────────────────

function SingleCard({ entry }: { entry: PrintListEntry }) {
  const card   = entry.selectedPrint ?? entry.card
  const isDfc  = isDoubleFacedCard(card)
  const [face, setFace] = useState<0 | 1>(0)

  const imgSrc = isDfc
    ? (card.card_faces![face]?.image_uris?.normal ?? card.card_faces![face]?.image_uris?.large)
    : (card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal)

  const altText = isDfc
    ? `${card.name} — ${face === 0 ? "Lado A" : "Lado B"}`
    : card.name

  const CARD_W = 120
  const CARD_H = 168

  return (
    <div className="relative group" style={{ width: CARD_W, height: CARD_H }}>
      <div className="w-full h-full overflow-hidden rounded-[6px] border border-white/10 shadow-md">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={altText}
            className="w-full h-full object-cover transition-opacity duration-200"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-surface-raised flex items-center justify-center px-1">
            <span className="text-[8px] text-muted-foreground text-center leading-tight">
              {card.name}
            </span>
          </div>
        )}
      </div>

      {/* DFC badge + flip button */}
      {isDfc && (
        <>
          {/* Side indicator badge — top-left corner */}
          <div className={cn(
            "absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase",
            face === 0
              ? "bg-accent-blue/80 text-white backdrop-blur-sm"
              : "bg-accent-gold/80 text-background backdrop-blur-sm",
          )}>
            {face === 0 ? "A" : "B"}
          </div>

          {/* Flip button — bottom-right corner, always visible for DFC */}
          <button
            onClick={() => setFace(f => f === 0 ? 1 : 0)}
            className="absolute bottom-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full bg-black/70 border border-white/20 text-white/80 hover:text-white hover:bg-black/90 hover:border-accent-gold/50 transition-all shadow-lg backdrop-blur-sm"
            title={`Ver ${face === 0 ? "Lado B" : "Lado A"}`}
            aria-label={`Voltear: ver ${face === 0 ? "Lado B" : "Lado A"}`}
          >
            <ArrowLeftRight className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}

// ── Stacked card column ────────────────────────────────────────────────────────

function CardColumn({ entries }: { entries: PrintListEntry[] }) {
  const cards: { entry: PrintListEntry; copy: number }[] = []
  for (const entry of entries) {
    for (let i = 0; i < entry.quantity; i++) {
      cards.push({ entry, copy: i })
    }
  }

  const CARD_H   = 168
  const CARD_W   = 120
  const STACK_PX = 28

  const totalH = cards.length > 0
    ? CARD_H + (cards.length - 1) * STACK_PX
    : CARD_H

  return (
    <div className="relative" style={{ width: CARD_W, height: totalH }}>
      {cards.map(({ entry, copy }, idx) => (
        <div
          key={`${entry.id}-${copy}`}
          className="absolute w-full"
          style={{ top: idx * STACK_PX, height: CARD_H, zIndex: idx }}
        >
          <SingleCard entry={entry} />
        </div>
      ))}
    </div>
  )
}

// ── Type group ─────────────────────────────────────────────────────────────────

function TypeGroup({ type, entries }: { type: CardType; entries: PrintListEntry[] }) {
  const total = entries.reduce((s, e) => s + e.quantity, 0)
  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {TYPE_LABELS[type]}
        </span>
        <span className="text-[10px] text-muted-foreground/50 bg-surface-raised border border-border px-1.5 py-0.5 rounded-full tabular-nums">
          {total}
        </span>
      </div>
      {/* Card columns side by side */}
      <div className="flex flex-wrap gap-2 items-start">
        {entries.map(entry => (
          <CardColumn key={entry.id} entries={[entry]} />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeckPreviewPage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const { cartDecks, editCartDeck, editPreconDeck } = usePrintStore()

  const deck = cartDecks.find(d => d.id === params.id)

  const grouped = useMemo(() => {
    if (!deck) return {} as Record<CardType, PrintListEntry[]>
    const result: Record<CardType, PrintListEntry[]> = {
      Creature: [], Planeswalker: [], Instant: [], Sorcery: [],
      Enchantment: [], Artifact: [], Land: [], Other: [],
    }
    for (const entry of deck.entries) {
      const t = getCardType(entry.card.type_line ?? "")
      result[t].push(entry)
    }
    return result
  }, [deck])

  const totalCards = deck?.entries.reduce((s, e) => s + e.quantity, 0) ?? 0
  const formatCfg  = GAME_FORMATS.find(f => f.key === deck?.format)
  const coverImg   =
    deck?.coverCard?.image_uris?.art_crop ??
    deck?.coverCard?.image_uris?.large ??
    deck?.coverCard?.card_faces?.[0]?.image_uris?.art_crop

  function handleEdit() {
    if (!deck) return
    if (deck.type === "precon") editPreconDeck(deck.id)
    else editCartDeck(deck.id)
    router.push("/deckbuilder")
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center gap-4 flex-col">
          <p className="text-sm text-muted-foreground">Mazo no encontrado.</p>
          <Link href="/deckbox" className="text-xs text-accent-blue hover:underline">
            Volver al Deckbox
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* ── Cover banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden h-40 md:h-52 shrink-0">
        {coverImg ? (
          <img
            src={coverImg}
            alt={deck.name}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-surface to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Back button */}
        <div className="absolute top-4 left-4 md:top-6 md:left-6">
          <Link
            href="/deckbox"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white/70 text-xs font-medium hover:text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Deckbox
          </Link>
        </div>
      </div>

      {/* ── Deck header ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 -mt-10 relative z-10 mb-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <FormatBadge deck={deck} />
              {formatCfg && (
                <span className="text-[10px] text-muted-foreground capitalize">
                  {formatCfg.label}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight leading-none text-balance">
              {deck.name}
            </h1>
            {deck.description && (
              <p className="text-sm text-muted-foreground max-w-xl">{deck.description}</p>
            )}
            <p className="text-xs text-muted-foreground/60">
              {totalCards} {totalCards === 1 ? "carta" : "cartas"}
              {formatCfg?.deckSize && (
                <span className="ml-1 text-muted-foreground/40">/ {formatCfg.deckSize}</span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 pb-0.5">
            {deck.type !== "singles" && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-accent-blue/40 text-accent-blue text-xs font-bold hover:bg-accent-blue/10 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
            )}
            <Link
              href="/pedido"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-gold text-background text-xs font-bold hover:brightness-105 transition-all"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Pedir
            </Link>
          </div>
        </div>
      </div>

      {/* ── Card grid by type ─────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pb-16">
        {deck.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">Este mazo no tiene cartas todavía.</p>
            {deck.type !== "singles" && (
              <button
                onClick={handleEdit}
                className="text-xs text-accent-blue hover:underline"
              >
                Empezar a armar
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-8 items-start">
            {TYPE_ORDER.map(type => {
              const entries = grouped[type]
              if (!entries || entries.length === 0) return null
              return <TypeGroup key={type} type={type} entries={entries} />
            })}
          </div>
        )}

        {/* Sideboard */}
        {(deck.sideboard ?? []).length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-accent-gold/70 px-3">
                Sideboard
              </span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <div className={cn("flex flex-wrap gap-2")}>
              {deck.sideboard!.map(entry => (
                <CardColumn key={entry.id} entries={[entry]} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
