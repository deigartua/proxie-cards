"use client"

import { useState, useEffect, useMemo, useCallback, Suspense } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { usePrintStore, GAME_FORMATS } from "@/providers/print-store-provider"
import { cn } from "@/lib/utils"
import { calcPrice, formatARS, getNextBracket, FALLBACK_TIERS, MIN_ORDER_CARDS, type PriceTier } from "@/lib/pricing"
import { DeckRowItem } from "@/components/deck-row-item"
import { getMaterial, DEFAULT_MATERIAL_ID } from "@/lib/materials"
import {
  Trash2,
  BookOpen,
  ShoppingBag,
  ChevronDown,
  ChevronRight,
  Plus,
  Layers,
  Package,
  MapPin,
  Truck,
  ExternalLink,
  Clock,
  Phone,
  Check,
  Loader2,
  Send,
  ChevronUp,
  AlertCircle,
  Tag,
  X,
} from "lucide-react"
import type { DeckItem, PrintListEntry } from "@/types/scryfall"

// ── Types ──────────────────────────────────────────────────────────────────────

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

function getThumb(entry: PrintListEntry): string | undefined {
  const c = entry.selectedPrint ?? entry.card
  return c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small
}





// ── Main inner component ──────────────────────────────────────────────────────

function DeckboxInner() {
  const router = useRouter()
  const {
    cartDecks,
    totalCartCards,
    removeDeck,
    editCartDeck,
    editPreconDeck,
    editSideboard,
    builderDeck,
    builderCartId,
    resetBuilder,
  } = usePrintStore()

  const handleEdit = (deckId: string) => {
    const deck = cartDecks.find(d => d.id === deckId)
    if (!deck) return
    if (deck.type === "precon") editPreconDeck(deckId)
    else editCartDeck(deckId)
    router.push("/deckbuilder")
  }

  const handleEditSideboard = (deckId: string) => {
    editSideboard(deckId)
    router.push("/deckbuilder")
  }

  // Pricing
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

  // Discount code state
  const [discountInput,    setDiscountInput]    = useState("")
  const [discountChecking, setDiscountChecking] = useState(false)
  const [discountError,    setDiscountError]    = useState<string | null>(null)
  const [appliedDiscount,  setAppliedDiscount]  = useState<{
    code: string
    benefit_type: "percentage" | "free_shipping" | "bypass_payment"
    percentage:   number | null
    description:  string | null
  } | null>(null)

  async function applyDiscount() {
    const code = discountInput.trim().toUpperCase()
    if (!code) return
    setDiscountChecking(true)
    setDiscountError(null)
    try {
      const res  = await fetch(`/api/discount?code=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (!res.ok) { setDiscountError(data.error ?? "Codigo invalido"); return }
      setAppliedDiscount({
        code:         data.discount.code,
        benefit_type: data.discount.benefit_type,
        percentage:   data.discount.percentage,
        description:  data.discount.description,
      })
      setDiscountInput("")
    } catch {
      setDiscountError("No se pudo verificar el codigo")
    } finally {
      setDiscountChecking(false)
    }
  }

  function removeDiscount() {
    setAppliedDiscount(null)
    setDiscountError(null)
    setDiscountInput("")
  }

  const materialId = DEFAULT_MATERIAL_ID
  const material   = getMaterial(materialId)

  // Deck sorting — must come before pricing so selectedCardTotal is available
  const sortedDecks = useMemo(() => {
    return [...cartDecks].sort((a, b) => {
      if (a.id === builderCartId) return -1
      if (b.id === builderCartId) return 1
      return (b.createdAt ?? 0) - (a.createdAt ?? 0)
    })
  }, [cartDecks, builderCartId])

  // All decks with at least 1 card are selectable — minimum is evaluated at ORDER level
  const purchasableDecks = useMemo(() => {
    return sortedDecks.filter(d => d.entries.reduce((s, e) => s + e.quantity, 0) > 0)
  }, [sortedDecks])

  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(() =>
    new Set(purchasableDecks.map(d => d.id))
  )

  useEffect(() => {
    setSelectedDeckIds(prev => {
      const validIds = new Set(purchasableDecks.map(d => d.id))
      const next = new Set<string>()
      for (const id of prev) { if (validIds.has(id)) next.add(id) }
      for (const id of validIds) { if (!prev.has(id)) next.add(id) }
      return next
    })
  }, [purchasableDecks])

  const toggleDeckSelection = useCallback((deckId: string) => {
    const deck = sortedDecks.find(d => d.id === deckId)
    if (!deck) return
    setSelectedDeckIds(prev => {
      const next = new Set(prev)
      if (next.has(deckId)) next.delete(deckId)
      else next.add(deckId)
      return next
    })
  }, [sortedDecks])

  const selectedDecks = useMemo(
    () => sortedDecks.filter(d => selectedDeckIds.has(d.id)),
    [sortedDecks, selectedDeckIds]
  )

  const selectedCardTotal = useMemo(
    () => selectedDecks.reduce((s, d) => s + d.entries.reduce((ss, e) => ss + e.quantity, 0), 0),
    [selectedDecks]
  )

  const orderMet        = selectedCardTotal >= MIN_ORDER_CARDS
  const cardTotal       = useMemo(() => orderMet ? calcPrice(tiers, selectedCardTotal) : 0, [tiers, selectedCardTotal, orderMet])
  const baseOrderTotal  = orderMet ? (deliveryMethod === "shipping" ? cardTotal + shippingRate : cardTotal) : 0
  const effectiveShipping = appliedDiscount?.benefit_type === "free_shipping" ? 0 : shippingRate
  const discountedCardTotal = useMemo(() => {
    if (!appliedDiscount || !orderMet) return cardTotal
    if (appliedDiscount.benefit_type === "percentage" && appliedDiscount.percentage) {
      return Math.max(0, Math.round(cardTotal * (1 - appliedDiscount.percentage / 100)))
    }
    if (appliedDiscount.benefit_type === "bypass_payment") return 0
    return cardTotal
  }, [appliedDiscount, cardTotal, orderMet])
  const orderTotal  = orderMet ? (deliveryMethod === "shipping" ? discountedCardTotal + effectiveShipping : discountedCardTotal) : 0
  const unitPrice   = orderMet && selectedCardTotal > 0 ? Math.round(cardTotal / selectedCardTotal) : 0
  const allEntries  = useMemo(() => selectedDecks.flatMap(d => d.entries), [selectedDecks])
  const isBypassPayment = appliedDiscount?.benefit_type === "bypass_payment"

  const canSubmit = useMemo(() => {
    if (!name.trim() || !email.trim()) return false
    if (sending || redirecting || !orderMet) return false
    if (selectedDeckIds.size === 0) return false
    if (deliveryMethod === "pickup" && !selectedPointId) return false
    if (deliveryMethod === "shipping" && (!shippingAddress.trim() || !shippingCity.trim() || !shippingPhone.trim())) return false
    return true
  }, [name, email, deliveryMethod, selectedPointId, shippingAddress, shippingCity, shippingPhone, sending, redirecting, selectedCardTotal, selectedDeckIds])

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
      for (const t of sorted) { if (t.min_cards <= selectedCardTotal) refTier = t }

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
          packSize:        refTier?.min_cards ?? selectedCardTotal,
          materialId,
          totalPrice:      orderTotal,
          deck:            deckPayload,
          delivery_method: deliveryMethod,
          address:         fullAddress,
          pickup_point_id: deliveryMethod === "pickup" ? selectedPointId : null,
          discountCode:    appliedDiscount?.code ?? null,
        }),
      })

      const orderData = await orderRes.json().catch(() => ({}))
      if (!orderRes.ok) throw new Error(orderData.error ?? "Error al guardar el pedido")

      const orderId   = orderData.id
      const shortCode = orderData.short_code
      if (!orderId) throw new Error("No se pudo obtener el ID del pedido")

      // bypass_payment: order already marked "paid", skip MercadoPago
      if (orderData.bypass_payment) {
        setSending(false)
        router.push(`/order-status?short_code=${shortCode}`)
        return
      }

      const mpItems = [{
        title:      `${selectedCardTotal} cartas proxy · ${material.name}`,
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
  }, [canSubmit, name, email, notes, deliveryMethod, selectedPointId, shippingAddress, shippingCity, shippingProvince, shippingZip, orderTotal, selectedCardTotal, allEntries, tiers, materialId])

  const singles = sortedDecks.filter(d => d.type === "singles")
  const precons = sortedDecks.filter(d => d.type === "precon")
  const sets    = sortedDecks.filter(d => d.type === "set")
  const customs = sortedDecks.filter(d => d.type === "custom")
  const isEmpty = cartDecks.length === 0

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* ── Page header ── visible on both mobile and desktop */}
        <div className="mb-6">
          <h1 className="text-lg font-bold text-foreground tracking-tight">Completá tu pedido</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Pago seguro via MercadoPago.</p>
        </div>

        {/* ── MOBILE layout (flex-col, single column) ── hidden on md+ */}
        <div className="flex flex-col gap-6 md:hidden">

          {/* 1. Mazos */}
          <div className="space-y-5">
            <button
              onClick={() => { resetBuilder(); router.push("/deckbuilder?setup=true") }}
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

            {isEmpty ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="h-14 w-14 rounded-2xl bg-surface border border-border flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground/60">Tu Deckbox esta vacia</p>
              </div>
            ) : (
              <>
                {singles.length > 0 && (
                  <section>
                    <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Package className="h-3 w-3" /> Singles
                    </h2>
                    <div className="space-y-2.5">
                      {singles.map(d => (
                        <DeckRowItem
                          key={d.id}
                          deck={d}
                          isSelectable={true}
                          isSelected={selectedDeckIds.has(d.id)}
                          onToggleSelect={() => toggleDeckSelection(d.id)}
                          alwaysShowActions={true}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {customs.length > 0 && (
                  <section>
                    <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-3">Decks personalizados</h2>
                    <div className="space-y-2.5">
                      {customs.map(d => (
                        <DeckRowItem
                          key={d.id}
                          deck={d}
                          isSelectable={true}
                          isSelected={selectedDeckIds.has(d.id)}
                          onToggleSelect={() => toggleDeckSelection(d.id)}
                          onRemove={() => { if (confirm(`Eliminar "${d.name}" de tu Deckbox?`)) removeDeck(d.id) }}
                          alwaysShowActions={true}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {precons.length > 0 && (
                  <section>
                    <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-3">Decks preconstruidos</h2>
                    <div className="space-y-2.5">
                      {precons.map(d => (
                        <DeckRowItem
                          key={d.id}
                          deck={d}
                          isSelectable={true}
                          isSelected={selectedDeckIds.has(d.id)}
                          onToggleSelect={() => toggleDeckSelection(d.id)}
                          onRemove={() => { if (confirm(`Eliminar "${d.name}" de tu Deckbox?`)) removeDeck(d.id) }}
                          alwaysShowActions={true}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {sets.length > 0 && (
                  <section>
                    <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-3">Sets</h2>
                    <div className="space-y-2.5">
                      {sets.map(d => (
                        <DeckRowItem
                          key={d.id}
                          deck={d}
                          isSelectable={true}
                          isSelected={selectedDeckIds.has(d.id)}
                          onToggleSelect={() => toggleDeckSelection(d.id)}
                          onRemove={() => { if (confirm(`Eliminar "${d.name}" de tu Deckbox?`)) removeDeck(d.id) }}
                          alwaysShowActions={true}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

          {/* 2. TUS DATOS */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <p className="text-xs font-bold text-foreground uppercase tracking-widest">Tus datos</p>
            <div className="space-y-3">
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

          {/* 3. ENTREGA */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <p className="text-xs font-bold text-foreground uppercase tracking-widest">Entrega</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeliveryMethod("pickup")} className={cn("flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all", deliveryMethod === "pickup" ? "border-accent-gold bg-accent-gold/8" : "border-border bg-background hover:border-border/70")}>
                <div className="flex items-center gap-1.5 w-full">
                  <MapPin className={cn("h-3.5 w-3.5 shrink-0", deliveryMethod === "pickup" ? "text-accent-gold" : "text-muted-foreground")} />
                  <span className={cn("text-xs font-semibold", deliveryMethod === "pickup" ? "text-accent-gold" : "text-muted-foreground")}>Retiro en persona</span>
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">GRATIS</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 pl-5">Presenta tu codigo de orden</p>
              </button>
              <button type="button" onClick={() => setDeliveryMethod("shipping")} className={cn("flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all", deliveryMethod === "shipping" ? "border-accent-gold bg-accent-gold/8" : "border-border bg-background hover:border-border/70")}>
                <div className="flex items-center gap-1.5 w-full">
                  <Truck className={cn("h-3.5 w-3.5 shrink-0", deliveryMethod === "shipping" ? "text-accent-gold" : "text-muted-foreground")} />
                  <span className={cn("text-xs font-semibold", deliveryMethod === "shipping" ? "text-accent-gold" : "text-muted-foreground")}>Envio a domicilio</span>
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-raised text-muted-foreground tabular-nums">{formatARS(shippingRate)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 pl-5">Tarifa fija, todo el pais</p>
              </button>
            </div>
            {deliveryMethod === "pickup" && (
              <div className="space-y-2">
                {pickupPoints.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Cargando puntos de retiro...</p>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>Punto de retiro</label>
                      <button type="button" onClick={() => setPointDropdownOpen(v => !v)} className={cn("w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors", pointDropdownOpen ? "border-accent-gold/60 bg-accent-gold/5" : "border-input bg-background hover:border-accent-gold/30")}>
                        <MapPin className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-foreground truncate">{selectedPoint?.name ?? "Seleccionar..."}</span>
                          {selectedPoint && <span className="text-muted-foreground text-xs ml-2">· {selectedPoint.city}</span>}
                        </div>
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", pointDropdownOpen && "rotate-180")} />
                      </button>
                      {pointDropdownOpen && (
                        <div className="mt-1 rounded-xl border border-border bg-surface shadow-xl overflow-hidden z-20 max-h-56 overflow-y-auto">
                          {availableCities.map(city => (
                            <div key={city}>
                              <div className="px-3 py-1.5 bg-surface-raised border-b border-border">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{city}</span>
                              </div>
                              {pointsByCity[city].map(pt => (
                                <button key={pt.id} type="button" onClick={() => { setSelectedPointId(pt.id); setPointDropdownOpen(false) }} className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-border/50 last:border-b-0", pt.id === selectedPointId ? "bg-accent-gold/8" : "hover:bg-surface-raised")}>
                                  {pt.id === selectedPointId ? <Check className="h-3.5 w-3.5 text-accent-gold shrink-0" /> : <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
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
            {deliveryMethod === "shipping" && (
              <div className="space-y-2.5">
                <div>
                  <label className={labelCls}>Calle y numero *</label>
                  <input type="text" placeholder="Av. Corrientes 1234, Piso 3 Dpto B" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Ciudad *</label>
                    <input type="text" list="ba-cities-mobile" placeholder="Ej: La Plata" value={shippingCity} onChange={e => setShippingCity(e.target.value)} className={inputCls} />
                    <datalist id="ba-cities-mobile">{BA_CITIES.map(c => <option key={c} value={c} />)}</datalist>
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

          {/* 4. RESUMEN */}
          {!isEmpty && (
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-[11px] font-bold text-foreground uppercase tracking-widest">Resumen</p>
                {selectedCardTotal > 0 && <span className="text-xs text-muted-foreground tabular-nums">{selectedCardTotal} cartas</span>}
              </div>
              <div className="px-4 py-3 space-y-2">
                {selectedDecks.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center py-2">Selecciona al menos un mazo</p>
                ) : selectedDecks.map(deck => {
                  const count   = deck.entries.reduce((s, e) => s + e.quantity, 0)
                  const sideCnt = (deck.sideboard ?? []).reduce((s, e) => s + e.quantity, 0)
                  const isLiveDeck = deck.id === builderCartId
                  return (
                    <div key={deck.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <BookOpen className={cn("h-3 w-3 shrink-0", isLiveDeck ? "text-green-400" : "text-muted-foreground")} />
                        <span className={cn("text-xs truncate", isLiveDeck ? "text-green-400" : "text-muted-foreground")}>{deck.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{count}{sideCnt > 0 ? `+${sideCnt}` : ""}</span>
                    </div>
                  )
                })}
                <div className="border-t border-border/50 pt-2 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Precio unitario</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatARS(unitPrice)}/carta</span>
                  </div>
                  {deliveryMethod === "shipping" && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Envio</span>
                      <span className="text-xs tabular-nums">{formatARS(shippingRate)}</span>
                    </div>
                  )}
                  {deliveryMethod === "pickup" && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Retiro</span>
                      <span className="text-xs text-emerald-400 font-semibold">GRATIS</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-border/50">
                    <span className="text-xs font-bold text-foreground">Total</span>
                    <span className="text-base font-extrabold text-accent-gold tabular-nums">{formatARS(orderTotal)}</span>
                  </div>
                </div>
                {allEntries.length > 0 && (
                  <div className="border-t border-border/50 pt-2">
                    <button onClick={() => setListOpen(v => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                      <Layers className="h-3 w-3" />
                      <span>{selectedCardTotal} cartas en total</span>
                      {listOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                    </button>
                    {listOpen && (
                      <div className="mt-2 flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                        {allEntries.map((entry, i) => {
                          const thumb = getThumb(entry)
                          return thumb ? (
                            <div key={i} className="relative">
                              <img src={thumb} alt={entry.card.name} className="h-12 w-9 rounded object-cover" />
                              {entry.quantity > 1 && <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-black/80 text-white rounded px-0.5 leading-tight">x{entry.quantity}</span>}
                            </div>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. Error + Botón Pagar */}
          {sendError && (
            <p className="text-sm text-destructive bg-destructive/8 border border-destructive/25 rounded-xl px-4 py-2.5">{sendError}</p>
          )}
          <div className="space-y-1.5">
            <button onClick={handleSend} disabled={!canSubmit} className={cn("w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed", isBypassPayment ? "bg-emerald-600 hover:bg-emerald-500" : "bg-[#009ee3] hover:bg-[#008fce]")}>
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</> : isBypassPayment ? <><Check className="h-4 w-4" /> Confirmar pedido sin costo</> : <><Send className="h-4 w-4" /> Pagar {formatARS(orderTotal)} con MercadoPago</>}
            </button>
            <p className="text-center text-[10px] text-muted-foreground/50">Seras redirigido a MercadoPago para completar el pago de forma segura.</p>
          </div>

        </div>

        {/* ── DESKTOP layout (grid 2 cols) ── hidden on mobile */}
        <div className="hidden md:grid md:grid-cols-2 gap-8 items-start">

          {/* Left col: form + pay */}
          <div className="min-w-0 space-y-4">
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

            {/* Delivery */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <p className="text-xs font-bold text-foreground uppercase tracking-widest">Entrega</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDeliveryMethod("pickup")} className={cn("flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all", deliveryMethod === "pickup" ? "border-accent-gold bg-accent-gold/8" : "border-border bg-background hover:border-border/70")}>
                  <div className="flex items-center gap-1.5 w-full">
                    <MapPin className={cn("h-3.5 w-3.5 shrink-0", deliveryMethod === "pickup" ? "text-accent-gold" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-semibold", deliveryMethod === "pickup" ? "text-accent-gold" : "text-muted-foreground")}>Retiro en persona</span>
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">GRATIS</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 pl-5">Presenta tu codigo de orden</p>
                </button>
                <button type="button" onClick={() => setDeliveryMethod("shipping")} className={cn("flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all", deliveryMethod === "shipping" ? "border-accent-gold bg-accent-gold/8" : "border-border bg-background hover:border-border/70")}>
                  <div className="flex items-center gap-1.5 w-full">
                    <Truck className={cn("h-3.5 w-3.5 shrink-0", deliveryMethod === "shipping" ? "text-accent-gold" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-semibold", deliveryMethod === "shipping" ? "text-accent-gold" : "text-muted-foreground")}>Envio a domicilio</span>
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-raised text-muted-foreground tabular-nums">{formatARS(shippingRate)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 pl-5">Tarifa fija, todo el pais</p>
                </button>
              </div>
              {deliveryMethod === "pickup" && (
                <div className="space-y-2">
                  {pickupPoints.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Cargando puntos de retiro...</p>
                  ) : (
                    <>
                      <div>
                        <label className={labelCls}>Punto de retiro</label>
                        <button type="button" onClick={() => setPointDropdownOpen(v => !v)} className={cn("w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors", pointDropdownOpen ? "border-accent-gold/60 bg-accent-gold/5" : "border-input bg-background hover:border-accent-gold/30")}>
                          <MapPin className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground truncate">{selectedPoint?.name ?? "Seleccionar..."}</span>
                            {selectedPoint && <span className="text-muted-foreground text-xs ml-2">· {selectedPoint.city}</span>}
                          </div>
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", pointDropdownOpen && "rotate-180")} />
                        </button>
                        {pointDropdownOpen && (
                          <div className="mt-1 rounded-xl border border-border bg-surface shadow-xl overflow-hidden z-20 max-h-56 overflow-y-auto">
                            {availableCities.map(city => (
                              <div key={city}>
                                <div className="px-3 py-1.5 bg-surface-raised border-b border-border">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{city}</span>
                                </div>
                                {pointsByCity[city].map(pt => (
                                  <button key={pt.id} type="button" onClick={() => { setSelectedPointId(pt.id); setPointDropdownOpen(false) }} className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-border/50 last:border-b-0", pt.id === selectedPointId ? "bg-accent-gold/8" : "hover:bg-surface-raised")}>
                                    {pt.id === selectedPointId ? <Check className="h-3.5 w-3.5 text-accent-gold shrink-0" /> : <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
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
              {deliveryMethod === "shipping" && (
                <div className="space-y-2.5">
                  <div>
                    <label className={labelCls}>Calle y numero *</label>
                    <input type="text" placeholder="Av. Corrientes 1234, Piso 3 Dpto B" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Ciudad *</label>
                      <input type="text" list="ba-cities" placeholder="Ej: La Plata" value={shippingCity} onChange={e => setShippingCity(e.target.value)} className={inputCls} />
                      <datalist id="ba-cities">{BA_CITIES.map(c => <option key={c} value={c} />)}</datalist>
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

            {sendError && (
              <p className="text-sm text-destructive bg-destructive/8 border border-destructive/25 rounded-xl px-4 py-2.5">{sendError}</p>
            )}
            <div className="space-y-1.5">
              <button onClick={handleSend} disabled={!canSubmit} className={cn("w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed", isBypassPayment ? "bg-emerald-600 hover:bg-emerald-500" : "bg-[#009ee3] hover:bg-[#008fce]")}>
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</> : isBypassPayment ? <><Check className="h-4 w-4" /> Confirmar pedido sin costo</> : <><Send className="h-4 w-4" /> Pagar {formatARS(orderTotal)} con MercadoPago</>}
              </button>
              <p className="text-center text-[10px] text-muted-foreground/50">Seras redirigido a MercadoPago para completar el pago de forma segura.</p>
            </div>
          </div>

          {/* Right col: mazos + resumen */}
          <div className="min-w-0 sticky top-20 space-y-4">
            <div className="space-y-5">
              <button onClick={() => { resetBuilder(); router.push("/deckbuilder?setup=true") }} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-accent-blue/40 bg-accent-blue/5 hover:border-accent-blue/70 hover:bg-accent-blue/10 transition-all group text-left">
                <div className="w-9 h-12 rounded-lg bg-accent-blue/10 border border-accent-blue/20 shrink-0 flex items-center justify-center group-hover:bg-accent-blue/20 transition-colors">
                  <Plus className="h-5 w-5 text-accent-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-accent-blue leading-tight">Crear nuevo deck</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Elegí formato y empezá a armar</p>
                </div>
                <ChevronRight className="h-4 w-4 text-accent-blue/40 group-hover:text-accent-blue/70 shrink-0 transition-colors" />
              </button>

              {isEmpty ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-surface border border-border flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground/60">Tu Deckbox esta vacia</p>
                </div>
              ) : (
                <>
                  {singles.length > 0 && (
                    <section>
                      <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Package className="h-3 w-3" /> Singles
                      </h2>
                      <div className="space-y-2.5">
                        {singles.map(d => (
                          <DeckRowItem
                            key={d.id}
                            deck={d}
                            isSelectable={true}
                            isSelected={selectedDeckIds.has(d.id)}
                            onToggleSelect={() => toggleDeckSelection(d.id)}
                            alwaysShowActions={true}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                {customs.length > 0 && (
                  <section>
                    <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-3">Decks personalizados</h2>
                    <div className="space-y-2.5">
                      {customs.map(d => (
                        <DeckRowItem
                          key={d.id}
                          deck={d}
                          isSelectable={true}
                          isSelected={selectedDeckIds.has(d.id)}
                          onToggleSelect={() => toggleDeckSelection(d.id)}
                          onRemove={() => { if (confirm(`Eliminar "${d.name}" de tu Deckbox?`)) removeDeck(d.id) }}
                          alwaysShowActions={true}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {precons.length > 0 && (
                  <section>
                    <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-3">Decks preconstruidos</h2>
                    <div className="space-y-2.5">
                      {precons.map(d => (
                        <DeckRowItem
                          key={d.id}
                          deck={d}
                          isSelectable={true}
                          isSelected={selectedDeckIds.has(d.id)}
                          onToggleSelect={() => toggleDeckSelection(d.id)}
                          onRemove={() => { if (confirm(`Eliminar "${d.name}" de tu Deckbox?`)) removeDeck(d.id) }}
                          alwaysShowActions={true}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {sets.length > 0 && (
                  <section>
                    <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-3">Sets</h2>
                    <div className="space-y-2.5">
                      {sets.map(d => (
                        <DeckRowItem
                          key={d.id}
                          deck={d}
                          isSelectable={true}
                          isSelected={selectedDeckIds.has(d.id)}
                          onToggleSelect={() => toggleDeckSelection(d.id)}
                          onRemove={() => { if (confirm(`Eliminar "${d.name}" de tu Deckbox?`)) removeDeck(d.id) }}
                          alwaysShowActions={true}
                        />
                      ))}
                    </div>
                  </section>
                )}

                </>
              )}
            </div>

            {!isEmpty && (
              <div className="rounded-xl border border-border bg-surface overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="text-[11px] font-bold text-foreground uppercase tracking-widest">Resumen</p>
                  {selectedCardTotal > 0 && <span className="text-xs text-muted-foreground tabular-nums">{selectedCardTotal} cartas</span>}
                </div>
                <div className="px-4 py-3 space-y-2">
                  {selectedDecks.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60 text-center py-2">Selecciona al menos un mazo</p>
                  ) : selectedDecks.map(deck => {
                    const count   = deck.entries.reduce((s, e) => s + e.quantity, 0)
                    const sideCnt = (deck.sideboard ?? []).reduce((s, e) => s + e.quantity, 0)
                    const isLiveDeck = deck.id === builderCartId
                    return (
                      <div key={deck.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <BookOpen className={cn("h-3 w-3 shrink-0", isLiveDeck ? "text-green-400" : "text-muted-foreground")} />
                          <span className={cn("text-xs truncate", isLiveDeck ? "text-green-400" : "text-muted-foreground")}>{deck.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{count}{sideCnt > 0 ? `+${sideCnt}` : ""}</span>
                      </div>
                    )
                  })}
                  <div className="border-t border-border/50 pt-2 space-y-1.5">
                    {/* Case 1: no cards selected yet */}
                    {selectedCardTotal === 0 && (
                      <div className="rounded-lg bg-surface-raised border border-border/60 px-3 py-2.5 space-y-1.5">
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Selecciona los mazos que queres incluir en el pedido.
                        </p>
                        <div className="h-1 rounded-full bg-border/40 overflow-hidden">
                          <div className="h-full w-0 rounded-full bg-amber-500" />
                        </div>
                        <p className="text-[10px] text-muted-foreground/50 tabular-nums">Minimo: {MIN_ORDER_CARDS} cartas</p>
                      </div>
                    )}

                    {/* Case 2: below minimum (1..29) */}
                    {selectedCardTotal > 0 && !orderMet && (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2.5 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-300 leading-snug">
                            Necesitas al menos <strong>{MIN_ORDER_CARDS} cartas</strong> para comprar. Te faltan <strong>{MIN_ORDER_CARDS - selectedCardTotal}</strong>.
                          </p>
                        </div>
                        <div className="h-1 rounded-full bg-amber-500/20 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${Math.min((selectedCardTotal / MIN_ORDER_CARDS) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-amber-400/60 tabular-nums">{selectedCardTotal} / {MIN_ORDER_CARDS} cartas</p>
                      </div>
                    )}

                    {/* Case 3: ready to buy — show price + next bracket hint */}
                    {orderMet && (() => {
                      const nextBracket = getNextBracket(tiers, selectedCardTotal)
                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Precio por carta</span>
                            <span className="text-xs font-semibold text-foreground tabular-nums">{formatARS(unitPrice)}/carta</span>
                          </div>
                          {nextBracket && (
                            <div className="rounded-lg bg-accent-blue/8 border border-accent-blue/20 px-3 py-2 space-y-1.5">
                              <p className="text-[11px] text-accent-blue/80 leading-snug">
                                Agregando <strong>{nextBracket.cardsNeeded} cartas</strong> mas llegas a {nextBracket.nextMin} y el precio baja a <strong>{formatARS(nextBracket.nextUnitPrice)}/carta</strong>
                              </p>
                              <div className="h-1 rounded-full bg-accent-blue/15 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-accent-blue/60 transition-all duration-500"
                                  style={{ width: `${Math.min(((selectedCardTotal - (nextBracket.nextMin - nextBracket.cardsNeeded - 1)) / nextBracket.cardsNeeded) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {!nextBracket && (
                            <p className="text-[10px] text-emerald-400/80">Estas en el mejor precio disponible</p>
                          )}
                        </>
                      )
                    })()}

                    {/* Discount code input */}
                    {orderMet && (
                      <div className="space-y-2 pt-1 border-t border-border/50">
                        {appliedDiscount ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                            <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-emerald-300 truncate">
                                {appliedDiscount.code}
                                {appliedDiscount.benefit_type === "percentage" && ` · ${appliedDiscount.percentage}% off`}
                                {appliedDiscount.benefit_type === "free_shipping" && " · Envio gratis"}
                                {appliedDiscount.benefit_type === "bypass_payment" && " · Pedido sin costo"}
                              </p>
                              {appliedDiscount.description && (
                                <p className="text-[10px] text-emerald-400/60">{appliedDiscount.description}</p>
                              )}
                            </div>
                            <button onClick={removeDiscount} className="p-1 text-emerald-400/50 hover:text-red-400 transition-colors rounded-md" title="Quitar codigo">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <input
                                value={discountInput}
                                onChange={e => { setDiscountInput(e.target.value.toUpperCase()); setDiscountError(null) }}
                                onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) applyDiscount() }}
                                placeholder="Codigo de descuento"
                                className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent-gold/30 uppercase tracking-wider"
                              />
                              <button
                                onClick={applyDiscount}
                                disabled={!discountInput.trim() || discountChecking}
                                className="h-9 px-3 rounded-lg border border-border bg-surface-raised text-[11px] font-bold text-muted-foreground hover:text-foreground hover:border-accent-gold/50 disabled:opacity-40 transition-all flex items-center gap-1.5"
                              >
                                {discountChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                                Aplicar
                              </button>
                            </div>
                            {discountError && (
                              <p className="text-[10px] text-red-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" /> {discountError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Discount line */}
                    {orderMet && appliedDiscount && appliedDiscount.benefit_type === "percentage" && appliedDiscount.percentage && (
                      <div className="flex justify-between">
                        <span className="text-xs text-emerald-400/80 flex items-center gap-1"><Tag className="h-3 w-3" /> Descuento {appliedDiscount.percentage}%</span>
                        <span className="text-xs text-emerald-400 tabular-nums font-semibold">-{formatARS(Math.round(cardTotal * appliedDiscount.percentage / 100))}</span>
                      </div>
                    )}

                    {orderMet && deliveryMethod === "shipping" && (
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Envio</span>
                        {appliedDiscount?.benefit_type === "free_shipping"
                          ? <span className="text-xs text-emerald-400 font-semibold">GRATIS</span>
                          : <span className="text-xs tabular-nums">{formatARS(shippingRate)}</span>
                        }
                      </div>
                    )}
                    {orderMet && deliveryMethod === "pickup" && (
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Retiro</span>
                        <span className="text-xs text-emerald-400 font-semibold">GRATIS</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-border/50">
                      <span className="text-xs font-bold text-foreground">Total</span>
                      <div className="text-right">
                        {appliedDiscount && baseOrderTotal !== orderTotal && (
                          <p className="text-[10px] text-muted-foreground/50 tabular-nums line-through">{formatARS(baseOrderTotal)}</p>
                        )}
                        <span className={cn("text-base font-extrabold tabular-nums", orderMet ? (isBypassPayment ? "text-emerald-400" : "text-accent-gold") : "text-muted-foreground/40")}>
                          {orderMet ? (isBypassPayment ? "GRATIS" : formatARS(orderTotal)) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {allEntries.length > 0 && (
                    <div className="border-t border-border/50 pt-2">
                      <button onClick={() => setListOpen(v => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                        <Layers className="h-3 w-3" />
                        <span>{selectedCardTotal} cartas en total</span>
                        {listOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                      </button>
                      {listOpen && (
                        <div className="mt-2 flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                          {allEntries.map((entry, i) => {
                            const thumb = getThumb(entry)
                            return thumb ? (
                              <div key={i} className="relative">
                                <img src={thumb} alt={entry.card.name} className="h-12 w-9 rounded object-cover" />
                                {entry.quantity > 1 && <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-black/80 text-white rounded px-0.5 leading-tight">x{entry.quantity}</span>}
                              </div>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

export default function CarritoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DeckboxInner />
    </Suspense>
  )
}
