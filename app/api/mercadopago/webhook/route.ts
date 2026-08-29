import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// MP hace GET para verificar que el endpoint existe
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Solo procesar eventos de tipo "payment"
    if (body.type !== "payment" || !body.data?.id) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const paymentId = body.data.id
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!accessToken) {
      console.error("[webhook] MERCADO_PAGO_ACCESS_TOKEN no configurado")
      return NextResponse.json({ error: "MP no configurado" }, { status: 500 })
    }

    // Consultar los datos del pago a la API de MP
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!paymentResponse.ok) {
      console.error("[webhook] Error al obtener pago:", paymentId)
      return NextResponse.json({ error: "Error al obtener pago" }, { status: 200 }) // 200 para que MP no reintente
    }

    const paymentData = await paymentResponse.json()
    const orderId = paymentData.external_reference

    if (!orderId) {
      console.error("[webhook] Pago sin external_reference:", paymentId)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Mapear status de MP a status interno
    const internalStatus =
      paymentData.status === "approved"
        ? "paid"
        : paymentData.status === "pending" || paymentData.status === "in_process"
        ? "pending"
        : "cancelled"

    const supabase = getServiceClient()
    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: paymentData.status,
        payment_id: String(paymentId),
        status: internalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (error) {
      console.error("[webhook] Supabase update error:", error)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error("[webhook] Unexpected error:", err)
    // Devolver 200 para que MP no reintente indefinidamente
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
