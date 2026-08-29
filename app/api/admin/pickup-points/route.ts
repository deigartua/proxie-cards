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

async function isAdmin(): Promise<boolean> {
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

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("pickup_points")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ points: data })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await req.json()
  const { name, address, city, google_maps_url, hours, phone, notes } = body
  if (!name?.trim() || !address?.trim()) {
    return NextResponse.json({ error: "Nombre y dirección son requeridos" }, { status: 400 })
  }
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("pickup_points")
    .insert({ name: name.trim(), address: address.trim(), city: city?.trim() || "La Plata", google_maps_url: google_maps_url?.trim() || null, hours: hours?.trim() || null, phone: phone?.trim() || null, notes: notes?.trim() || null })
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ point: data }, { status: 201 })
}
