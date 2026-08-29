import { NextRequest, NextResponse } from "next/server"
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

// GET /api/admin/discount-codes — list all codes
export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ codes: data })
}

// POST /api/admin/discount-codes — create a new code
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await req.json()
  const { code, benefit_type, percentage, max_uses, expires_at, description } = body

  if (!code?.trim()) return NextResponse.json({ error: "El codigo es requerido" }, { status: 400 })
  if (!["percentage", "free_shipping", "bypass_payment"].includes(benefit_type)) {
    return NextResponse.json({ error: "Tipo de beneficio invalido" }, { status: 400 })
  }
  if (benefit_type === "percentage" && (!percentage || percentage < 1 || percentage > 100)) {
    return NextResponse.json({ error: "Porcentaje invalido (1-100)" }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("discount_codes")
    .insert({
      code:         code.trim().toUpperCase(),
      benefit_type,
      percentage:   benefit_type === "percentage" ? percentage : null,
      max_uses:     max_uses ?? null,
      expires_at:   expires_at ?? null,
      description:  description?.trim() ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Ya existe un codigo con ese nombre" }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ code: data })
}

// DELETE /api/admin/discount-codes — delete by id (passed as query param)
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  const supabase = getServiceClient()
  const { error } = await supabase.from("discount_codes").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/discount-codes — toggle is_active
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("discount_codes")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: data })
}
