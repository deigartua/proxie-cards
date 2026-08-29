"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  UserRound,
  Package,
  Loader2,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ChevronRight,
} from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { createClient } from "@/lib/supabase/client"
import { formatARS } from "@/lib/materials"

// Must mirror the `orders_status_check` constraint in the database exactly —
// an order with a status missing here would crash this page for its owner.
type OrderStatus =
  | "pending"
  | "paid"
  | "printing"
  | "packaged"
  | "shipped"
  | "ready_pickup"
  | "delivered"
  | "cancelled"

interface OrderSummary {
  short_code: string
  status: OrderStatus
  created_at: string
  pack_size: number
  total_price: number
}

const STATUS_META: Record<OrderStatus, { label: string; icon: React.ReactNode; className: string }> = {
  pending:      { label: "Recibido",     icon: <Clock className="h-3.5 w-3.5" />,       className: "text-muted-foreground border-border bg-surface" },
  paid:         { label: "Pago confirmado", icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: "text-accent-gold border-accent-gold/40 bg-accent-gold/10" },
  printing:     { label: "Imprimiendo",  icon: <Package className="h-3.5 w-3.5" />,      className: "text-accent-gold border-accent-gold/40 bg-accent-gold/10" },
  packaged:     { label: "Empaquetado",  icon: <Package className="h-3.5 w-3.5" />,      className: "text-accent-blue border-accent-blue/40 bg-accent-blue/10" },
  shipped:      { label: "Enviado",      icon: <Truck className="h-3.5 w-3.5" />,        className: "text-accent-blue border-accent-blue/40 bg-accent-blue/10" },
  ready_pickup: { label: "Listo para retirar", icon: <Package className="h-3.5 w-3.5" />, className: "text-accent-blue border-accent-blue/40 bg-accent-blue/10" },
  delivered:    { label: "Entregado",    icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  cancelled:    { label: "Cancelado",    icon: <XCircle className="h-3.5 w-3.5" />,      className: "text-destructive border-destructive/40 bg-destructive/10" },
}

export default function AccountPage() {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading, updateProfile } = useProfile(user)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name)
      setLastName(profile.last_name)
    }
  }, [profile])

  useEffect(() => {
    if (!user) {
      setOrders(null)
      setOrdersLoading(false)
      return
    }
    const supabase = createClient()
    setOrdersLoading(true)
    // IMPORTANT: filter by user_id explicitly here, even though RLS also
    // restricts this. The `orders` table has a separate public policy that
    // allows lookups by short_code (for guest order tracking), and Postgres
    // OR-combines policies for the same command — so relying on RLS alone
    // would leak every order in the store to any logged-in user.
    supabase
      .from("orders")
      .select("short_code, status, created_at, pack_size, total_price")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("[v0] Failed to load account orders:", error.message)
        }
        setOrders((data as OrderSummary[]) ?? [])
        setOrdersLoading(false)
      })
  }, [user?.id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const { error } = await updateProfile({ first_name: firstName.trim(), last_name: lastName.trim() })
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-blue/10 text-accent-blue">
            <UserRound className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Iniciá sesión para ver tu cuenta</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            Usá el ícono de perfil en la barra superior para iniciar sesión o crear una cuenta.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 pt-24 pb-16 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Mi cuenta</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestioná tus datos y revisá tus pedidos.</p>
        </div>

        {/* Basic data */}
        <section className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Datos básicos</h2>
          </div>
          <form onSubmit={handleSave} className="px-5 py-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="first-name" className="text-xs font-semibold text-muted-foreground">
                  Nombre
                </label>
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  disabled={profileLoading}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="last-name" className="text-xs font-semibold text-muted-foreground">
                  Apellido
                </label>
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  disabled={profileLoading}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                Email
              </label>
              <Input id="email" value={user.email ?? ""} disabled className="text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Button
                type="submit"
                disabled={saving || profileLoading}
                className="rounded-xl bg-accent-blue text-white hover:bg-accent-blue/90"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar cambios"}
              </Button>
              {saved && <span className="text-xs text-emerald-400 font-medium">Guardado</span>}
            </div>
          </form>
        </section>

        {/* Orders */}
        <section className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Mis pedidos</h2>
          </div>

          {ordersLoading ? (
            <div className="px-5 py-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="px-5 py-8 text-center flex flex-col items-center gap-3">
              <Package className="h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Todavía no hiciste ningún pedido con esta cuenta.
              </p>
              <Link href="/deckbuilder" className="text-sm text-accent-gold hover:underline font-medium">
                Armar mi primer mazo
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {orders.map(order => {
                const meta = STATUS_META[order.status]
                return (
                  <Link
                    key={order.short_code}
                    href={`/orders/${order.short_code}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-foreground tracking-wide">
                          {order.short_code}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${meta.className}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("es-AR", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                        {" · "}
                        {order.pack_size} cartas
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-extrabold text-accent-gold tabular-nums">
                        {formatARS(order.total_price)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
