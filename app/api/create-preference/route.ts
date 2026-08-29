import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { items, email, orderId, shortCode } = body

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
    if (!accessToken) {
      console.error("[create-preference] MERCADO_PAGO_ACCESS_TOKEN no está configurado en las variables de entorno")
      return NextResponse.json({ error: "Pago no disponible: token de MercadoPago no configurado. Agregá MERCADO_PAGO_ACCESS_TOKEN en las variables de entorno del proyecto." }, { status: 500 })
    }
    if (!orderId) {
      return NextResponse.json({ error: "Order ID requerido" }, { status: 400 })
    }
    if (!items?.length) {
      return NextResponse.json({ error: "Items requeridos" }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.proxie.cards"
    const isTestMode = process.env.MP_TEST_MODE === "true"

    const preference = {
      items: items.map((item: { title: string; quantity: number; unit_price: number }) => ({
        title: item.title,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        currency_id: "ARS",
      })),
      // En modo test NO enviar email real — MP bloqueará el pago si detecta una cuenta real
      payer: isTestMode ? {} : { email: email ?? "" },
      back_urls: {
        success: `${baseUrl}/pedido/success?code=${encodeURIComponent(shortCode ?? "")}&email=${encodeURIComponent(email ?? "")}`,
        failure: `${baseUrl}/pedido`,
        pending: `${baseUrl}/pedido/success?code=${encodeURIComponent(shortCode ?? "")}&email=${encodeURIComponent(email ?? "")}&status=pending`,
      },
      auto_return: "approved",
      external_reference: String(orderId),
      notification_url: `${baseUrl}/api/mercadopago/webhook`,
      statement_descriptor: "PROXIE CARDS",
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("[create-preference] MP API error status:", response.status, "body:", JSON.stringify(data))
      const msg = response.status === 401 || response.status === 403
        ? "Token de MercadoPago inválido o sin permisos. Verificá que MERCADO_PAGO_ACCESS_TOKEN sea correcto."
        : "Error al crear preferencia de pago"
      return NextResponse.json({ error: msg, details: data }, { status: response.status })
    }

    // En modo test con credenciales APP_USR usar sandbox_init_point para evitar pagos reales
    const checkoutUrl = isTestMode
      ? (data.sandbox_init_point ?? data.init_point)
      : data.init_point

    console.log("[create-preference] mode:", isTestMode ? "TEST (sandbox)" : "PRODUCTION", "url:", checkoutUrl)

    return NextResponse.json({ init_point: checkoutUrl, preference_id: data.id })
  } catch (err) {
    console.error("[create-preference] Unexpected error:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
