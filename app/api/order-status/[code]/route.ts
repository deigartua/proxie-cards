import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 })

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("orders")
    .select("id, short_code, name, status, created_at, pack_size, material_id, total_price, deck")
    .eq("short_code", code.toUpperCase())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
  }

  return NextResponse.json(data)
}
