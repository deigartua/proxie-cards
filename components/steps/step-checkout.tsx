"use client"

import { useState, useCallback } from "react"
import { getMaterial, getPackPrice, getPriceForCount, formatARS, type PackSize, type MaterialId } from "@/lib/materials"
import type { PrintListEntry, DeckMode } from "@/types/scryfall"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Send,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  ShoppingBag,
  Loader2,
  Mail,
  MessageCircle,
  Copy,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"

interface StepCheckoutProps {
  mode: DeckMode
  packSize: PackSize
  materialId: MaterialId
  entries: PrintListEntry[]
  totalCards: number
}

function getThumb(entry: PrintListEntry): string | undefined {
  const c = entry.selectedPrint ?? entry.card
  return c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small
}

export function StepCheckout({ mode, packSize, materialId, entries, totalCards }: StepCheckoutProps) {
  const material = getMaterial(materialId)
  // Precon: price scales linearly with card count. Custom: fixed pack price.
  const total = mode === "precon"
    ? getPriceForCount(materialId, totalCards)
    : getPackPrice(materialId, packSize)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [contactMethod, setContactMethod] = useState<"email" | "whatsapp">("email")
  const [notes, setNotes] = useState("")
  const [listOpen, setListOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [shortCode, setShortCode] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  const handleSend = useCallback(async () => {
    const contact = contactMethod === "email" ? email.trim() : phone.trim()
    if (!name.trim() || !contact) return
    setSending(true)
    setSendError(null)
    try {
      const deckPayload = entries.map((e) => ({
        id: e.id,
        name: e.card.name,
        quantity: e.quantity,
        set: (e.selectedPrint ?? e.card).set,
        set_name: (e.selectedPrint ?? e.card).set_name,
        oracle_id: e.card.oracle_id,
        image_uri: (e.selectedPrint ?? e.card).image_uris?.png
          ?? (e.selectedPrint ?? e.card).image_uris?.large
          ?? (e.selectedPrint ?? e.card).image_uris?.normal
          ?? e.card.card_faces?.[0]?.image_uris?.png
          ?? e.card.card_faces?.[0]?.image_uris?.large
          ?? e.card.card_faces?.[0]?.image_uris?.normal,
      }))

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: contactMethod === "email" ? email.trim() : `whatsapp:${phone.trim()}`,
          notes: notes.trim() || null,
          packSize,
          materialId,
          totalPrice: total,
          deck: deckPayload,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? "Error al enviar el pedido")
      }

      if (data.short_code) setShortCode(data.short_code)
      setSent(true)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Error al enviar el pedido")
    } finally {
      setSending(false)
    }
  }, [name, email, notes, packSize, materialId, total, entries])

  function handleCopyCode() {
    if (!shortCode) return
    navigator.clipboard.writeText(shortCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto gap-6 py-10 text-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
          <Check className="h-10 w-10 text-emerald-500" strokeWidth={2.5} />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Pedido enviado</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Gracias, <span className="font-semibold text-foreground">{name}</span>. Nos ponemos
            en contacto{" "}
            {contactMethod === "email"
              ? <>a <span className="font-semibold text-foreground">{email}</span></>
              : <>por WhatsApp al <span className="font-semibold text-foreground">{phone}</span></>
            }{" "}
            en breve para coordinar el pago y la entrega.
          </p>
        </div>

        {/* Order code */}
        {shortCode && (
          <div className="w-full rounded-2xl border-2 border-accent-gold/30 bg-accent-gold/5 p-5 flex flex-col items-center gap-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tu código de pedido</p>
            <p className="text-3xl font-black font-mono tracking-widest text-foreground">{shortCode}</p>
            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold text-muted-foreground hover:border-accent-gold/50 transition-colors"
              >
                {codeCopied ? <Check className="h-3.5 w-3.5 text-accent-gold" /> : <Copy className="h-3.5 w-3.5" />}
                {codeCopied ? "Copiado" : "Copiar código"}
              </button>
              <Link
                href={`/orders/${shortCode}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-gold/40 bg-accent-gold/10 text-xs font-semibold text-accent-gold hover:bg-accent-gold/20 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver estado
              </Link>
            </div>
          </div>
        )}

        <div className="w-full rounded-xl border border-border bg-surface p-4 text-sm text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Material</span>
            <span className="font-semibold">{material.name} · {material.subtitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cartas</span>
            <span className="font-semibold">{totalCards}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="text-muted-foreground">Total</span>
            <span className="font-extrabold text-accent-gold text-base">{formatARS(total)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6">
      <div className="text-center space-y-1.5 mb-6">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Resumen y pedido</h2>
        <p className="text-sm text-muted-foreground">
          Revisá tu pedido y completá tus datos para coordinar la impresión.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-5 items-start">

        {/* ── Left: Order summary ── */}
        <div className="w-full md:w-80 lg:w-96 shrink-0">
          <div className="rounded-xl border border-border bg-surface overflow-hidden sticky top-4">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <ShoppingBag className="h-4 w-4 text-accent-gold shrink-0" />
              <span className="text-sm font-semibold text-foreground">Resumen del pedido</span>
            </div>

            <div className="px-4 py-3 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cartas</span>
                <span className="font-semibold">{packSize}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Material</span>
                <div className="text-right">
                  <span className="font-semibold block">{material.name}</span>
                  <span className="text-xs text-muted-foreground">{material.subtitle}</span>
                </div>
              </div>
              <div className="flex justify-between items-baseline border-t border-border pt-2.5 mt-1">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-extrabold text-accent-gold tabular-nums">
                  {formatARS(total)}
                </span>
              </div>
            </div>

            {/* Expandable card list */}
            <button
              onClick={() => setListOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 border-t border-border text-xs text-muted-foreground hover:bg-surface-raised transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Ver las {totalCards} cartas del mazo
              </span>
              {listOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {listOpen && (
              <div className="max-h-64 overflow-y-auto border-t border-border">
                {entries.map((entry) => {
                  const thumb = getThumb(entry)
                  const isDfc = Array.isArray(entry.card.card_faces) && entry.card.card_faces.length >= 2
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-2 border-b border-border/50 last:border-0">
                      {thumb ? (
                        <img src={thumb} alt={entry.card.name} className="h-9 w-6 rounded-sm object-cover shrink-0" />
                      ) : (
                        <div className="h-9 w-6 rounded-sm bg-surface-raised shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{entry.card.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {(entry.selectedPrint ?? entry.card).set_name}{isDfc && " · Doble faz"}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-accent-gold shrink-0">×{entry.quantity}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Contact form ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Tus datos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Para coordinar la entrega y el pago.</p>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre</label>
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(
                    "w-full rounded-lg border border-input bg-surface-raised px-3 py-2 text-sm text-foreground",
                    "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow",
                  )}
                />
              </div>
              {/* Contact method toggle */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">¿Cómo te contactamos?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setContactMethod("email")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex-1 justify-center",
                      contactMethod === "email"
                        ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                        : "border-border bg-surface-raised text-muted-foreground hover:border-border/70"
                    )}
                  >
                    <Mail className="h-3.5 w-3.5" /> Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMethod("whatsapp")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex-1 justify-center",
                      contactMethod === "whatsapp"
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                        : "border-border bg-surface-raised text-muted-foreground hover:border-border/70"
                    )}
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </button>
                </div>

                {contactMethod === "email" ? (
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      "w-full rounded-lg border border-input bg-surface-raised px-3 py-2 text-sm text-foreground",
                      "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow",
                    )}
                  />
                ) : (
                  <input
                    type="tel"
                    placeholder="+54 9 11 1234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={cn(
                      "w-full rounded-lg border border-input bg-surface-raised px-3 py-2 text-sm text-foreground",
                      "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow",
                    )}
                  />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notas (opcional)</label>
                <textarea
                  placeholder="Aclaraciones, variantes, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={cn(
                    "w-full rounded-lg border border-input bg-surface-raised px-3 py-2 text-sm text-foreground resize-none",
                    "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow",
                  )}
                />
              </div>
            </div>
          </div>

          {sendError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2">
              {sendError}
            </p>
          )}

          <Button
            onClick={handleSend}
            disabled={!name.trim() || (contactMethod === "email" ? !email.trim() : !phone.trim()) || sending}
            className="w-full bg-accent-gold text-surface font-semibold hover:bg-accent-gold/90 disabled:opacity-40"
            size="lg"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar pedido
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground/60 -mt-1">
            Te contactamos para coordinar el pago y la entrega.
          </p>
        </div>
      </div>
    </div>
  )
}
