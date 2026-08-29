import { Resend }             from "resend"
import { NextResponse }        from "next/server"
import { orderShippedEmail }   from "@/lib/email-templates"

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 })
    }

    const apiKey  = process.env.RESEND_API_KEY?.trim()
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()

    if (!apiKey) {
      return NextResponse.json({ error: "Falta RESEND_API_KEY en las variables de entorno" }, { status: 500 })
    }
    if (!fromEmail) {
      return NextResponse.json({ error: "Falta RESEND_FROM_EMAIL en las variables de entorno (o está vacía)" }, { status: 500 })
    }

    const resend = new Resend(apiKey)

    // Generate a fake order code for the preview
    const testCode    = `${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`
    const trackingCode = `AR${String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, "0")}AR`

    const { subject, html, text } = orderShippedEmail({
      orderCode:      testCode,
      customerName:   "Santiago",
      totalCards:     30,
      deliveryMethod: "shipping",
      address:        "Av. Corrientes 1234, CABA",
      trackingCode,
      carrier:        "Correo Argentino",
    })

    const emailRes = await resend.emails.send({
      from:    `Proxie.cards <${fromEmail}>`,
      to:      email,
      subject: `[PRUEBA] ${subject}`,
      html,
      text,
      headers: { "X-Entity-Ref-ID": testCode },
    })

    if (emailRes.error) {
      console.error("[test-email] Resend error:", emailRes.error)
      return NextResponse.json(
        { error: emailRes.error.message ?? "Error desconocido de Resend", resend_error: emailRes.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success:   true,
      message:   "Email de prueba enviado con el nuevo template",
      email,
      testCode,
      trackingCode,
      messageId: emailRes.data?.id,
    })
  } catch (err) {
    console.error("[test-email] Error:", err)
    return NextResponse.json(
      { error: "Error al procesar solicitud", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
