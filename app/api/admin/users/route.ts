import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (!token) return false

  const supabase = getServiceClient()
  const { data } = await supabase
    .from("admin_sessions")
    .select("id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single()

  return !!data
}

export interface AdminUserRow {
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

export interface AdminUsersStats {
  total_users: number
  new_last_7_days: number
  new_last_30_days: number
  users_with_orders: number
  total_revenue: number
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const supabase = getServiceClient()

  try {
    // 1. Pull every registered auth user via the admin API — auth.users is not
    //    exposed over PostgREST, so this is the supported way to list accounts.
    const allAuthUsers: {
      id: string
      email: string | undefined
      created_at: string
      last_sign_in_at: string | null | undefined
      confirmed_at: string | null | undefined
    }[] = []
    let page = 1
    const perPage = 1000
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
      if (error) throw error
      allAuthUsers.push(
        ...data.users.map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          confirmed_at: u.confirmed_at,
        }))
      )
      if (data.users.length < perPage) break
      page += 1
    }

    // 2. Profile info (first/last name)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
    if (profilesError) throw profilesError
    const profileById = new Map(profiles?.map(p => [p.id, p]) ?? [])

    // 3. Orders — aggregate count + spend per user.
    //    Checkout never actually stamps `user_id` on the order row today (it's
    //    always null in practice), so matching by user_id alone would show
    //    every account as having 0 orders. The order's `email` field is the
    //    only reliable link back to an account for now — match on that
    //    (case-insensitive), and also key by user_id for forward-compatibility
    //    in case checkout starts stamping it later.
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("user_id, email, total_price, status")
    if (ordersError) throw ordersError

    const orderStatsByUser  = new Map<string, { count: number; spent: number }>()
    const orderStatsByEmail = new Map<string, { count: number; spent: number }>()
    for (const o of orders ?? []) {
      // "pending" / cancelled orders never actually collected money.
      const paid = o.status !== "pending" && o.status !== "cancelled"

      if (o.user_id) {
        const entry = orderStatsByUser.get(o.user_id) ?? { count: 0, spent: 0 }
        entry.count += 1
        if (paid) entry.spent += o.total_price ?? 0
        orderStatsByUser.set(o.user_id, entry)
      }

      const emailKey = o.email?.trim().toLowerCase()
      if (emailKey && !emailKey.startsWith("whatsapp:")) {
        const entry = orderStatsByEmail.get(emailKey) ?? { count: 0, spent: 0 }
        entry.count += 1
        if (paid) entry.spent += o.total_price ?? 0
        orderStatsByEmail.set(emailKey, entry)
      }
    }

    // 4. Saved decks — deck count + last-updated per user
    const { data: userDecks, error: decksError } = await supabase
      .from("user_decks")
      .select("user_id, data, updated_at")
    if (decksError) throw decksError

    const deckStatsByUser = new Map<string, { count: number; updated_at: string }>()
    for (const d of userDecks ?? []) {
      const decks = Array.isArray((d.data as { decks?: unknown[] } | null)?.decks)
        ? (d.data as { decks: unknown[] }).decks
        : []
      deckStatsByUser.set(d.user_id, { count: decks.length, updated_at: d.updated_at })
    }

    // 5. Merge everything into one row per user
    const users: AdminUserRow[] = allAuthUsers.map(u => {
      const profile    = profileById.get(u.id)
      const emailKey    = u.email?.trim().toLowerCase()
      const orderStat   = orderStatsByUser.get(u.id) ?? (emailKey ? orderStatsByEmail.get(emailKey) : undefined)
      const deckStat    = deckStatsByUser.get(u.id)
      return {
        id: u.id,
        email: u.email ?? profile?.first_name ?? "—",
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed: !!u.confirmed_at,
        order_count: orderStat?.count ?? 0,
        total_spent: orderStat?.spent ?? 0,
        deck_count: deckStat?.count ?? 0,
        last_deck_update: deckStat?.updated_at ?? null,
      }
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // 6. Aggregate stats
    const now = Date.now()
    const sevenDaysAgo  = now - 7  * 24 * 60 * 60 * 1000
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    const stats: AdminUsersStats = {
      total_users: users.length,
      new_last_7_days: users.filter(u => new Date(u.created_at).getTime() >= sevenDaysAgo).length,
      new_last_30_days: users.filter(u => new Date(u.created_at).getTime() >= thirtyDaysAgo).length,
      users_with_orders: users.filter(u => u.order_count > 0).length,
      total_revenue: users.reduce((sum, u) => sum + u.total_spent, 0),
    }

    return NextResponse.json({ users, stats })
  } catch (err) {
    console.error("[admin/users] Error:", err)
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 })
  }
}
