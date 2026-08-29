"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Loader2, Zap } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { calcPrice, formatARS, FALLBACK_TIERS, type PriceTier } from "@/lib/pricing"

// Static features per tier position
const TIER_META = [
  {
    name: "Singles / Personalizado",
    description: "Armá tu mazo carta a carta",
    features: ["Desde 30 cartas", "Formato libre", "Construido con el deckbuilder", "Singles o mazos custom"],
    cta: "Armar mazo",
    href: "/deckbuilder",
    featured: false,
  },
  {
    name: "Commander / Standard",
    description: "El más popular",
    features: ["Hasta 60 cartas", "Formato Commander o Standard", "Precio intermedio por carta", "Todos los formatos disponibles"],
    cta: "Explorar formatos",
    href: "/deckbuilder",
    featured: true,
  },
  {
    name: "Mazo completo 100+",
    description: "Mejor precio por carta",
    features: ["100 cartas o más", "Precio unitario mínimo", "Precons o custom", "Ideal para Commander completo"],
    cta: "Ver precons",
    href: "/precons",
    featured: false,
  },
]

export default function PreciosPage() {
  const [tiers, setTiers]     = useState<PriceTier[]>(FALLBACK_TIERS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/pricing")
      .then(r => r.json())
      .then(d => { if (d.tiers?.length) setTiers(d.tiers) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Sort active tiers by sort_order
  const sorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-border py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-bold tracking-widest uppercase text-accent-gold mb-3">Precios</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight mb-4 tracking-tight font-sans text-balance">
            Precios transparentes
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Un único material de alta calidad — Satinado 300 gr. El precio final depende de cuántas cartas pedís en total.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5">
              {sorted.map((tier, i) => {
                const meta    = TIER_META[i] ?? TIER_META[0]
                const unitPrice = Math.round(tier.total_price / tier.min_cards)
                const rangeLabel = tier.max_cards
                  ? `${tier.min_cards}–${tier.max_cards} cartas`
                  : `${tier.min_cards}+ cartas`

                return (
                  <div
                    key={tier.id}
                    className={`relative flex flex-col rounded-2xl border p-7 transition-all ${
                      meta.featured
                        ? "border-accent-gold/50 bg-accent-gold/5 shadow-lg shadow-accent-gold/10"
                        : "border-border bg-surface hover:border-border/80"
                    }`}
                  >
                    {meta.featured && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-accent-gold text-background text-[10px] font-extrabold tracking-widest uppercase">
                          <Zap className="h-2.5 w-2.5" /> Popular
                        </span>
                      </div>
                    )}

                    {/* Header */}
                    <div className="mb-5">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">{rangeLabel}</p>
                      <h3 className="text-lg font-extrabold text-foreground mb-1 font-sans">{meta.name}</h3>
                      <p className="text-sm text-muted-foreground">{meta.description}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-extrabold tabular-nums ${meta.featured ? "text-accent-gold" : "text-foreground"}`}>
                          {formatARS(tier.total_price)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatARS(unitPrice)} por carta · Satinado 300 gr
                      </p>
                      {tier.label && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-accent-gold/10 text-accent-gold text-[10px] font-bold">
                          {tier.label}
                        </span>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5 mb-8 flex-1">
                      {meta.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                          <Check className={`h-4 w-4 shrink-0 mt-0.5 ${meta.featured ? "text-accent-gold" : "text-foreground/50"}`} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      href={meta.href}
                      className={`block w-full text-center px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        meta.featured
                          ? "bg-accent-gold text-background hover:brightness-105"
                          : "bg-surface-raised border border-border text-foreground hover:border-accent-gold/40"
                      }`}
                    >
                      {meta.cta}
                    </Link>
                  </div>
                )
              })}
            </div>
          )}

          {/* Overflow note */}
          <p className="text-center text-xs text-muted-foreground mt-8">
            ¿Más de {sorted[sorted.length - 1]?.min_cards ?? 100} cartas? El precio se calcula proporcionalmente al precio unitario del tier mayor.{" "}
            <Link href="/deckbuilder" className="text-accent-gold hover:underline">Probalo en el builder.</Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border py-16 px-6 bg-surface">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-foreground mb-10 text-center font-sans">Preguntas frecuentes</h2>
          <div className="space-y-8">
            {[
              {
                q: "¿Hay un pedido mínimo?",
                a: "Sí, el mínimo es de 30 cartas para pedidos de singles. Los precons vienen con su cantidad fija.",
              },
              {
                q: "¿El precio varía si mezclo decks?",
                a: "No. El precio se calcula sobre el total de cartas del pedido completo, sin importar cuántos mazos lo componen.",
              },
              {
                q: "¿Qué material usan?",
                a: "Todas las cartas se imprimen en Satinado 300 gr, el mismo material en todos los pedidos.",
              },
              {
                q: "¿Puedo actualizar los precios?",
                a: "Sí, desde el panel de administración podés editar, agregar o desactivar tiers de precio en tiempo real.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-border pb-7 last:border-0 last:pb-0">
                <h3 className="text-base font-bold text-foreground mb-2">{q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-accent-gold/20 bg-accent-gold/5 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">¿Tenés dudas sobre precios o pedidos especiales?</p>
            <Link
              href="/nosotros"
              className="inline-block px-6 py-2.5 rounded-xl bg-accent-gold text-background text-sm font-bold hover:brightness-105 transition-all"
            >
              Contactanos
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
