import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB (defense in depth — client already compresses)
const MAX_UPLOADS_PER_DECK = 100
const MAX_UPLOADS_PER_DAY = 150

/**
 * Uploads a single custom card image for the authenticated user.
 * Expects multipart/form-data with:
 *  - file: the (already client-compressed) image blob
 *  - deckId: local id of the deck this upload belongs to (informational)
 *  - cardName: optional display name the user gave the "card"
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Debes iniciar sesion para subir imagenes" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file")
  const deckId = formData.get("deckId")
  const cardName = formData.get("cardName")

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "La imagen es demasiado grande (maximo 10MB)" }, { status: 413 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "El archivo no es una imagen valida" }, { status: 400 })
  }

  // ── Rate limit: uploads today for this user ──────────────────────────────
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count: uploadsToday, error: dailyCountError } = await supabase
    .from("custom_card_uploads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfDay.toISOString())

  if (dailyCountError) {
    return NextResponse.json({ error: "No se pudo validar el limite diario" }, { status: 500 })
  }
  if ((uploadsToday ?? 0) >= MAX_UPLOADS_PER_DAY) {
    return NextResponse.json(
      { error: `Alcanzaste el limite de ${MAX_UPLOADS_PER_DAY} imagenes por dia` },
      { status: 429 },
    )
  }

  // ── Cap per deck ──────────────────────────────────────────────────────────
  if (typeof deckId === "string" && deckId.length > 0) {
    const { count: deckCount, error: deckCountError } = await supabase
      .from("custom_card_uploads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("deck_id", deckId)
      .is("orphaned_at", null)

    if (deckCountError) {
      return NextResponse.json({ error: "No se pudo validar el limite del mazo" }, { status: 500 })
    }
    if ((deckCount ?? 0) >= MAX_UPLOADS_PER_DECK) {
      return NextResponse.json(
        { error: `Este mazo ya tiene el maximo de ${MAX_UPLOADS_PER_DECK} imagenes propias` },
        { status: 429 },
      )
    }
  }

  // ── Upload to Storage ────────────────────────────────────────────────────
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from("custom-cards")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 })
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("custom-cards")
    .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 year — refreshed on demand by the proxy if needed

  if (signedUrlError || !signedUrlData) {
    return NextResponse.json({ error: "No se pudo generar el acceso a la imagen" }, { status: 500 })
  }

  const { data: row, error: insertError } = await supabase
    .from("custom_card_uploads")
    .insert({
      user_id: user.id,
      storage_path: path,
      deck_id: typeof deckId === "string" ? deckId : null,
      card_name: typeof cardName === "string" && cardName.trim() ? cardName.trim().slice(0, 80) : null,
    })
    .select("id")
    .single()

  if (insertError || !row) {
    // Roll back the uploaded file so we don't leave an untracked orphan
    await supabase.storage.from("custom-cards").remove([path])
    return NextResponse.json({ error: "No se pudo registrar la imagen" }, { status: 500 })
  }

  return NextResponse.json({
    id: row.id,
    storagePath: path,
    url: signedUrlData.signedUrl,
  })
}
