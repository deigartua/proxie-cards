"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { use } from "react"
import { Layers, ArrowLeft, Plus, Check, ExternalLink, Loader2, AlertCircle } from "lucide-react"
import { usePrintStore } from "@/providers/print-store-provider"
import { cn } from "@/lib/utils"
import type { ScryfallCard } from "@/types/scryfall"

interface CardPageProps {
  params: Promise<{ oracle_id: string }>
}

function getImages(card: ScryfallCard): string[] {
  if (card.card_faces) {
    return card.card_faces
      .map((f) => f.image_uris?.large ?? f.image_uris?.normal)
      .filter(Boolean) as string[]
  }
  const img = card.image_uris?.large ?? card.image_uris?.normal
  return img ? [img] : []
}

export default function CardPage({ params }: CardPageProps) {
  const { oracle_id } = use(params)
  const [card, setCard] = useState<ScryfallCard | null>(null)
  const [prints, setPrints] = useState<ScryfallCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPrint, setSelectedPrint] = useState<ScryfallCard | null>(null)

  const { entries, addCard } = usePrintStore()
  const isInDeck = useMemo(
    () => !!entries.find((e) => e.card.oracle_id === oracle_id || e.card.id === oracle_id),
    [entries, oracle_id]
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Try fetching by oracle_id first
        const res = await fetch(`https://api.scryfall.com/cards/search?q=oracleid:${oracle_id}&unique=cards`)
        if (!res.ok) {
          // Fall back: try fetching by card id
          const res2 = await fetch(`https://api.scryfall.com/cards/${oracle_id}`)
          if (!res2.ok) throw new Error("Carta no encontrada")
          const c: ScryfallCard = await res2.json()
          setCard(c)
          setSelectedPrint(c)
          // Load all prints
          const printsRes = await fetch(`https://api.scryfall.com/cards/search?q=oracleid:${c.oracle_id}&unique=prints&order=released`)
          if (printsRes.ok) {
            const pd = await printsRes.json()
            setPrints(pd.data ?? [])
          }
        } else {
          const data = await res.json()
          const c: ScryfallCard = data.data[0]
          setCard(c)
          setSelectedPrint(c)
          const printsRes = await fetch(`https://api.scryfall.com/cards/search?q=oracleid:${c.oracle_id}&unique=prints&order=released`)
          if (printsRes.ok) {
            const pd = await printsRes.json()
            setPrints(pd.data ?? [])
          }
        }
      } catch (e: unknown) {
        setError((e as Error).message ?? "Error al cargar la carta")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [oracle_id])

  const displayCard = selectedPrint ?? card
  const images = displayCard ? getImages(displayCard) : []

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-accent-gold" />
        <span className="text-sm">Cargando carta…</span>
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm">{error ?? "Carta no encontrada"}</p>
        <Link href="/" className="text-xs text-accent-gold hover:underline">Volver al inicio</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">

      {/* Nav */}
      <header className="w-full border-b border-border bg-background/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-gold text-white">
              <Layers className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="font-extrabold text-sm tracking-tight text-foreground hidden sm:block">
              Proxie<span className="text-accent-gold">.cards</span>
            </span>
          </Link>

          <div className="w-px h-5 bg-border shrink-0" />

          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>

          <div className="flex-1" />

          <button
            onClick={() => addCard(displayCard!, 1)}
            disabled={isInDeck}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all",
              isInDeck
                ? "bg-accent-gold/20 text-accent-gold border border-accent-gold/40 cursor-default"
                : "bg-accent-gold text-background hover:brightness-105 shadow-sm"
            )}
          >
            {isInDeck ? <><Check className="h-4 w-4" /> En el mazo</> : <><Plus className="h-4 w-4" /> Agregar al mazo</>}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex gap-10 flex-col md:flex-row">

          {/* Card art */}
          <div className="shrink-0 flex flex-col gap-3 items-center">
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${card.name}${images.length > 1 ? ` (cara ${i + 1})` : ""}`}
                className="w-64 rounded-2xl shadow-2xl shadow-black/20"
              />
            ))}
            {/* Scryfall link */}
            {card.scryfall_uri && (
              <a
                href={card.scryfall_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent-gold transition-colors mt-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver en Scryfall
              </a>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-extrabold text-foreground text-balance mb-1">{card.name}</h1>
            <p className="text-sm text-muted-foreground mb-4">{card.type_line}</p>

            {/* Mana cost */}
            {card.mana_cost && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coste</span>
                <span className="font-mono text-sm text-foreground bg-surface px-2 py-0.5 rounded">{card.mana_cost}</span>
              </div>
            )}

            {/* Oracle text */}
            {card.oracle_text && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Texto</p>
                <p className="text-sm text-foreground leading-relaxed bg-surface rounded-xl p-4 whitespace-pre-line">{card.oracle_text}</p>
              </div>
            )}

            {/* Flavor text */}
            {card.flavor_text && (
              <p className="text-xs italic text-muted-foreground leading-relaxed mb-4 pl-3 border-l-2 border-border">
                {card.flavor_text}
              </p>
            )}

            {/* P/T or Loyalty */}
            {(card.power ?? card.loyalty) && (
              <div className="flex gap-4 mb-4">
                {card.power && (
                  <div className="flex flex-col items-center bg-surface rounded-xl px-4 py-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">P/T</span>
                    <span className="text-lg font-extrabold text-foreground">{card.power}/{card.toughness}</span>
                  </div>
                )}
                {card.loyalty && (
                  <div className="flex flex-col items-center bg-surface rounded-xl px-4 py-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Lealtad</span>
                    <span className="text-lg font-extrabold text-foreground">{card.loyalty}</span>
                  </div>
                )}
              </div>
            )}

            {/* Rarity + set */}
            <div className="flex items-center gap-3 mb-6">
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide",
                card.rarity === "mythic" && "bg-orange-100 text-orange-700",
                card.rarity === "rare" && "bg-yellow-100 text-yellow-700",
                card.rarity === "uncommon" && "bg-blue-100 text-blue-700",
                card.rarity === "common" && "bg-surface text-muted-foreground",
              )}>
                {card.rarity}
              </span>
              <span className="text-xs text-muted-foreground">
                {card.set_name} ({card.set?.toUpperCase()})
              </span>
            </div>

            {/* Other prints */}
            {prints.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Otras ediciones ({prints.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {prints.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPrint(p)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                        selectedPrint?.id === p.id
                          ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                          : "border-border bg-surface text-muted-foreground hover:border-accent-gold/50 hover:text-foreground"
                      )}
                    >
                      {p.set?.toUpperCase()} · {p.released_at?.slice(0, 4)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
