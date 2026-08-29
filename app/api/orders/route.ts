import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { orderConfirmationEmail } from "@/lib/email-templates"
import { createClient as createServerClient } from "@/lib/supabase/server"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/**
 * Walks the (loosely-typed) deck JSON payload and collects the
 * custom_card_uploads row ids referenced by any synthetic "custom:<id>" card,
 * across every deck/entry shape the client might send.
 */
function collectCustomUploadIds(deck: unknown): string[] {
  const ids = new Set<string>()

  function visitCard(card: unknown) {
    if (!card || typeof card !== "object") return
    const id = (card as { id?: unknown }).id
    if (typeof id === "string" && id.startsWith("custom:")) {
      ids.add(id.slice("custom:".length))
    }
  }

  function visitEntries(entries: unknown) {
    if (!Array.isArray(entries)) return
    for (const entry of entries) {
      if (entry && typeof entry === "object") {
        visitCard((entry as { card?: unknown }).card)
      }
    }
  }

  if (Array.isArray(deck)) {
    for (const item of deck) {
      if (item && typeof item === "object") {
        // Either a flat list of entries, or a list of decks each with .entries
        visitCard((item as { card?: unknown }).card)
        visitEntries((item as { entries?: unknown }).entries)
      }
    }
  }

  return Array.from(ids)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateShortCode(supabase: any): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const part1 = Math.floor(1000 + Math.random() * 9000)
    const part2 = Math.floor(1000 + Math.random() * 9000)
    const code  = `${part1}-${part2}`
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("short_code", code)
      .maybeSingle()
    if (!data) return code
  }
  throw new Error("No se pudo generar un código único")
}

async function sendConfirmationEmail(opts: {
  to:             string
  name:           string
  shortCode:      string
  totalCards:     number
  deliveryMethod: "pickup" | "shipping"
  address?:       string | null
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM_EMAIL?.trim()
  if (!apiKey || !from) {
    console.warn("[orders] RESEND_API_KEY or RESEND_FROM_EMAIL not set — email skipped")
    return
  }

  const { subject, html, text } = orderConfirmationEmail({
    orderCode:      opts.shortCode,
    customerName:   opts.name,
    totalCards:     opts.totalCards,
    deliveryMethod: opts.deliveryMethod,
    address:        opts.address ?? undefined,
  })

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from:     `Proxie.cards <${from}>`,
    to:       opts.to,
    subject,
    html,
    text,
    headers: {
      "X-Entity-Ref-ID": opts.shortCode,
    },
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      email,
      notes,
      packSize,
      materialId,
      totalPrice,
      deck,
      delivery_method  = "pickup",
      address          = null,
      pickup_point_id  = null,
      discountCode     = null,
    } = body

    if (!name || !email || !packSize || !materialId || !deck) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const supabase   = getServiceClient()

    // If the customer is logged in, attach the order to their account so it
    // shows up under "Mis pedidos" — guests (no session) keep working exactly
    // as before with user_id left null.
    let userId: string | null = null
    try {
      const serverClient = await createServerClient()
      const { data: { user: sessionUser } } = await serverClient.auth.getUser()
      userId = sessionUser?.id ?? null
    } catch {
      userId = null
    }

    // ── Validate & apply discount code ────────────────────────────────────────
    let discountType:   string | null = null
    let discountPct:    number | null = null
    let discountAmount: number | null = null
    let originalPrice:  number | null = null
    let isBypassPayment               = false
    let effectiveTotalPrice: number   = totalPrice

    if (discountCode) {
      const codeUpper = String(discountCode).toUpperCase().trim()
      const { data: codeRow, error: codeErr } = await supabase
        .from("discount_codes")
        .select("id, benefit_type, percentage, max_uses, uses, expires_at, is_active")
        .eq("is_active", true)
        .ilike("code", codeUpper)
        .single()

      if (!codeErr && codeRow) {
        const expired   = codeRow.expires_at && new Date(codeRow.expires_at) < new Date()
        const exhausted = codeRow.max_uses !== null && codeRow.uses >= codeRow.max_uses
        if (!expired && !exhausted) {
          discountType = codeRow.benefit_type
          originalPrice = totalPrice

          if (codeRow.benefit_type === "percentage" && codeRow.percentage) {
            discountPct    = codeRow.percentage
            discountAmount = Math.round(totalPrice * codeRow.percentage / 100)
            effectiveTotalPrice = Math.max(0, totalPrice - discountAmount)
          } else if (codeRow.benefit_type === "free_shipping") {
            // shipping discount is applied client-side; store original vs effective
            discountAmount      = 0 // actual amount TBD by client
            effectiveTotalPrice = totalPrice
          } else if (codeRow.benefit_type === "bypass_payment") {
            discountAmount      = totalPrice
            effectiveTotalPrice = 0
            isBypassPayment     = true
          }

          // Increment usage counter (fire-and-forget)
          void supabase
            .from("discount_codes")
            .update({ uses: codeRow.uses + 1, updated_at: new Date().toISOString() })
            .eq("id", codeRow.id)
        }
      }
    }

    const shortCode  = await generateShortCode(supabase)
    const totalCards: number = Array.isArray(deck)
      ? deck.reduce((s: number, c: { quantity?: number }) => s + (c.quantity ?? 1), 0)
      : 0

    const { data, error } = await supabase
      .from("orders")
      .insert({
        name,
        email,
        user_id:          userId,
        notes:            notes ?? null,
        pack_size:        packSize,
        material_id:      materialId,
        total_price:      effectiveTotalPrice,
        deck,
        // bypass_payment orders go directly to "paid" status
        status:           isBypassPayment ? "paid" : "pending",
        short_code:       shortCode,
        delivery_method,
        address:          address ?? null,
        pickup_point_id:  pickup_point_id ?? null,
        discount_code:    discountCode ?? null,
        discount_type:    discountType,
        discount_pct:     discountPct,
        discount_amount:  discountAmount,
        original_price:   originalPrice,
      })
      .select("id, short_code")
      .single()

    if (error) {
      console.error("[orders] Supabase insert error:", error)
      return NextResponse.json({ error: "Error al guardar el pedido" }, { status: 500 })
    }

    // Mark any custom-uploaded card images used in this deck as "claimed" so the
    // orphan-cleanup cron never deletes them — they're now attached to a real order.
    const customUploadIds = collectCustomUploadIds(deck)
    if (customUploadIds.length > 0) {
      void supabase
        .from("custom_card_uploads")
        .update({ claimed_at: new Date().toISOString() })
        .in("id", customUploadIds)
        .then(({ error: claimError }) => {
          if (claimError) console.error("[orders] Failed to mark custom uploads as claimed:", claimError)
        })
    }

    // Fire-and-forget confirmation email
    const customerEmail = email.startsWith("whatsapp:") ? null : email
    if (customerEmail) {
      sendConfirmationEmail({
        to:             customerEmail,
        name,
        shortCode:      data.short_code,
        totalCards,
        deliveryMethod: delivery_method as "pickup" | "shipping",
        address,
      }).catch((e) => console.error("[orders] Email send error:", e))
    }

    return NextResponse.json({
      id:               data.id,
      short_code:       data.short_code,
      bypass_payment:   isBypassPayment,
      effective_price:  effectiveTotalPrice,
    }, { status: 201 })
  } catch (err) {
    console.error("[orders] Unexpected error:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
