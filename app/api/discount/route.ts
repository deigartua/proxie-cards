"use server"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// GET /api/discount?code=PROMO30
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: "Codigo requerido" }, { status: 400 })

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("discount_codes")
    .select("id, code, benefit_type, percentage, max_uses, uses, expires_at, is_active, description")
    .eq("is_active", true)
    .ilike("code", code)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Codigo no valido" }, { status: 404 })
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: "El codigo ya expiro" }, { status: 400 })
  }

  // Check usage limit
  if (data.max_uses !== null && data.uses >= data.max_uses) {
    return NextResponse.json({ error: "El codigo ya fue utilizado el maximo de veces" }, { status: 400 })
  }

  return NextResponse.json({ discount: data })
}
