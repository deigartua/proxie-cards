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

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (!token) return false

  const supabase = getServiceClient()
  const { data } = await supabase
    .from("admin_sessions")
    .select("token")
    .eq("token", token)
    .single()

  return !!data
}

// GET — list all tiers (active + inactive)
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("price_tiers")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tiers: data })
}

// POST — create a new tier
export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const body = await request.json()
  const { min_cards, max_cards, total_price, label, is_active, sort_order } = body

  if (!min_cards || !total_price) {
    return NextResponse.json({ error: "min_cards y total_price son requeridos" }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("price_tiers")
    .insert({
      min_cards,
      max_cards: max_cards ?? null,
      total_price,
      label: label || null,
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tier: data })
}

// PATCH — update a tier
export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const body = await request.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("price_tiers")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tier: data })
}

// DELETE — delete a tier
export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const supabase = getServiceClient()
  const { error } = await supabase.from("price_tiers").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
