"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Layers,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react"
import { getMaterial, formatARS } from "@/lib/materials"

type OrderStatus = "pending" | "confirmed" | "printing" | "shipped" | "delivered" | "cancelled"

interface Order {
  id: string
  short_code: string
  name: string
  status: OrderStatus
  created_at: string
  pack_size: number
  material_id: string
  total_price: number
  deck: { name: string; quantity: number }[]
}

const STATUS_STEPS: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { key: "pending",   label: "Recibido",    icon: <Clock className="h-4 w-4" /> },
  { key: "confirmed", label: "Confirmado",  icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: "printing",  label: "Imprimiendo", icon: <Package className="h-4 w-4" /> },
  { key: "shipped",   label: "Enviado",     icon: <Truck className="h-4 w-4" /> },
  { key: "delivered", label: "Entregado",   icon: <CheckCircle2 className="h-4 w-4" /> },
]

const STATUS_ORDER: OrderStatus[] = ["pending", "confirmed", "printing", "shipped", "delivered"]

function statusIndex(s: OrderStatus) {
  return STATUS_ORDER.indexOf(s)
}

export default function OrderDetailPage() {
  const { code } = useParams<{ code: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!code) return
    fetch(`/api/order-status/${code}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then((data) => { if (data) { setOrder(data); setLoading(false) } })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [code])

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const material = order ? getMaterial(order.material_id) : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold text-white">
              <Layers className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="font-extrabold text-base tracking-tight text-foreground">
              Proxie<span className="text-accent-gold">.cards</span>
            </span>
          </Link>
          <Link
            href="/builder"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/85 transition-colors"
          >
            Hacer pedido
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        {/* Breadcrumb */}
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Buscar otro pedido
        </Link>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-border border-t-accent-gold animate-spin" />
            <p className="text-sm text-muted-foreground">Buscando tu pedido…</p>
          </div>
        )}

        {notFound && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Pedido no encontrado</h1>
            <p className="text-sm text-muted-foreground max-w-xs">
              No encontramos un pedido con el código <strong className="font-mono">{code}</strong>. Verificá que el código sea correcto.
            </p>
            <Link
              href="/orders"
              className="mt-2 px-5 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:bg-foreground/85 transition-colors"
            >
              Intentar de nuevo
            </Link>
          </div>
        )}

        {order && !loading && (
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-foreground tracking-tight">
                  Pedido de {order.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {new Date(order.created_at).toLocaleDateString("es-AR", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:border-accent-gold/50 transition-colors text-xs font-mono font-bold text-muted-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-accent-gold" /> : <Copy className="h-3.5 w-3.5" />}
                {code}
              </button>
            </div>

            {/* Status stepper */}
            {order.status !== "cancelled" ? (
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h2 className="text-sm font-bold text-foreground mb-5">Estado del pedido</h2>
                <div className="flex items-start gap-0">
                  {STATUS_STEPS.map((step, i) => {
                    const currentIdx = statusIndex(order.status)
                    const isDone = i <= currentIdx
                    const isActive = i === currentIdx
                    const isLast = i === STATUS_STEPS.length - 1
                    return (
                      <div key={step.key} className="flex flex-1 flex-col items-center">
                        <div className="flex items-center w-full">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors z-10 ${
                            isActive
                              ? "border-accent-gold bg-accent-gold text-white shadow-md shadow-accent-gold/25"
                              : isDone
                              ? "border-accent-gold/60 bg-accent-gold/10 text-accent-gold"
                              : "border-border bg-surface text-muted-foreground/40"
                          }`}>
                            {step.icon}
                          </div>
                          {!isLast && (
                            <div className={`h-0.5 flex-1 transition-colors ${
                              i < currentIdx ? "bg-accent-gold/50" : "bg-border"
                            }`} />
                          )}
                        </div>
                        <p className={`mt-2 text-[10px] font-semibold text-center leading-tight ${
                          isActive ? "text-accent-gold" : isDone ? "text-foreground" : "text-muted-foreground/50"
                        }`}>
                          {step.label}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 flex items-center gap-3">
                <XCircle className="h-6 w-6 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-bold text-destructive">Pedido cancelado</p>
                  <p className="text-xs text-muted-foreground">Si tenés alguna duda, contactanos.</p>
                </div>
              </div>
            )}

            {/* Order details */}
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-bold text-foreground">Detalles del pedido</h2>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Material</span>
                  <span className="font-semibold">{material?.name ?? order.material_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cartas</span>
                  <span className="font-semibold">{order.pack_size}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-extrabold text-accent-gold text-base tabular-nums">
                    {formatARS(order.total_price)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card list */}
            {Array.isArray(order.deck) && order.deck.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="text-sm font-bold text-foreground">
                    Cartas ({order.deck.reduce((s, c) => s + (c.quantity ?? 1), 0)} total)
                  </h2>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                  {order.deck.map((card, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
                      <span className="text-foreground truncate">{card.name}</span>
                      <span className="text-accent-gold font-bold shrink-0 ml-3">×{card.quantity ?? 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
