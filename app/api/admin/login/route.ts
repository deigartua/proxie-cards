import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const ADMIN_EMAIL = "deigartua@icloud.com"
const ADMIN_PASSWORD = "Onepiece123"
const ADMIN_PIN = "1242"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(request: Request) {
  try {
    const { email, password, pin } = await request.json()

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD || pin !== ADMIN_PIN) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 })
    }

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from("admin_sessions")
      .insert({})
      .select("token")
      .single()

    if (error || !data) {
      console.error("[admin/login] Session insert error:", error)
      return NextResponse.json({ error: "Error al crear sesión" }, { status: 500 })
    }

    const cookieStore = await cookies()
    cookieStore.set("admin_token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12, // 12 hours
      path: "/",
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[admin/login] Unexpected error:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
