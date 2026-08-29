"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, LogOut, RefreshCw, ChevronDown, FileDown, Printer, Eye, EyeOff, LayoutGrid, Tag, Plus, Trash2, Pencil, X, Check, Send, MapPin, Truck, Bell, Package, Scissors, Users, ShoppingBag, UserPlus, Wallet, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getMaterial, formatARS } from "@/lib/materials"
import { calcPrice, type PriceTier } from "@/lib/pricing"
import type { MaterialId, PackSize } from "@/lib/materials"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string
  created_at: string
  name: string
  email: string
  notes: string | null
  pack_size: number
  material_id: string
  total_price: number
  deck: DeckEntry[]
  status: OrderStatus
  delivery_method?: "pickup" | "shipping"
  address?: string | null
  tracking_code?: string | null
  pickup_ready_at?: string | null
}

interface DeckEntry {
  id: string
  name: string
  quantity: number
  set_name: string
  image_uri?: string
}

type OrderStatus = "pending" | "paid" | "printing" | "packaged" | "shipped" | "ready_pickup" | "delivered"

interface AdminUserRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  order_count: number
  total_spent: number
  deck_count: number
  last_deck_update: string | null
}

interface AdminUsersStats {
  total_users: number
  new_last_7_days: number
  new_last_30_days: number
  users_with_orders: number
  total_revenue: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: string }> = {
  pending:      { label: "Pendiente de pago", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",  icon: "⏳" },
  paid:         { label: "Pagado",            color: "bg-blue-500/20 text-blue-300 border-blue-500/30",        icon: "✓"  },
  printing:     { label: "En impresión",      color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: "🖨" },
  packaged:     { label: "Empaquetado",       color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30", icon: "📦" },
  shipped:      { label: "Despachado",        color: "bg-orange-500/20 text-orange-300 border-orange-500/30", icon: "🚚" },
  ready_pickup: { label: "Listo para retirar",color: "bg-amber-500/20 text-amber-300 border-amber-500/30",    icon: "✅" },
  delivered:    { label: "Entregado",         color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: "🎉" },
}

const STATUS_ORDER: OrderStatus[] = ["pending", "paid", "printing", "packaged", "shipped", "ready_pickup", "delivered"]

// The 5 steps shown in the visual timeline
function OrderTimeline({ order }: { order: Order }) {
  const isPickup   = order.delivery_method !== "shipping"
  const steps = isPickup
    ? (["paid", "printing", "packaged", "ready_pickup", "delivered"] as OrderStatus[])
    : (["paid", "printing", "packaged", "shipped",      "delivered"] as OrderStatus[])

  const currentIdx = steps.indexOf(order.status)

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto py-1">
      {steps.map((step, i) => {
        const done   = currentIdx > i
        const active = currentIdx === i
        const cfg    = STATUS_CONFIG[step]
        return (
          <div key={step} className="flex items-center flex-1 min-w-0">
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-all shrink-0",
              done   ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" :
              active ? cn(cfg.color)                                               :
                       "bg-surface border-border text-muted-foreground/50"
            )}>
              <span>{done ? "✓" : cfg.icon}</span>
              <span className="hidden sm:inline">{cfg.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px flex-1 mx-1 transition-colors", done ? "bg-emerald-500/40" : "bg-border")} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── PDF generation helper ────────────────────────────────────────────────────

/**
 * Attempt to upgrade a Scryfall image URL to its PNG variant.
 * Scryfall URLs follow the pattern:
 *   https://cards.scryfall.io/{size}/front/…/{id}.jpg
 * We swap the size segment to "png" and change the extension.
 * If the URL doesn't match the expected pattern, return it unchanged.
 */
function upgradeImageToPng(url: string): string {
  // Match: https://cards.scryfall.io/<size>/<rest>.<ext>
  const match = url.match(/^(https:\/\/cards\.scryfall\.io\/)([^/]+)(\/.+?)(\.jpg|\.jpeg|\.png)(\?.*)?$/)
  if (!match) return url
  const [, base, , path, , query] = match
  return `${base}png${path}.png${query ?? ""}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildOrderEntries(order: Order): any[] {
  return order.deck.map((d) => {
    // Prefer PNG quality — upgrade stored URL to the PNG variant when possible.
    // getCardImageUrls() in generate-pdf now prefers `png` first.
    const rawUri = d.image_uri
    const pngUri = rawUri ? upgradeImageToPng(rawUri) : undefined
    const cardObj = {
      id: d.id,
      name: d.name,
      oracle_id: d.id,
      set_name: d.set_name,
      ...(pngUri
        ? { image_uris: { png: pngUri, large: rawUri, normal: rawUri } }
        : {}),
    }
    return { id: d.id, quantity: d.quantity, card: cardObj, selectedPrint: cardObj }
  })
}



// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [pin, setPin]           = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, pin }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Credenciales incorrectas")
      }
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full rounded-lg border border-input bg-surface-raised px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow"

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gold text-background font-black text-xl mb-4">
            P
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Panel de admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Proxie.cards</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} required autoComplete="email" />
          <div className="relative">
            <input type={showPw ? "text" : "password"} placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className={cn(inputClass, "pr-10")} required autoComplete="current-password" />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <input type="text" inputMode="numeric" placeholder="PIN" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} className={inputClass} required />

          {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full bg-accent-gold text-surface font-semibold hover:bg-accent-gold/90 mt-1">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ingresando...</> : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  )
}

// ─── Notify Modal ─────────────────────────────────────────────────────────────

function NotifyModal({
  type,
  orderId,
  onClose,
  onSuccess,
}: {
  type: "shipped" | "ready_pickup"
  orderId: string
  onClose: () => void
  onSuccess: (status: OrderStatus) => void
}) {
  const [trackingCode, setTrackingCode] = useState("")
  const [carrier,      setCarrier]      = useState("")
  const [sending,      setSending]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/order-status/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "shipped"
            ? { orderId, type, trackingCode, carrier: carrier || undefined }
            : { orderId, type }
        ),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Error al notificar")
      }
      onSuccess(type === "shipped" ? "shipped" : "ready_pickup")
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSending(false)
    }
  }

  const inputCls = "w-full rounded-lg border border-input bg-surface-raised px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/30"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {type === "shipped" ? "Notificar envio" : "Notificar listo para retirar"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {type === "shipped"
                ? "Se actualizara el estado y se enviara el codigo de seguimiento por email."
                : "Se actualizara el estado y se notificara al cliente con horarios y fecha limite."}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-surface-raised transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {type === "shipped" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Codigo de seguimiento *</label>
              <input
                type="text"
                placeholder="Ej: AR123456789AR"
                value={trackingCode}
                onChange={e => setTrackingCode(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Correo / Operador <span className="normal-case font-normal">(opcional)</span></label>
              <input
                type="text"
                placeholder="Ej: Correo Argentino, OCA..."
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        )}

        {type === "ready_pickup" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
            <p className="text-xs text-amber-300/80 leading-relaxed">
              El email incluira el punto de retiro y los horarios configurados en <code className="bg-surface-raised px-1 rounded text-foreground">lib/email-templates.ts</code>. El cliente tendra <strong className="text-amber-200">8 dias</strong> para retirar desde hoy.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSend}
            disabled={sending || (type === "shipped" && !trackingCode.trim())}
            className="flex-1 bg-accent-gold text-background font-bold hover:bg-accent-gold/90 disabled:opacity-50"
          >
            {sending
              ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Enviando...</>
              : <><Send className="mr-2 h-3.5 w-3.5" />Enviar notificacion</>}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={sending} className="border-border text-muted-foreground hover:text-foreground">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order, onStatusChange }: { order: Order; onStatusChange: (id: string, status: OrderStatus) => void }) {
  const [open,       setOpen]       = useState(false)
  const [updating,   setUpdating]   = useState(false)
  const [genPdf,     setGenPdf]     = useState(false)
  const [genPdfFile, setGenPdfFile] = useState(false)
  const [printing,   setPrinting]   = useState(false)
  const [genQuick,   setGenQuick]   = useState(false)
  const [notifyType, setNotifyType] = useState<"shipped" | "ready_pickup" | null>(null)
  // Mirror-bleed control: 2 mm is the maximum (default); 0 = no bleed
  const [bleedMm,            setBleedMm]            = useState(2)
  // Cricut centered test mode: SVG forced to 27 cm wide, centred, for calibration
  const [cricutCenteredMode, setCricutCenteredMode] = useState(false)
  // Horizontal offset for the card grid only (mm). Cricut marks stay fixed.
  const [cardOffsetXMm,      setCardOffsetXMm]      = useState(0)

  const cfg  = STATUS_CONFIG[order.status]
  const mat  = getMaterial(order.material_id as MaterialId)
  const date = new Date(order.created_at).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  })
  const totalCards    = order.deck.reduce((s, d) => s + d.quantity, 0)
  const isPickup      = order.delivery_method !== "shipping"
  const hasEmail      = order.email && !order.email.startsWith("whatsapp:")

  async function handleStatus(status: OrderStatus) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Error al actualizar")
      onStatusChange(order.id, status)
    } catch {
      alert("Error al actualizar el estado")
    } finally {
      setUpdating(false)
    }
  }

  async function handlePdf() {
    setGenPdf(true)
    try {
      const { generateZip } = await import("@/lib/generate-pdf")
      await generateZip({ entries: buildOrderEntries(order), onProgress: () => {}, clientName: order.name, date: order.created_at, bleedMm, cricutCenteredMode, cardOffsetXMm })
    } catch { alert("Error al generar ZIP de imagenes") } finally { setGenPdf(false) }
  }

  async function handlePdfFile() {
    setGenPdfFile(true)
    try {
      const { generatePdf } = await import("@/lib/generate-pdf")
      await generatePdf({ entries: buildOrderEntries(order), onProgress: () => {}, bleedMm, cricutCenteredMode, cardOffsetXMm })
    } catch (err) {
      alert("Error al generar PDF: " + (err instanceof Error ? err.message : String(err)))
    } finally { setGenPdfFile(false) }
  }

  async function handlePrint() {
    setPrinting(true)
    try {
      const { printPdf } = await import("@/lib/generate-pdf")
      await printPdf({ entries: buildOrderEntries(order), onProgress: () => {}, bleedMm, cricutCenteredMode, cardOffsetXMm })
    } catch { alert("Error al imprimir") } finally { setPrinting(false) }
  }

  async function handleQuickExport() {
    setGenQuick(true)
    try {
      const { generateGuillotinePdf } = await import("@/lib/generate-pdf")
      await generateGuillotinePdf({ entries: buildOrderEntries(order), onProgress: () => {} })
    } catch (err) {
      alert("Error al generar la exportacion rapida: " + (err instanceof Error ? err.message : String(err)))
    } finally { setGenQuick(false) }
  }

  return (
    <>
      {notifyType && (
        <NotifyModal
          type={notifyType}
          orderId={order.id}
          onClose={() => setNotifyType(null)}
          onSuccess={(status) => { onStatusChange(order.id, status); setNotifyType(null) }}
        />
      )}

    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-raised transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="text-sm font-semibold text-foreground truncate">{order.name}</p>
            <p className="text-xs text-muted-foreground truncate">{order.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pedido</p>
            <p className="text-sm font-semibold">{totalCards} cartas · {mat.name}</p>
            <p className="text-xs text-accent-gold font-bold">{formatARS(order.total_price)}</p>
          </div>
          <div className="hidden md:block">
            <p className="text-xs text-muted-foreground">Fecha</p>
            <p className="text-sm">{date}</p>
          </div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estado</p>
              <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", cfg.color)}>
                {cfg.label}
              </span>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5">
                {isPickup ? <MapPin className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                {isPickup ? "Retiro" : "Envio"}
              </p>
            </div>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border px-4 py-5 space-y-5">

          {/* Visual timeline */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Package className="h-3 w-3" /> Progreso del pedido
            </p>
            <OrderTimeline order={order} />
          </div>

          {/* Notify actions — only show when email is available */}
          {hasEmail && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bell className="h-3 w-3" /> Notificaciones por email
              </p>
              <div className="flex flex-wrap gap-2">
                {!isPickup && (
                  <button
                    onClick={() => setNotifyType("shipped")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-300 text-xs font-semibold hover:bg-orange-500/20 transition-colors"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    Notificar enviado
                  </button>
                )}
                {isPickup && (
                  <button
                    onClick={() => setNotifyType("ready_pickup")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Notificar listo para retirar
                  </button>
                )}
              </div>

              {/* Show tracking code if already set */}
              {order.tracking_code && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Codigo actual:</span>
                  <code className="bg-surface-raised px-2 py-0.5 rounded font-mono text-foreground">{order.tracking_code}</code>
                </div>
              )}
              {order.pickup_ready_at && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Disponible desde: {new Date(order.pickup_ready_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          )}

          {/* Delivery address */}
          {order.delivery_method === "shipping" && order.address && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Truck className="h-3 w-3" /> Direccion de envio
              </p>
              <p className="text-sm text-foreground bg-surface-raised rounded-lg px-3 py-2">{order.address}</p>
            </div>
          )}

          {/* Status update */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cambiar estado manualmente</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map(s => (
                <button
                  key={s}
                  disabled={updating || s === order.status}
                  onClick={() => handleStatus(s)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-all",
                    s === order.status
                      ? cn(STATUS_CONFIG[s].color, "cursor-default")
                      : "border-border text-muted-foreground hover:border-accent-gold/50 hover:text-foreground disabled:opacity-40"
                  )}
                >
                  {updating && s !== order.status ? <Loader2 className="h-3 w-3 animate-spin inline" /> : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notas</p>
              <p className="text-sm text-foreground bg-surface-raised rounded-lg px-3 py-2">{order.notes}</p>
            </div>
          )}

          {/* Deck list */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Mazo ({totalCards} cartas)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
              {order.deck.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-surface-raised rounded-lg px-2 py-1.5">
                  {d.image_uri && (
                    <img src={d.image_uri} alt={d.name} className="h-8 w-6 object-cover rounded-sm shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate text-foreground">{d.name}</p>
                    <p className="text-muted-foreground">x{d.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Print actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <LayoutGrid className="h-3 w-3" />
              Impresion · 8 cartas A4 horizontal · 600 DPI
            </p>
            {/* DFC info note */}
            <div className="rounded-lg border border-accent-gold/20 bg-accent-gold/5 px-3 py-2 text-[11px] text-accent-gold/80 leading-relaxed">
              Si el pedido contiene cartas de doble cara, el ZIP incluira una carpeta
              {" "}<code className="font-mono bg-black/30 px-1 rounded">doble_cara/</code>{" "}
              con las paginas A+B etiquetadas. Imprimir esa carpeta con papel diferente.
            </div>

            {/* Mirror-bleed control */}
            <div className="rounded-lg border border-border bg-surface-raised px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Extension en espejo
                </label>
                <span className={cn(
                  "text-xs font-mono font-bold tabular-nums",
                  bleedMm === 2 ? "text-accent-gold" : bleedMm === 0 ? "text-muted-foreground/50" : "text-foreground"
                )}>
                  {bleedMm.toFixed(1)} mm{bleedMm === 2 ? " (max)" : bleedMm === 0 ? " (sin extension)" : ""}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={bleedMm}
                onChange={e => setBleedMm(parseFloat(e.target.value))}
                disabled={genPdf || genPdfFile || printing || genQuick}
                className="w-full h-1.5 appearance-none rounded-full bg-border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-gold [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent-gold [&::-moz-range-thumb]:border-0"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground/50 tabular-nums select-none">
                <span>0 mm</span>
                <span>0.5</span>
                <span>1.0</span>
                <span>1.5</span>
                <span>2.0 mm</span>
              </div>
            </div>

            {/* Card horizontal offset */}
            <div className="rounded-lg border border-border bg-surface-raised px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Offset horizontal cartas
                </label>
                <span className={cn(
                  "text-xs font-mono font-bold tabular-nums",
                  cardOffsetXMm === 0 ? "text-muted-foreground/50" : "text-foreground"
                )}>
                  {cardOffsetXMm > 0 ? "+" : ""}{cardOffsetXMm.toFixed(1)} mm{cardOffsetXMm === 0 ? " (centro)" : ""}
                </span>
              </div>
              <input
                type="range"
                min={-20}
                max={20}
                step={0.1}
                value={cardOffsetXMm}
                onChange={e => setCardOffsetXMm(parseFloat(e.target.value))}
                disabled={genPdf || genPdfFile || printing || genQuick}
                className="w-full h-1.5 appearance-none rounded-full bg-border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:border-0"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground/50 tabular-nums select-none">
                <span>-20 mm</span>
                <span>-10</span>
                <span>0</span>
                <span>+10</span>
                <span>+20 mm</span>
              </div>
            </div>

            {/* Cricut centered test mode */}
            <button
              type="button"
              onClick={() => setCricutCenteredMode(v => !v)}
              disabled={genPdf || genPdfFile || printing || genQuick}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all disabled:opacity-40",
                cricutCenteredMode
                  ? "border-accent-blue/40 bg-accent-blue/8"
                  : "border-border/60 bg-surface-raised hover:border-border"
              )}
            >
              {/* Toggle pill */}
              <div className={cn(
                "relative shrink-0 h-5 w-9 rounded-full transition-colors duration-200",
                cricutCenteredMode ? "bg-accent-blue" : "bg-border"
              )}>
                <div className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200",
                  cricutCenteredMode ? "left-[18px]" : "left-0.5"
                )} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className={cn(
                  "text-[12px] font-bold leading-tight",
                  cricutCenteredMode ? "text-accent-blue" : "text-muted-foreground"
                )}>
                  Modo calibracion Cricut
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-snug">
                  {cricutCenteredMode
                    ? "Marcas a 27 cm × 19.4 cm, centradas — sin proporcion"
                    : "Fuerza las marcas a 27 cm × 19.4 cm para calibrar el plotter"
                  }
                </p>
              </div>
            </button>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePdf}
                disabled={genPdf || genPdfFile || printing || genQuick}
                className="border-border text-muted-foreground hover:text-foreground hover:border-accent-gold/50"
              >
                {genPdf
                  ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Generando imagenes...</>
                  : <><FileDown className="mr-2 h-3.5 w-3.5" />Descargar PNGs (.zip)</>}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePdfFile}
                disabled={genPdf || genPdfFile || printing || genQuick}
                className="border-border text-muted-foreground hover:text-foreground hover:border-accent-gold/50"
              >
                {genPdfFile
                  ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Generando PDF...</>
                  : <><FileDown className="mr-2 h-3.5 w-3.5" />Descargar PDF</>}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={genPdf || genPdfFile || printing || genQuick}
                className="border-border text-muted-foreground hover:text-foreground hover:border-accent-gold/50"
              >
                {printing
                  ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Preparando...</>
                  : <><Printer className="mr-2 h-3.5 w-3.5" />Imprimir</>}
              </Button>
            </div>
          </div>

          {/* Quick export — 3×3 guillotine layout, no Cricut marks */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Scissors className="h-3 w-3" />
              Exportacion rapida · 9 cartas A4 vertical · guillotina tradicional
            </p>
            <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 px-3 py-2 text-[11px] text-accent-blue/80 leading-relaxed">
              Grilla de 3×3 sin marcas Cricut: las cartas van pegadas entre si (sin sangria) para
              aprovechar mas la hoja, con un marco negro en el borde exterior de la grilla y guias
              de corte que recorren toda la hoja de arriba a abajo, pensadas para cortar con guillotina.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuickExport}
              disabled={genPdf || genPdfFile || printing || genQuick}
              className="border-accent-blue/40 text-accent-blue hover:text-accent-blue hover:border-accent-blue/70 hover:bg-accent-blue/10"
            >
              {genQuick
                ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Generando PDF...</>
                : <><Scissors className="mr-2 h-3.5 w-3.5" />Exportacion rapida</>}
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

// ─── Pricing Panel ──────────────────────────────────────────────────────────���

const EMPTY_TIER = { min_cards: 0, max_cards: null as number | null, total_price: 0, label: "" as string, is_active: true, sort_order: 0 }

function PricingPanel() {
  const [tiers, setTiers]           = useState<PriceTier[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState<string | null>(null) // id being saved
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [editId, setEditId]         = useState<string | null>(null)
  const [editForm, setEditForm]     = useState<Partial<PriceTier>>({})
  const [addOpen, setAddOpen]       = useState(false)
  const [addForm, setAddForm]       = useState({ ...EMPTY_TIER })
  const [preview, setPreview]       = useState<number>(100)
  const [shippingRate, setShippingRate]   = useState<number>(8700)
  const [shippingInput, setShippingInput] = useState<string>("8700")
  const [savingShipping, setSavingShipping] = useState(false)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => {
        const rate = Number(d.settings?.shipping_rate)
        if (!isNaN(rate) && rate > 0) { setShippingRate(rate); setShippingInput(String(rate)) }
      })
      .catch(() => {})
  }, [])

  async function handleSaveShipping() {
    const val = parseInt(shippingInput)
    if (isNaN(val) || val <= 0) return
    setSavingShipping(true)
    try {
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "shipping_rate", value: String(val) }),
      })
      setShippingRate(val)
    } finally { setSavingShipping(false) }
  }

  const fetchTiers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/pricing")
      if (!res.ok) throw new Error("Error al cargar precios")
      const data = await res.json()
      setTiers(data.tiers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTiers() }, [fetchTiers])

  const activeTiers = tiers.filter(t => t.is_active)
  const previewPrice = calcPrice(activeTiers, preview)
  const previewUnit  = preview > 0 ? Math.round(previewPrice / preview) : 0

  async function handleSave(id: string) {
    setSaving(id)
    setError(null)
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editForm }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { tier } = await res.json()
      setTiers(prev => prev.map(t => t.id === id ? tier : t))
      setEditId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este tier?")) return
    setDeleting(id)
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setTiers(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setDeleting(null)
    }
  }

  async function handleToggleActive(tier: PriceTier) {
    setSaving(tier.id)
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tier.id, is_active: !tier.is_active }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { tier: updated } = await res.json()
      setTiers(prev => prev.map(t => t.id === tier.id ? updated : t))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSaving(null)
    }
  }

  async function handleAdd() {
    setSaving("new")
    setError(null)
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          max_cards: addForm.max_cards === 0 ? null : addForm.max_cards,
          label: addForm.label || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { tier } = await res.json()
      setTiers(prev => [...prev, tier].sort((a, b) => a.sort_order - b.sort_order))
      setAddOpen(false)
      setAddForm({ ...EMPTY_TIER })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSaving(null)
    }
  }

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-gold/30 tabular-nums"
  const labelCls = "text-[10px] font-bold text-muted-foreground uppercase tracking-widest"

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Section header ────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-bold text-foreground">Precios por volumen</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          El precio se calcula sobre el <strong className="text-foreground/70">total de cartas del pedido</strong>, no por mazo. Minimo 30 cartas para comprar.
        </p>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">{error}</p>}

      {/* ── Tier cards ────────────────────────��──────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {[...tiers].sort((a, b) => a.sort_order - b.sort_order).map((tier, idx) => {
            const unitPrice = tier.min_cards > 0 ? Math.round(tier.total_price / tier.min_cards) : 0
            const isEditing = editId === tier.id
            const colors = [
              { bar: "bg-accent-gold", text: "text-accent-gold", ring: "ring-accent-gold/30" },
              { bar: "bg-accent-blue", text: "text-accent-blue", ring: "ring-accent-blue/30" },
              { bar: "bg-emerald-500", text: "text-emerald-400", ring: "ring-emerald-500/30" },
            ]
            const color = colors[idx % colors.length]

            return (
              <div
                key={tier.id}
                className={cn(
                  "rounded-xl border bg-surface transition-all",
                  isEditing ? "border-accent-gold/50" : tier.is_active ? "border-border" : "border-border/40 opacity-60"
                )}
              >
                {/* Tier header — always visible */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", color.bar)} />
                    <div>
                      <span className="text-sm font-bold text-foreground">
                        {tier.min_cards}–{tier.max_cards ? tier.max_cards : "∞"} cartas
                      </span>
                      {tier.label && (
                        <span className="ml-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{tier.label}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!isEditing && (
                      <div className="text-right mr-2">
                        <p className={cn("text-base font-extrabold tabular-nums", color.text)}>{formatARS(unitPrice)}<span className="text-xs font-normal text-muted-foreground">/carta</span></p>
                      </div>
                    )}
                    <button
                      onClick={() => handleToggleActive(tier)}
                      disabled={saving === tier.id}
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all",
                        tier.is_active
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          : "border-border bg-surface text-muted-foreground hover:bg-surface-raised"
                      )}
                    >
                      {tier.is_active ? "Activo" : "Inactivo"}
                    </button>
                    <button
                      onClick={() => isEditing ? setEditId(null) : (setEditId(tier.id), setEditForm({ ...tier }))}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
                      title={isEditing ? "Cancelar" : "Editar"}
                    >
                      {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(tier.id)}
                      disabled={deleting === tier.id}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      {deleting === tier.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Edit form — shown inline below header */}
                {isEditing && (
                  <div className="px-4 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={labelCls}>Desde (cartas)</label>
                        <input type="number" min={1} value={editForm.min_cards ?? ""} onChange={e => setEditForm(f => ({ ...f, min_cards: parseInt(e.target.value) || 0 }))} className={inputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Hasta (vacío = ilimitado)</label>
                        <input type="number" min={0} value={editForm.max_cards ?? ""} placeholder="∞" onChange={e => setEditForm(f => ({ ...f, max_cards: e.target.value === "" ? null : parseInt(e.target.value) }))} className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={labelCls}>Precio por carta (ARS)</label>
                        <input
                          type="number" min={1}
                          value={editForm.min_cards && editForm.total_price ? Math.round(editForm.total_price / editForm.min_cards) : ""}
                          onChange={e => {
                            const unit = parseInt(e.target.value) || 0
                            setEditForm(f => ({ ...f, total_price: unit * (f.min_cards ?? 1) }))
                          }}
                          className={inputCls}
                        />
                        <p className="text-[10px] text-muted-foreground">Total tier: {formatARS(editForm.total_price ?? 0)}</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Etiqueta (opcional)</label>
                        <input type="text" value={editForm.label ?? ""} placeholder="Ej: Popular, Mejor precio…" onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleSave(tier.id)}
                        disabled={saving === tier.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-gold text-background text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                      >
                        {saving === tier.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Guardar cambios
                      </button>
                      <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add tier ───────────────────────────────────────────────── */}
      {addOpen ? (
        <div className="rounded-xl border border-accent-gold/40 bg-accent-gold/5 p-4 space-y-4">
          <p className="text-xs font-bold text-accent-gold uppercase tracking-widest">Nuevo tier</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Desde (cartas)</label>
              <input type="number" min={1} value={addForm.min_cards || ""} onChange={e => setAddForm(f => ({ ...f, min_cards: parseInt(e.target.value) || 0 }))} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Hasta (vacío = ilimitado)</label>
              <input type="number" min={0} value={addForm.max_cards ?? ""} placeholder="∞" onChange={e => setAddForm(f => ({ ...f, max_cards: e.target.value === "" ? null : parseInt(e.target.value) || 0 }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Precio por carta (ARS)</label>
              <input
                type="number" min={1}
                value={addForm.min_cards && addForm.total_price ? Math.round(addForm.total_price / addForm.min_cards) : ""}
                onChange={e => {
                  const unit = parseInt(e.target.value) || 0
                  setAddForm(f => ({ ...f, total_price: unit * (f.min_cards || 1) }))
                }}
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground">Total tier: {formatARS(addForm.total_price)}</p>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Etiqueta (opcional)</label>
              <input type="text" value={addForm.label ?? ""} placeholder="Ej: Popular…" onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAdd} disabled={saving === "new"} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-gold text-background text-xs font-bold disabled:opacity-50 hover:brightness-110 transition-all">
              {saving === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Guardar tier
            </button>
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 text-xs font-semibold text-accent-gold hover:brightness-110 transition-all">
          <Plus className="h-3.5 w-3.5" /> Agregar tier de precio
        </button>
      )}

      {/* ── Calculadora + Envio ───────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border">
        {/* Calculadora */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Calculadora
          </p>
          <div className="space-y-1.5">
            <label className={labelCls}>Cantidad de cartas</label>
            <input
              type="number" min={1}
              value={preview}
              onChange={e => setPreview(Math.max(1, parseInt(e.target.value) || 1))}
              className={inputCls}
            />
          </div>
          <div className="rounded-lg bg-surface-raised border border-border/60 px-3 py-2.5 flex items-end justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Total pedido</p>
              <p className="text-xl font-extrabold text-accent-gold tabular-nums">{formatARS(previewPrice)}</p>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums pb-0.5">{formatARS(previewUnit)}/carta</p>
          </div>
        </div>

        {/* Envio */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Envio fijo
          </p>
          <div className="space-y-1.5">
            <label className={labelCls}>Tarifa de envio (ARS)</label>
            <input
              type="number" min={0}
              value={shippingInput}
              onChange={e => setShippingInput(e.target.value)}
              className={inputCls}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSaveShipping}
            disabled={savingShipping || parseInt(shippingInput) === shippingRate}
            className="bg-accent-gold text-background hover:brightness-110 font-bold w-full"
          >
            {savingShipping ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
            Guardar
          </Button>
          <p className="text-[10px] text-muted-foreground/60">Vigente: <strong className="text-foreground/70">{formatARS(shippingRate)}</strong></p>
        </div>
      </div>
    </div>
  )
}

// ─── Pickup Points Panel ──────────────────────────────────────────────────────

interface PickupPoint {
  id:              string
  created_at:      string
  name:            string
  address:         string
  city:            string
  google_maps_url: string | null
  hours:           string | null
  phone:           string | null
  notes:           string | null
  active:          boolean
}

function PickupPointsPanel() {
  const [points,  setPoints]  = useState<PickupPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PickupPoint | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const emptyForm = { name: "", address: "", city: "", google_maps_url: "", hours: "", phone: "", notes: "" }
  const [form, setForm] = useState(emptyForm)

  async function loadPoints() {
    setLoading(true)
    const res = await fetch("/api/admin/pickup-points")
    const data = await res.json()
    setPoints(data.points ?? [])
    setLoading(false)
  }

  useEffect(() => { loadPoints() }, [])

  function openNew() { setEditing(null); setForm(emptyForm); setShowForm(true); setError(null) }
  function openEdit(pt: PickupPoint) {
    setEditing(pt)
    setForm({ name: pt.name, address: pt.address, city: pt.city ?? "", google_maps_url: pt.google_maps_url ?? "", hours: pt.hours ?? "", phone: pt.phone ?? "", notes: pt.notes ?? "" })
    setShowForm(true)
    setError(null)
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const url    = editing ? `/api/admin/pickup-points/${editing.id}` : "/api/admin/pickup-points"
      const method = editing ? "PATCH" : "POST"
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error al guardar") }
      await loadPoints()
      setShowForm(false)
    } catch (e) { setError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  async function handleToggleActive(pt: PickupPoint) {
    await fetch(`/api/admin/pickup-points/${pt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !pt.active }) })
    await loadPoints()
  }

  async function handleDelete(pt: PickupPoint) {
    if (!confirm(`Eliminar "${pt.name}"?`)) return
    await fetch(`/api/admin/pickup-points/${pt.id}`, { method: "DELETE" })
    await loadPoints()
  }

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/30"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Puntos de retiro</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Los clientes eligen donde retirar al hacer su pedido.</p>
        </div>
        <Button size="sm" onClick={openNew} className="bg-accent-gold text-background hover:bg-accent-gold/90 font-bold">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo punto
        </Button>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Cargando...</p>}

      {!loading && points.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface py-12 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay puntos de retiro. Crea el primero.</p>
        </div>
      )}

      <div className="space-y-3">
        {points.map(pt => (
          <div key={pt.id} className={cn("rounded-xl border bg-surface overflow-hidden", pt.active ? "border-border" : "border-border/40 opacity-60")}>
            <div className="px-4 py-3.5 flex items-start gap-3">
              <div className={cn("mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0", pt.active ? "bg-accent-gold/15" : "bg-surface-raised")}>
                <MapPin className={cn("h-4 w-4", pt.active ? "text-accent-gold" : "text-muted-foreground")} />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{pt.name}</p>
                  {!pt.active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-raised text-muted-foreground border border-border">INACTIVO</span>}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{pt.address}{pt.city ? `, ${pt.city}` : ""}</p>
                {pt.hours && <p className="text-xs text-muted-foreground/70">{pt.hours}</p>}
                {pt.phone && <p className="text-xs text-muted-foreground/70">{pt.phone}</p>}
                {pt.notes && <p className="text-xs text-muted-foreground/60 italic">{pt.notes}</p>}
                {pt.google_maps_url && (
                  <a href={pt.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-accent-gold hover:underline">
                    Ver en Maps
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(pt)} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleToggleActive(pt)} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                  {pt.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(pt)} className="h-7 px-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">{editing ? "Editar punto" : "Nuevo punto de retiro"}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-surface-raised">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3">
              {[
                { key: "name",            label: "Nombre *",        placeholder: "Ej: Local Centro" },
                { key: "address",         label: "Direccion *",     placeholder: "Av. Corrientes 1234, CABA" },
                { key: "city",            label: "Ciudad *",        placeholder: "Ej: La Plata" },
                { key: "google_maps_url", label: "Link Google Maps", placeholder: "https://maps.google.com/..." },
                { key: "hours",           label: "Horarios",        placeholder: "Lun–Vie 10–19 | Sab 10–14" },
                { key: "phone",           label: "Telefono",        placeholder: "+54 9 11 1234-5678" },
                { key: "notes",           label: "Notas",           placeholder: "Info adicional para el cliente" },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.address.trim() || !form.city.trim()} className="flex-1 bg-accent-gold text-background font-bold hover:bg-accent-gold/90">
                {saving ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Guardando...</> : <><Check className="mr-2 h-3.5 w-3.5" />Guardar</>}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving} className="border-border text-muted-foreground hover:text-foreground">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Discount Codes Panel ─────────────────────────────────────────────────────

type BenefitType = "percentage" | "free_shipping" | "bypass_payment"

interface DiscountCode {
  id:           string
  code:         string
  benefit_type: BenefitType
  percentage:   number | null
  max_uses:     number | null
  uses:         number
  expires_at:   string | null
  is_active:    boolean
  description:  string | null
  created_at:   string
}

const BENEFIT_LABELS: Record<BenefitType, string> = {
  percentage:      "% Descuento",
  free_shipping:   "Envio gratis",
  bypass_payment:  "Sin pago",
}

const BENEFIT_COLORS: Record<BenefitType, string> = {
  percentage:      "bg-accent-gold/15 text-accent-gold border-accent-gold/30",
  free_shipping:   "bg-blue-500/15 text-blue-300 border-blue-500/30",
  bypass_payment:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
}

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

const EMPTY_FORM = {
  code:         "",
  benefit_type: "percentage" as BenefitType,
  percentage:   30,
  max_uses:     "" as string | number,
  expires_at:   "",
  description:  "",
}

function DiscountCodesPanel() {
  const [codes,   setCodes]   = useState<DiscountCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [adding,  setAdding]  = useState(false)
  const [form,    setForm]    = useState({ ...EMPTY_FORM })
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch("/api/admin/discount-codes")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al cargar codigos")
      setCodes(data.codes)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setSaving(true); setSaveErr(null)
    try {
      const res  = await fetch("/api/admin/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code:         form.code.trim().toUpperCase() || randomCode(),
          benefit_type: form.benefit_type,
          percentage:   form.benefit_type === "percentage" ? Number(form.percentage) : null,
          max_uses:     form.max_uses !== "" ? Number(form.max_uses) : null,
          expires_at:   form.expires_at || null,
          description:  form.description.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al crear codigo")
      setCodes(prev => [data.code, ...prev])
      setAdding(false)
      setForm({ ...EMPTY_FORM })
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Error al guardar")
    } finally { setSaving(false) }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    setTogglingId(id)
    try {
      const res  = await fetch("/api/admin/discount-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !currentActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCodes(prev => prev.map(c => c.id === id ? data.code : c))
    } catch { alert("Error al actualizar el codigo") }
    finally { setTogglingId(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este codigo? Esta accion no se puede deshacer.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/discount-codes?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setCodes(prev => prev.filter(c => c.id !== id))
    } catch { alert("Error al eliminar el codigo") }
    finally { setDeletingId(null) }
  }

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-gold/30"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Codigos de descuento</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Genera y gestiona codigos para tus clientes</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setAdding(v => !v); setSaveErr(null) }}
          className="bg-accent-gold text-background font-bold hover:bg-accent-gold/90"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {adding ? "Cancelar" : "Nuevo codigo"}
        </Button>
      </div>

      {/* Create form */}
      {adding && (
        <div className="rounded-xl border border-accent-gold/20 bg-surface p-4 space-y-3">
          <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">Nuevo codigo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Code */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Codigo (opcional, se genera si vacio)</label>
              <div className="flex gap-2">
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="Ej: PROMO30"
                  className={cn(inputCls, "flex-1 uppercase tracking-widest font-mono")}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, code: randomCode() }))} className="shrink-0 border-border text-muted-foreground hover:text-foreground px-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Benefit type */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Tipo de beneficio</label>
              <select
                value={form.benefit_type}
                onChange={e => setForm(f => ({ ...f, benefit_type: e.target.value as BenefitType }))}
                className={inputCls}
              >
                <option value="percentage">Descuento porcentual (%)</option>
                <option value="free_shipping">Envio gratis</option>
                <option value="bypass_payment">Sin pago (pedido directo)</option>
              </select>
            </div>

            {/* Percentage (only when type = percentage) */}
            {form.benefit_type === "percentage" && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground font-medium">Porcentaje de descuento</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={100}
                    value={form.percentage}
                    onChange={e => setForm(f => ({ ...f, percentage: Number(e.target.value) }))}
                    className={cn(inputCls, "w-24 tabular-nums")}
                  />
                  <span className="text-sm text-muted-foreground font-bold">%</span>
                </div>
              </div>
            )}

            {/* Max uses */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Usos maximos (vacio = ilimitado)</label>
              <input
                type="number" min={1}
                value={form.max_uses}
                onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                placeholder="Ilimitado"
                className={cn(inputCls, "tabular-nums")}
              />
            </div>

            {/* Expiry */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">Fecha de vencimiento (opcional)</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                className={inputCls}
              />
            </div>

            {/* Description */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] text-muted-foreground font-medium">Descripcion / etiqueta interna (opcional)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ej: Promo julio 2025"
                className={inputCls}
              />
            </div>
          </div>

          {/* Benefit type info */}
          {form.benefit_type === "bypass_payment" && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-400/80 leading-relaxed">
              Al usar este codigo el pedido se crea directamente con estado <strong className="text-emerald-300">Pagado</strong>, sin pasar por MercadoPago. Uso exclusivo para pedidos internos.
            </div>
          )}

          {saveErr && <p className="text-xs text-red-400">{saveErr}</p>}

          <Button
            onClick={handleCreate}
            disabled={saving}
            className="bg-accent-gold text-background font-bold hover:bg-accent-gold/90"
          >
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Guardando...</> : <><Check className="h-3.5 w-3.5 mr-1.5" />Crear codigo</>}
          </Button>
        </div>
      )}

      {/* Codes list */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando codigos...
        </div>
      ) : error ? (
        <p className="text-sm text-red-400 py-4 text-center">{error}</p>
      ) : codes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tag className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No hay codigos todavia. Crea el primero.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {codes.map(code => {
            const expired   = code.expires_at && new Date(code.expires_at) < new Date()
            const exhausted = code.max_uses !== null && code.uses >= code.max_uses
            const faded     = !code.is_active || expired || exhausted
            return (
              <div
                key={code.id}
                className={cn(
                  "rounded-xl border bg-surface p-3 flex items-center gap-3 transition-opacity",
                  faded ? "opacity-50 border-border/50" : "border-border"
                )}
              >
                {/* Badge */}
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border shrink-0", BENEFIT_COLORS[code.benefit_type])}>
                  {BENEFIT_LABELS[code.benefit_type]}
                  {code.benefit_type === "percentage" && code.percentage ? ` ${code.percentage}%` : ""}
                </span>

                {/* Code + details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-foreground tracking-wider">{code.code}</span>
                    {!code.is_active && <span className="text-[10px] text-muted-foreground/50 border border-border/50 rounded px-1">inactivo</span>}
                    {expired     && <span className="text-[10px] text-red-400/70 border border-red-500/20 rounded px-1">vencido</span>}
                    {exhausted   && !expired && <span className="text-[10px] text-amber-400/70 border border-amber-500/20 rounded px-1">agotado</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      Usos: {code.uses}{code.max_uses ? ` / ${code.max_uses}` : ""}
                    </span>
                    {code.expires_at && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        Vence: {new Date(code.expires_at).toLocaleDateString("es-AR")}
                      </span>
                    )}
                    {code.description && (
                      <span className="text-[10px] text-muted-foreground/60">{code.description}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleToggle(code.id, code.is_active)}
                    disabled={togglingId === code.id}
                    title={code.is_active ? "Desactivar" : "Activar"}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  >
                    {togglingId === code.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : code.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleDelete(code.id)}
                    disabled={deletingId === code.id}
                    title="Eliminar"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                  >
                    {deletingId === code.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

  // ─── Users Panel ──────────────────────────────────────────────────────────────

  function UsersPanel({ onUnauthorized }: { onUnauthorized: () => void }) {
    const [users,   setUsers]   = useState<AdminUserRow[]>([])
    const [stats,   setStats]   = useState<AdminUsersStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState<string | null>(null)
    const [query,   setQuery]   = useState("")

    const load = useCallback(async () => {
      setLoading(true); setError(null)
      try {
        const res = await fetch("/api/admin/users")
        if (res.status === 401) { onUnauthorized(); return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Error al cargar usuarios")
        setUsers(data.users)
        setStats(data.stats)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido")
      } finally { setLoading(false) }
    }, [onUnauthorized])

    useEffect(() => { load() }, [load])

    const filtered = query.trim()
      ? users.filter(u => {
          const q = query.trim().toLowerCase()
          const fullName = `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase()
          return u.email.toLowerCase().includes(q) || fullName.includes(q)
        })
      : users

    const STATS_CARDS = stats
      ? [
          { label: "Usuarios registrados", value: stats.total_users,                       icon: Users,      accent: false },
          { label: "Nuevos (7 dias)",       value: stats.new_last_7_days,                  icon: UserPlus,   accent: stats.new_last_7_days > 0 },
          { label: "Con pedidos",           value: stats.users_with_orders,                icon: ShoppingBag,accent: false },
          { label: "Ingresos generados",    value: formatARS(stats.total_revenue),          icon: Wallet,     accent: false, isText: true },
        ]
      : []

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Usuarios</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Cuentas registradas y su actividad</p>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground h-8 shrink-0">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATS_CARDS.map(({ label, value, icon: Icon, accent, isText }) => (
              <div
                key={label}
                className={cn(
                  "rounded-xl border p-3",
                  accent ? "border-accent-gold/40 bg-accent-gold/10" : "border-border bg-surface"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 mb-1.5", accent ? "text-accent-gold" : "text-muted-foreground")} />
                <p className={cn(
                  "font-black tabular-nums text-foreground leading-tight",
                  isText ? "text-base" : "text-xl"
                )}>
                  {value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-surface-raised px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/30"
        />

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios...
          </div>
        ) : error ? (
          <p className="text-sm text-red-400 py-4 text-center">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">{query ? "Sin resultados para esa busqueda" : "Todavia no hay usuarios registrados"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => {
              const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ")
              const joined   = new Date(u.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
              const lastSeen = u.last_sign_in_at
                ? new Date(u.last_sign_in_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
                : null
              return (
                <div key={u.id} className="rounded-xl border border-border bg-surface p-3 space-y-2.5">
                  {/* Identity */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{fullName || "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" /> {u.email}
                      </p>
                    </div>
                    {!u.email_confirmed && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-300 shrink-0">
                        sin verificar
                      </span>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 pt-2 border-t border-border/60">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Registro</p>
                      <p className="text-xs font-semibold text-foreground tabular-nums">{joined}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Ultimo acceso</p>
                      <p className="text-xs font-semibold text-foreground tabular-nums">{lastSeen ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Pedidos</p>
                      <p className="text-xs font-semibold text-foreground tabular-nums">
                        {u.order_count} {u.order_count > 0 && <span className="text-accent-gold">· {formatARS(u.total_spent)}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Mazos guardados</p>
                      <p className="text-xs font-semibold text-foreground tabular-nums">{u.deck_count}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── Admin Dashboard ──────────────────────────────────────────────────────────
  
  function AdminDashboard({ onLogout }: { onLogout: () => void }) {
    const [tab, setTab]         = useState<"orders" | "pricing" | "pickup" | "discounts" | "users">("orders")
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<OrderStatus | "all">("all")

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/orders")
      if (res.status === 401) { onLogout(); return }
      if (!res.ok) throw new Error("Error al cargar pedidos")
      setOrders(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  function handleStatusChange(id: string, status: OrderStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {})
    onLogout()
  }

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter)
  const counts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] ?? 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-accent-gold flex items-center justify-center text-background font-black text-sm">P</div>
            <div className="hidden sm:block">
              <span className="font-bold text-foreground text-sm">Proxie.cards</span>
              <span className="ml-2 text-xs text-muted-foreground">Admin</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground h-8 shrink-0 order-3 sm:order-none">
            <LogOut className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Salir</span>
          </Button>
          {/* Tab switcher — horizontally scrollable on narrow screens so it never wraps or overflows the viewport */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 overflow-x-auto w-full sm:w-auto order-4 sm:order-none">
            <button
              onClick={() => setTab("orders")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shrink-0",
                tab === "orders" ? "bg-surface-raised text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> <span className="hidden md:inline">Pedidos</span>
            </button>
            <button
              onClick={() => setTab("users")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shrink-0",
                tab === "users" ? "bg-surface-raised text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5" /> <span className="hidden md:inline">Usuarios</span>
            </button>
            <button
              onClick={() => setTab("pricing")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shrink-0",
                tab === "pricing" ? "bg-surface-raised text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Tag className="h-3.5 w-3.5" /> <span className="hidden md:inline">Precios</span>
            </button>
            <button
              onClick={() => setTab("pickup")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shrink-0",
                tab === "pickup" ? "bg-surface-raised text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MapPin className="h-3.5 w-3.5" /> <span className="hidden md:inline">Retiro</span>
            </button>
            <button
              onClick={() => setTab("discounts")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shrink-0",
                tab === "discounts" ? "bg-surface-raised text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Tag className="h-3.5 w-3.5" /> <span className="hidden md:inline">Codigos</span>
            </button>
            {tab === "orders" && (
              <Button variant="ghost" size="sm" onClick={fetchOrders} disabled={loading} className="text-muted-foreground hover:text-foreground h-7 ml-auto shrink-0">
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {tab === "users"     && <UsersPanel onUnauthorized={onLogout} />}
        {tab === "pricing"   && <PricingPanel />}
        {tab === "pickup"    && <PickupPointsPanel />}
        {tab === "discounts" && <DiscountCodesPanel />}
        {tab === "orders" && <>
        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              onClick={() => setFilter(prev => prev === s ? "all" : s)}
              className={cn(
                "rounded-xl border p-3 text-center transition-all",
                filter === s ? cn(STATUS_CONFIG[s].color) : "border-border bg-surface hover:bg-surface-raised"
              )}
            >
              <p className="text-xl font-black text-foreground tabular-nums">{counts[s] ?? 0}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{STATUS_CONFIG[s].label}</p>
            </button>
          ))}
        </div>

        {/* Filter label */}
        {filter !== "all" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtrando por:</span>
            <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border", STATUS_CONFIG[filter].color)}>
              {STATUS_CONFIG[filter].label}
            </span>
            <button onClick={() => setFilter("all")} className="text-xs text-muted-foreground hover:text-foreground ml-1">×  Ver todos</button>
          </div>
        )}

        {/* Orders */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="font-medium">No hay pedidos {filter !== "all" ? "con este estado" : ""}</p>
          </div>
        )}
        <div className="space-y-3">
          {filtered.map(order => (
            <OrderRow key={order.id} order={order} onStatusChange={handleStatusChange} />
          ))}
        </div>
        </>}
      </main>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if already authenticated
    fetch("/api/admin/orders").then(r => {
      setAuthed(r.status !== 401)
    }).catch(() => setAuthed(false))
  }, [])

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <AdminDashboard onLogout={() => setAuthed(false)} />
}
