"use client"

import { useState, useMemo, useCallback, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  Layers,
  MapPin,
  Truck,
  ExternalLink,
  Clock,
  Phone,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getMaterial, DEFAULT_MATERIAL_ID } from "@/lib/materials"
import { calcPrice, formatARS, FALLBACK_TIERS, type PriceTier } from "@/lib/pricing"
import { usePrintStore } from "@/providers/print-store-provider"
import type { PrintListEntry } from "@/types/scryfall"
import { Navbar } from "@/components/navbar"

// Buenos Aires province cities — ordered alphabetically
const BA_CITIES = [
  "Bahía Blanca","Balcarce","Berazategui","Berisso","Brandsen","Bragado","Campana",
  "Cañuelas","Chivilcoy","Dolores","Ensenada","Escobar","Esteban Echeverría",
  "Ezeiza","Florencio Varela","General Pueyrredón","General Rodríguez",
  "General San Martín","Hurlingham","Ituzaingó","José C. Paz","Junín",
  "La Matanza","La Plata","Lanús","Las Flores","Lomas de Zamora","Luján",
  "Malvinas Argentinas","Mar del Plata","Merlo","Moreno","Morón","Necochea",
  "Olavarría","Pergamino","Pilar","Pinamar","Quilmes","Ramallo","Ranchos",
  "San Fernando","San Isidro","San Miguel","San Nicolás","San Pedro",
  "Tandil","Tigre","Tres Arroyos","Vicente López","Villa Gesell","Zárate",
].sort()

interface PickupPoint {
  id:              string
  name:            string
  address:         string
  city:            string
  google_maps_url: string | null
  hours:           string | null
  phone:           string | null
  notes:           string | null
}

function getThumb(entry: PrintListEntry): string | undefined {
  const c = entry.selectedPrint ?? entry.card
  return c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small
}

// ── Inner component ──────────────────────────────────────────────────────────

