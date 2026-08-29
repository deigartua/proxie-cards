/**
 * POST /api/order-status/notify
 *
 * Called by the admin to update an order's status AND send the
 * appropriate transactional email.
 *
 * Body for "shipped":
 *   { orderId, type: "shipped", trackingCode, carrier? }
 *
 * Body for "ready_pickup":
 *   { orderId, type: "ready_pickup", pickupLocation?, pickupHours?, daysToPickup? }
 *
 * Protected by the same ADMIN_PASSWORD as the admin login.
 */

import { NextResponse } from "next/server"
import { createClient }  from "@supabase/supabase-js"
import { Resend }         from "resend"
import { orderShippedEmail, orderPickupReadyEmail } from "@/lib/email-templates"
import { cookies }        from "next/headers"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (!token) return false

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data } = await supabase
    .from("admin_sessions")
    .select("id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single()

  return !!data
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { orderId, type } = body as {
      orderId: string
      type:    "shipped" | "ready_pickup"
      trackingCode?:    string
      carrier?:         string
      pickupLocation?:  string
      pickupHours?:     string
      daysToPickup?:    number
    }

    if (!orderId || !type) {
      return NextResponse.json({ error: "orderId y type son requeridos" }, { status: 400 })
    }
    if (type === "shipped" && !body.trackingCode) {
      return NextResponse.json({ error: "trackingCode es requerido para shipped" }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Fetch full order
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, name, email, deck, short_code, delivery_method, address, total_price")
      .eq("id", orderId)
      .single()

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    const totalCards: number = Array.isArray(order.deck)
      ? order.deck.reduce((s: number, c: { quantity?: number }) => s + (c.quantity ?? 1), 0)
      : 0

    // Build status update patch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {
      status: type === "shipped" ? "shipped" : "ready_pickup",
    }
    if (type === "shipped") {
      patch.tracking_code = body.trackingCode
    }
    if (type === "ready_pickup") {
      patch.pickup_ready_at = new Date().toISOString()
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", orderId)

    if (updateErr) {
      console.error("[notify] Supabase update error:", updateErr)
      return NextResponse.json({ error: "Error al actualizar el pedido" }, { status: 500 })
    }

    // Send email if we have a real email address
    const customerEmail = order.email?.startsWith("whatsapp:") ? null : order.email
    if (customerEmail) {
      const apiKey = process.env.RESEND_API_KEY
      const from   = process.env.RESEND_FROM_EMAIL?.trim()

      if (apiKey && from) {
        const resend = new Resend(apiKey)
        const baseParams = {
          orderCode:      order.short_code,
          customerName:   order.name,
          totalCards,
          deliveryMethod: (order.delivery_method ?? "pickup") as "pickup" | "shipping",
          address:        order.address ?? undefined,
        }

        let emailPayload: { subject: string; html: string; text: string } | null = null

        if (type === "shipped") {
          emailPayload = orderShippedEmail({
            ...baseParams,
            trackingCode: body.trackingCode!,
            carrier:      body.carrier,
          })
        } else if (type === "ready_pickup") {
          emailPayload = orderPickupReadyEmail({
            ...baseParams,
            pickupReadyAt:   new Date().toISOString(),
            pickupLocation:  body.pickupLocation,
            pickupHours:     body.pickupHours,
            daysToPickup:    body.daysToPickup ?? 8,
          })
        }

        if (emailPayload) {
          await resend.emails.send({
            from:    `Proxie.cards <${from}>`,
            to:      customerEmail,
            subject: emailPayload.subject,
            html:    emailPayload.html,
            text:    emailPayload.text,
            headers: { "X-Entity-Ref-ID": order.short_code },
          })
        }
      } else {
        console.warn("[notify] Resend not configured — email skipped")
      }
    }

    return NextResponse.json({ ok: true, status: patch.status })
  } catch (err) {
    console.error("[notify] Unexpected error:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