function PedidoInner() {
  const router = useRouter()
  const { cartDecks, totalCartCards } = usePrintStore()

  const materialId = DEFAULT_MATERIAL_ID
  const material   = getMaterial(materialId)

  const [tiers, setTiers] = useState<PriceTier[]>(FALLBACK_TIERS)
  const [shippingRate, setShippingRate] = useState<number>(8700)

  useEffect(() => {
    fetch("/api/pricing")
      .then(r => r.json())
      .then(d => { if (d.tiers?.length) setTiers(d.tiers) })
      .catch(() => {})
    fetch("/api/settings")
      .then(r => r.json())
      .then(d => {
        const rate = Number(d.settings?.shipping_rate)
        if (!isNaN(rate) && rate > 0) setShippingRate(rate)
      })
      .catch(() => {})
  }, [])

  // Pickup points
  const [pickupPoints,      setPickupPoints]      = useState<PickupPoint[]>([])
  const [selectedPointId,   setSelectedPointId]   = useState<string | null>(null)
  const [pointDropdownOpen, setPointDropdownOpen] = useState(false)

  useEffect(() => {
    fetch("/api/pickup-points")
      .then(r => r.json())
      .then(d => {
        if (d.points?.length) {
          setPickupPoints(d.points)
          setSelectedPointId(d.points[0].id)
        }
      })
      .catch(() => {})
  }, [])

  const selectedPoint = pickupPoints.find(p => p.id === selectedPointId) ?? null

  // Group pickup points by city
  const pointsByCity = useMemo(() => {
    const map: Record<string, PickupPoint[]> = {}
    for (const pt of pickupPoints) {
      ;(map[pt.city] ??= []).push(pt)
    }
    return map
  }, [pickupPoints])

  const availableCities = Object.keys(pointsByCity).sort()

  // Form state
  const [name,             setName]             = useState("")
  const [email,            setEmail]            = useState("")
  const [deliveryMethod,   setDeliveryMethod]   = useState<"pickup" | "shipping">("pickup")
  const [shippingAddress,  setShippingAddress]  = useState("")
  const [shippingCity,     setShippingCity]     = useState("")
  const [shippingProvince, setShippingProvince] = useState("Buenos Aires")
  const [shippingPhone,    setShippingPhone]    = useState("")
  const [shippingZip,      setShippingZip]      = useState("")
  const [notes,            setNotes]            = useState("")
  const [sending,          setSending]          = useState(false)
  const [redirecting,      setRedirecting]      = useState(false)
  const [sendError,        setSendError]        = useState<string | null>(null)
  const [listOpen,         setListOpen]         = useState(false)

  const cardTotal  = useMemo(() => calcPrice(tiers, totalCartCards), [tiers, totalCartCards])
  const orderTotal = deliveryMethod === "shipping" ? cardTotal + shippingRate : cardTotal
  const unitPrice  = totalCartCards > 0 ? Math.round(cardTotal / totalCartCards) : 0
  const allEntries = useMemo(() => cartDecks.flatMap(d => d.entries), [cartDecks])

  const canSubmit = useMemo(() => {
    if (!name.trim() || !email.trim()) return false
    if (sending || redirecting || totalCartCards === 0) return false
    if (deliveryMethod === "pickup" && !selectedPointId) return false
    if (deliveryMethod === "shipping" && (!shippingAddress.trim() || !shippingCity.trim() || !shippingPhone.trim())) return false
    return true
  }, [name, email, deliveryMethod, selectedPointId, shippingAddress, shippingCity, shippingPhone, sending, redirecting, totalCartCards])

  const handleSend = useCallback(async () => {
    if (!canSubmit) return
    setSending(true)
    setSendError(null)
    try {
      const deckPayload = allEntries.map((e) => ({
        id:        e.id,
        name:      e.card.name,
        quantity:  e.quantity,
        set:       (e.selectedPrint ?? e.card).set,
        set_name:  (e.selectedPrint ?? e.card).set_name,
        oracle_id: e.card.oracle_id,
        image_uri:
          (e.selectedPrint ?? e.card).image_uris?.large ??
          (e.selectedPrint ?? e.card).image_uris?.normal ??
          e.card.card_faces?.[0]?.image_uris?.large ??
          e.card.card_faces?.[0]?.image_uris?.normal,
      }))

      const sorted = [...tiers].sort((a, b) => a.min_cards - b.min_cards)
      let refTier = sorted[0]
      for (const t of sorted) { if (t.min_cards <= totalCartCards) refTier = t }

      const fullAddress = deliveryMethod === "shipping"
        ? `${shippingAddress.trim()}, ${shippingCity.trim()}, ${shippingProvince} ${shippingZip.trim()}`.replace(/ ,/g, ",").replace(/, $/,"")
        : null

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:            name.trim(),
          email:           email.trim(),
          notes:           notes.trim() || null,
          packSize:        refTier?.min_cards ?? totalCartCards,
          materialId,
          totalPrice:      orderTotal,
          deck:            deckPayload,
          delivery_method: deliveryMethod,
          address:         fullAddress,
          pickup_point_id: deliveryMethod === "pickup" ? selectedPointId : null,
        }),
      })

      const orderData = await orderRes.json().catch(() => ({}))
      if (!orderRes.ok) throw new Error(orderData.error ?? "Error al guardar el pedido")

      const orderId   = orderData.id
      const shortCode = orderData.short_code
      if (!orderId) throw new Error("No se pudo obtener el ID del pedido")

      const mpItems = [{
        title:      `${totalCartCards} cartas proxy · ${material.name}`,
        quantity:   1,
        unit_price: orderTotal,
      }]

      const prefRes = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: mpItems, email: email.trim(), orderId, shortCode }),
      })

      const prefData = await prefRes.json().catch(() => ({}))
      if (!prefRes.ok) throw new Error(prefData.error ?? "Error al iniciar el pago")

      const initPoint = prefData.init_point
      if (!initPoint) throw new Error("No se pudo obtener el link de pago")

      setSending(false)
      setRedirecting(true)
      window.location.href = initPoint
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Error al procesar el pedido")
      setSending(false)
    }
  }, [canSubmit, name, email, notes, deliveryMethod, selectedPointId, shippingAddress, shippingCity, shippingProvince, shippingZip, orderTotal, totalCartCards, allEntries, tiers, materialId])

  // ── Redirecting ────────────────────────────────────────────────────────────
  if (redirecting) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
        <Loader2 className="h-10 w-10 animate-spin text-accent-gold" />
        <p className="text-sm text-muted-foreground mt-4">Redirigiendo a MercadoPago...</p>
      </div>
    )
  }

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent-gold/30 transition-shadow"
  const labelCls = "block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1"

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Completá tu pedido</h1>
          <p className="text-xs text-muted-foreground mt-1">Pago seguro via MercadoPago.</p>
        </div>

        {/* Two-column layout that fits above the fold */}
        <div className="grid lg:grid-cols-5 gap-4 items-start">

          {/* ── Left: form ── */}
          <div className="lg:col-span-3 space-y-3">

            {/* Contact */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <p className="text-xs font-bold text-foreground uppercase tracking-widest">Tus datos</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nombre completo</label>
                  <input type="text" placeholder="Santiago García" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Te enviamos el codigo de seguimiento aqui.</p>
                </div>
              </div>
            </div>

            {/* Delivery method toggle */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <p className="text-xs font-bold text-foreground uppercase tracking-widest">Entrega</p>

              {/* Method selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod("pickup")}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all",
                    deliveryMethod === "pickup"
                      ? "border-accent-gold bg-accent-gold/8"
                      : "border-border bg-background hover:border-border/70"
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <MapPin className={cn("h-3.5 w-3.5 shrink-0", deliveryMethod === "pickup" ? "text-accent-gold" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-semibold", deliveryMethod === "pickup" ? "text-accent-gold" : "text-muted-foreground")}>Retiro en persona</span>
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">GRATIS</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 pl-5">Presenta tu codigo de orden</p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod("shipping")}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all",
                    deliveryMethod === "shipping"
                      ? "border-accent-gold bg-accent-gold/8"
                      : "border-border bg-background hover:border-border/70"
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <Truck className={cn("h-3.5 w-3.5 shrink-0", deliveryMethod === "shipping" ? "text-accent-gold" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-semibold", deliveryMethod === "shipping" ? "text-accent-gold" : "text-muted-foreground")}>Envio a domicilio</span>
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-raised text-muted-foreground tabular-nums">{formatARS(shippingRate)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 pl-5">Tarifa fija, todo el pais</p>
                </button>
              </div>

              {/* ── Pickup: city + point ── */}
              {deliveryMethod === "pickup" && (
                <div className="space-y-2">
                  {pickupPoints.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Cargando puntos de retiro...</p>
                  ) : (
                    <>
                      {/* Point selector button */}
                      <div>
                        <label className={labelCls}>Punto de retiro</label>
                        <button
                          type="button"
                          onClick={() => setPointDropdownOpen(v => !v)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors",
                            pointDropdownOpen ? "border-accent-gold/60 bg-accent-gold/5" : "border-input bg-background hover:border-accent-gold/30"
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground truncate">{selectedPoint?.name ?? "Seleccionar..."}</span>
                            {selectedPoint && <span className="text-muted-foreground text-xs ml-2">· {selectedPoint.city}</span>}
                          </div>
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", pointDropdownOpen && "rotate-180")} />
                        </button>

                        {/* Dropdown grouped by city */}
                        {pointDropdownOpen && (
                          <div className="mt-1 rounded-xl border border-border bg-surface shadow-xl overflow-hidden z-20 max-h-56 overflow-y-auto">
                            {availableCities.map(city => (
                              <div key={city}>
                                <div className="px-3 py-1.5 bg-surface-raised border-b border-border">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{city}</span>
                                </div>
                                {pointsByCity[city].map(pt => (
                                  <button
                                    key={pt.id}
                                    type="button"
                                    onClick={() => { setSelectedPointId(pt.id); setPointDropdownOpen(false) }}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-border/50 last:border-b-0",
                                      pt.id === selectedPointId ? "bg-accent-gold/8" : "hover:bg-surface-raised"
                                    )}
                                  >
                                    {pt.id === selectedPointId
                                      ? <Check className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                                      : <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
                                    <div className="min-w-0">
                                      <p className={cn("text-sm font-medium", pt.id === selectedPointId ? "text-accent-gold" : "text-foreground")}>{pt.name}</p>
                                      <p className="text-xs text-muted-foreground truncate">{pt.address}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Selected point info card — compact */}
                      {selectedPoint && !pointDropdownOpen && (
                        <div className="rounded-lg border border-border/60 bg-surface-raised px-3 py-2.5 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-xs font-semibold text-foreground">{selectedPoint.name}</p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0 text-accent-gold" />{selectedPoint.address}</p>
                              {selectedPoint.hours && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{selectedPoint.hours}</p>}
                              {selectedPoint.phone && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{selectedPoint.phone}</p>}
                            </div>
                            {selectedPoint.google_maps_url && (
                              <a href={selectedPoint.google_maps_url} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 text-[11px] text-accent-gold hover:underline whitespace-nowrap">
                                <ExternalLink className="h-3 w-3" /> Maps
                              </a>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 border-t border-border/40 pt-1.5">
                            Presenta los <strong className="text-foreground/60">8 digitos</strong> de tu codigo de orden al retirar. Tenes 8 dias desde la notificacion.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Shipping: address fields ── */}
              {deliveryMethod === "shipping" && (
                <div className="space-y-2.5">
                  <div>
                    <label className={labelCls}>Calle y numero *</label>
                    <input type="text" placeholder="Av. Corrientes 1234, Piso 3 Dpto B" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Ciudad *</label>
                      <input
                        type="text"
                        list="ba-cities"
                        placeholder="Ej: La Plata"
                        value={shippingCity}
                        onChange={e => setShippingCity(e.target.value)}
                        className={inputCls}
                      />
                      <datalist id="ba-cities">
                        {BA_CITIES.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className={labelCls}>Codigo postal</label>
                      <input type="text" placeholder="1900" value={shippingZip} onChange={e => setShippingZip(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Provincia</label>
                      <input type="text" value={shippingProvince} onChange={e => setShippingProvince(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Telefono de contacto *</label>
                      <input type="tel" placeholder="+54 9 11 1234-5678" value={shippingPhone} onChange={e => setShippingPhone(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-1.5">
              <label className={labelCls}>Notas <span className="normal-case font-normal text-muted-foreground/50">(opcional)</span></label>
              <textarea
                placeholder="Variantes de arte, aclaraciones especiales..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className={cn(inputCls, "resize-none")}
              />
            </div>

            {sendError && (
              <p className="text-sm text-destructive bg-destructive/8 border border-destructive/25 rounded-xl px-4 py-2.5">
                {sendError}
              </p>
            )}

            <button
              onClick={handleSend}
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#009ee3] text-white font-bold text-sm hover:bg-[#008fce] shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                : <><Send className="h-4 w-4" /> Pagar {formatARS(orderTotal)} con MercadoPago</>}
            </button>
            <p className="text-center text-[10px] text-muted-foreground/50 -mt-1">
              Seras redirigido a MercadoPago para completar el pago de forma segura.
            </p>
          </div>

          {/* ── Right: summary ── */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-surface overflow-hidden sticky top-20">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-bold text-foreground uppercase tracking-widest">Resumen</p>
              </div>
              <div className="px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Material</span>
                  <span className="font-semibold text-xs">{material.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Cartas</span>
                  <span className="font-semibold text-xs tabular-nums">{totalCartCards}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Precio unitario</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatARS(unitPrice)}/carta</span>
                </div>

                {deliveryMethod === "shipping" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs flex items-center gap-1"><Truck className="h-3 w-3" /> Envio</span>
                    <span className="text-xs tabular-nums">{formatARS(shippingRate)}</span>
                  </div>
                )}
                {deliveryMethod === "pickup" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Retiro</span>
                    <span className="text-xs text-emerald-400 font-semibold">GRATIS</span>
                  </div>
                )}

                {cartDecks.length > 1 && (
                  <div className="border-t border-border/50 pt-2 space-y-1">
                    {cartDecks.map(deck => (
                      <div key={deck.id} className="flex justify-between text-xs text-muted-foreground">
                        <span className="truncate max-w-[120px]">{deck.name || "Deck"}</span>
                        <span>{deck.entries.reduce((s, e) => s + e.quantity, 0)} cartas</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between border-t border-border pt-2 mt-1">
                  <span className="text-muted-foreground text-xs">Total</span>
                  <span className="text-lg font-extrabold text-accent-gold tabular-nums">{formatARS(orderTotal)}</span>
                </div>

                {/* Card thumbnails toggle */}
                {allEntries.length > 0 && (
                  <div className="border-t border-border/50 pt-2">
                    <button
                      onClick={() => setListOpen(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                    >
                      <Layers className="h-3 w-3" />
                      <span>{totalCartCards} cartas en total</span>
                      {listOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                    </button>
                    {listOpen && (
                      <div className="mt-2 flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                        {allEntries.map((entry, i) => {
                          const thumb = getThumb(entry)
                          return thumb ? (
                            <div key={i} className="relative group">
                              <img src={thumb} alt={entry.card.name} className="h-12 w-9 rounded object-cover" />
                              {entry.quantity > 1 && (
                                <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-black/80 text-white rounded px-0.5 leading-tight">x{entry.quantity}</span>
                              )}
                            </div>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function PedidoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <PedidoInner />
    </Suspense>
  )
}
