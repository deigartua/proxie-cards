/**
 * Proxie.cards — transactional email templates
 *
 * All templates use inline CSS (required for email clients).
 * Brand palette:
 *   background  #0a0b10
 *   surface     #141519
 *   border      #2a2b33
 *   blue        #3b82f6  (accent)
 *   foreground  #f4f4f8
 *   muted       #7a7a8a
 *
 * Anti-spam hygiene:
 *  - No "test", "free", "gratis", "urgent" in subject or body
 *  - Plain-text alternative via Resend's text param
 *  - Consistent From name and reply-to
 *  - Physical address footer (CAN-SPAM / GDPR)
 *  - No all-caps body text
 */

// ── Shared helpers ────────────────────────────────────────────────────────────

const C = {
  bg:         "#0a0b10",
  surface:    "#141519",
  surface2:   "#1c1d24",
  border:     "#2a2b33",
  blue:       "#3b82f6",
  blueLight:  "#60a5fa",
  blueMuted:  "#1d3461",
  foreground: "#f4f4f8",
  muted:      "#7a7a8a",
  green:      "#22c55e",
  greenMuted: "#14532d",
  amber:      "#f59e0b",
  amberMuted: "#451a03",
  red:        "#ef4444",
} as const

const LOGO_URL = "https://proxie.cards/logo.svg"
const SITE_URL = "https://proxie.cards"
const ORDERS_URL = "https://proxie.cards/orders"

// Physical address (required for CAN-SPAM — update when confirmed)
const FOOTER_ADDRESS = "Buenos Aires, Argentina · proxie.cards"

function base(content: string, preheader: string): string {
  return `
<!DOCTYPE html>
<html lang="es" style="background-color:${C.bg};">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Proxie.cards</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin:0;padding:0;background-color:${C.bg} !important; }
    /* Force dark background in Apple Mail / iCloud */
    @media screen {
      body, #__bodyTable { background-color:${C.bg} !important; }
    }
  </style>
</head>
<body bgcolor="${C.bg}" style="margin:0;padding:0;background-color:${C.bg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.bg};">${preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>

  <table id="__bodyTable" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${C.bg}" style="background-color:${C.bg};padding:32px 16px;">
    <tr>
      <td align="center" bgcolor="${C.bg}" style="background-color:${C.bg};">
        <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" bgcolor="${C.bg}" style="padding-bottom:28px;text-align:center;background-color:${C.bg};">
              <a href="${SITE_URL}" style="display:inline-block;text-decoration:none;">
                <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                  <tr>
                    <td bgcolor="${C.surface2}" style="background-color:${C.surface2};border:1px solid ${C.border};border-radius:12px;padding:14px 28px;">
                      <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:${C.foreground};">PROXIE</span><span style="font-size:20px;font-weight:800;color:${C.blue};">.</span><span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:${C.foreground};">CARDS</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td bgcolor="${C.surface}" style="background-color:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="${C.bg}" align="center" style="padding:28px 0 8px;text-align:center;background-color:${C.bg};">
              <p style="margin:0 0 8px;font-size:12px;color:${C.muted};line-height:1.6;">
                Recibiste este correo porque realizaste una compra en <a href="${SITE_URL}" style="color:${C.blue};text-decoration:none;">Proxie.cards</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#4a4a5a;">${FOOTER_ADDRESS}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}

/** Timeline step pill */
function timelineStep(label: string, active: boolean, done: boolean): string {
  const bg     = done ? C.green     : active ? C.blue     : C.surface2
  const border = done ? C.green     : active ? C.blue     : C.border
  const text   = done ? "#fff"      : active ? "#fff"     : C.muted
  const dot    = done ? "✓"         : active ? "●"        : "○"
  return `
    <td align="center" style="padding:0 4px;">
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="background-color:${bg};border:1px solid ${border};border-radius:8px;padding:8px 14px;white-space:nowrap;">
            <span style="font-size:11px;font-weight:700;color:${text};letter-spacing:0.3px;">${dot} ${label}</span>
          </td>
        </tr>
      </table>
    </td>`
}

/** Horizontal connector between timeline steps */
const connector = `<td style="width:16px;padding-top:2px;"><div style="height:2px;background-color:#2a2b33;border-radius:2px;"></div></td>`

// ── Template params ───────────────────────────────────────────────────────────

export interface OrderEmailParams {
  orderCode:      string
  customerName:   string
  totalCards:     number
  deckName?:      string
  deliveryMethod: "pickup" | "shipping"
  address?:       string
}

export interface ShippedEmailParams extends OrderEmailParams {
  trackingCode: string
  carrier?:     string
}

export interface PickupReadyEmailParams extends OrderEmailParams {
  pickupReadyAt:    string   // ISO date
  pickupLocation?:  string   // address / place name
  pickupHours?:     string   // e.g. "Lun–Vie 10–18 h"
  daysToPickup?:    number   // default 8
}

// ── 1. Confirmación de compra ─────────────────────────────────────────────────

export function orderConfirmationEmail(p: OrderEmailParams): { subject: string; html: string; text: string } {
  const subject = `Tu pedido ${p.orderCode} fue recibido · Proxie.cards`

  const timeline = `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
      <tr>
        ${timelineStep("Recibido", true, false)}
        ${connector}
        ${timelineStep("Impreso", false, false)}
        ${connector}
        ${(p.deliveryMethod === "shipping"
          ? timelineStep("Enviado", false, false)
          : timelineStep("Listo", false, false))}
        ${connector}
        ${timelineStep("Entregado", false, false)}
      </tr>
    </table>`

  const content = `
    <!-- Blue top bar -->
    <div style="height:4px;background:linear-gradient(90deg,${C.blue},${C.blueLight});"></div>

    <div style="padding:36px 40px 32px;">
      <!-- Icon + heading -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 24px;text-align:center;">
        <tr>
          <td align="center">
            <div style="width:56px;height:56px;background-color:${C.blueMuted};border:1px solid ${C.blue}40;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;line-height:56px;text-align:center;">���</div>
          </td>
        </tr>
      </table>
      <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:${C.foreground};text-align:center;letter-spacing:-0.5px;">Pedido recibido</h1>
      <p style="margin:0 0 32px;font-size:15px;color:${C.muted};text-align:center;line-height:1.6;">Hola <strong style="color:${C.foreground};">${p.customerName}</strong>, ya tenemos tu pedido y estamos procesándolo.</p>

      <!-- Timeline -->
      <div style="margin-bottom:32px;">${timeline}</div>

      <!-- Order summary card -->
      <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background-color:${C.surface2};border:1px solid ${C.border};border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid ${C.border};">
            <p style="margin:0;font-size:11px;font-weight:700;color:${C.muted};letter-spacing:1px;text-transform:uppercase;">Resumen del pedido</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
              <tr>
                <td style="font-size:13px;color:${C.muted};padding-bottom:10px;">Código de pedido</td>
                <td align="right" style="font-size:13px;font-weight:700;color:${C.blue};font-family:monospace;padding-bottom:10px;">${p.orderCode}</td>
              </tr>
              ${p.deckName ? `
              <tr>
                <td style="font-size:13px;color:${C.muted};padding-bottom:10px;">Mazo</td>
                <td align="right" style="font-size:13px;font-weight:600;color:${C.foreground};padding-bottom:10px;">${p.deckName}</td>
              </tr>` : ""}
              <tr>
                <td style="font-size:13px;color:${C.muted};padding-bottom:10px;">Cantidad de cartas</td>
                <td align="right" style="font-size:13px;font-weight:700;color:${C.foreground};padding-bottom:10px;">${p.totalCards} cartas</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:${C.muted};">Entrega</td>
                <td align="right" style="font-size:13px;font-weight:600;color:${C.foreground};">${p.deliveryMethod === "shipping" ? "Envio a domicilio" : "Retiro en punto de retiro"}</td>
              </tr>
              ${p.address ? `
              <tr>
                <td style="font-size:13px;color:${C.muted};padding-top:10px;">Dirección</td>
                <td align="right" style="font-size:13px;color:${C.foreground};padding-top:10px;">${p.address}</td>
              </tr>` : ""}
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
        <tr>
          <td style="background-color:${C.blue};border-radius:10px;padding:14px 32px;">
            <a href="${ORDERS_URL}?code=${p.orderCode}" style="font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;display:block;white-space:nowrap;">Seguir mi pedido &rarr;</a>
          </td>
        </tr>
      </table>
    </div>`

  const text = `
Hola ${p.customerName},

Tu pedido ${p.orderCode} fue recibido en Proxie.cards.

Cartas: ${p.totalCards}
Entrega: ${p.deliveryMethod === "shipping" ? "Envio a domicilio" : "Retiro en punto de retiro"}
${p.address ? `Direccion: ${p.address}` : ""}

Seguilo en: ${ORDERS_URL}?code=${p.orderCode}

Proxie.cards · ${FOOTER_ADDRESS}`.trim()

  return { subject, html: base(content, `Tu pedido ${p.orderCode} — ${p.totalCards} cartas. Ya lo estamos procesando.`), text }
}

// ── 2. Pedido enviado (con código de seguimiento) ────────────────────────────

export function orderShippedEmail(p: ShippedEmailParams): { subject: string; html: string; text: string } {
  const subject = `Tu pedido ${p.orderCode} está en camino · Proxie.cards`

  const timeline = `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
      <tr>
        ${timelineStep("Recibido", false, true)}
        ${connector}
        ${timelineStep("Impreso", false, true)}
        ${connector}
        ${timelineStep("Enviado", true, false)}
        ${connector}
        ${timelineStep("Entregado", false, false)}
      </tr>
    </table>`

  const content = `
    <div style="height:4px;background:linear-gradient(90deg,${C.green},#4ade80);"></div>

    <div style="padding:36px 40px 32px;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 24px;text-align:center;">
        <tr>
          <td align="center">
            <div style="width:56px;height:56px;background-color:${C.greenMuted};border:1px solid ${C.green}40;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;line-height:56px;text-align:center;">🚚</div>
          </td>
        </tr>
      </table>
      <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:${C.foreground};text-align:center;letter-spacing:-0.5px;">Tu pedido está en camino</h1>
      <p style="margin:0 0 32px;font-size:15px;color:${C.muted};text-align:center;line-height:1.6;">Hola <strong style="color:${C.foreground};">${p.customerName}</strong>, tu pedido acaba de ser despachado.</p>

      <div style="margin-bottom:32px;">${timeline}</div>

      <!-- Tracking highlight -->
      <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background-color:${C.greenMuted};border:1px solid ${C.green}40;border-radius:12px;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${C.green};letter-spacing:1px;text-transform:uppercase;">Código de seguimiento</p>
            <p style="margin:0 0 12px;font-size:22px;font-weight:800;color:${C.foreground};font-family:monospace;letter-spacing:2px;">${p.trackingCode}</p>
            <p style="margin:0;font-size:12px;color:${C.muted};">${p.carrier ? `Operador: ${p.carrier} · ` : ""}Usá este código para rastrear tu envío en el sitio del correo.</p>
          </td>
        </tr>
      </table>

      <!-- Summary -->
      <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background-color:${C.surface2};border:1px solid ${C.border};border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 24px;border-bottom:1px solid ${C.border};">
            <p style="margin:0;font-size:11px;font-weight:700;color:${C.muted};letter-spacing:1px;text-transform:uppercase;">Detalle del envío</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
              <tr>
                <td style="font-size:13px;color:${C.muted};padding-bottom:8px;">Pedido</td>
                <td align="right" style="font-size:13px;font-weight:700;color:${C.blue};font-family:monospace;padding-bottom:8px;">${p.orderCode}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:${C.muted};padding-bottom:8px;">Cartas</td>
                <td align="right" style="font-size:13px;font-weight:700;color:${C.foreground};padding-bottom:8px;">${p.totalCards}</td>
              </tr>
              ${p.address ? `
              <tr>
                <td style="font-size:13px;color:${C.muted};">Destino</td>
                <td align="right" style="font-size:13px;color:${C.foreground};">${p.address}</td>
              </tr>` : ""}
            </table>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
        <tr>
          <td style="background-color:${C.blue};border-radius:10px;padding:14px 32px;">
            <a href="${ORDERS_URL}?code=${p.orderCode}" style="font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;display:block;white-space:nowrap;">Ver estado del pedido &rarr;</a>
          </td>
        </tr>
      </table>
    </div>`

  const text = `
Hola ${p.customerName},

Tu pedido ${p.orderCode} ya fue despachado.

Codigo de seguimiento: ${p.trackingCode}
${p.carrier ? `Operador: ${p.carrier}` : ""}
${p.address ? `Direccion de entrega: ${p.address}` : ""}

Seguilo en: ${ORDERS_URL}?code=${p.orderCode}

Proxie.cards · ${FOOTER_ADDRESS}`.trim()

  return { subject, html: base(content, `Tu pedido ${p.orderCode} ya fue enviado. Código de seguimiento: ${p.trackingCode}.`), text }
}

// ── 3. Listo para retirar ─────────────────────────────────────────────────────

export function orderPickupReadyEmail(p: PickupReadyEmailParams): { subject: string; html: string; text: string } {
  const subject = `Tu pedido ${p.orderCode} está listo para retirar · Proxie.cards`

  const days        = p.daysToPickup ?? 8
  const readyDate   = new Date(p.pickupReadyAt)
  const expiryDate  = new Date(readyDate.getTime() + days * 86400_000)
  const expiryStr   = expiryDate.toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const location = p.pickupLocation ?? "[DIRECCIÓN DEL PUNTO DE RETIRO]"
  const hours    = p.pickupHours    ?? "[HORARIOS DE ATENCIÓN]"

  const timeline = `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
      <tr>
        ${timelineStep("Recibido", false, true)}
        ${connector}
        ${timelineStep("Impreso", false, true)}
        ${connector}
        ${timelineStep("Listo", true, false)}
        ${connector}
        ${timelineStep("Entregado", false, false)}
      </tr>
    </table>`

  const content = `
    <div style="height:4px;background:linear-gradient(90deg,${C.amber},#fcd34d);"></div>

    <div style="padding:36px 40px 32px;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 24px;text-align:center;">
        <tr>
          <td align="center">
            <div style="width:56px;height:56px;background-color:${C.amberMuted};border:1px solid ${C.amber}40;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;line-height:56px;text-align:center;">✅</div>
          </td>
        </tr>
      </table>
      <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:${C.foreground};text-align:center;letter-spacing:-0.5px;">Listo para retirar</h1>
      <p style="margin:0 0 32px;font-size:15px;color:${C.muted};text-align:center;line-height:1.6;">Hola <strong style="color:${C.foreground};">${p.customerName}</strong>, tus cartas ya están disponibles en el punto de retiro.</p>

      <div style="margin-bottom:32px;">${timeline}</div>

      <!-- Pickup info card -->
      <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background-color:${C.amberMuted};border:1px solid ${C.amber}40;border-radius:12px;margin-bottom:16px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${C.amber};letter-spacing:1px;text-transform:uppercase;">Punto de retiro</p>
            <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:${C.foreground};">${location}</p>
            <p style="margin:0;font-size:13px;color:${C.muted};">${hours}</p>
          </td>
        </tr>
      </table>

      <!-- Expiry warning -->
      <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background-color:${C.surface2};border:1px solid ${C.border};border-radius:12px;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
              <tr>
                <td style="font-size:13px;color:${C.muted};padding-bottom:8px;">Pedido</td>
                <td align="right" style="font-size:13px;font-weight:700;color:${C.blue};font-family:monospace;padding-bottom:8px;">${p.orderCode}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:${C.muted};padding-bottom:8px;">Cartas</td>
                <td align="right" style="font-size:13px;font-weight:700;color:${C.foreground};padding-bottom:8px;">${p.totalCards}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:${C.muted};">Retiro hasta</td>
                <td align="right" style="font-size:13px;font-weight:700;color:${C.amber};">${expiryStr}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 24px;font-size:13px;color:${C.muted};text-align:center;line-height:1.6;">
        Por favor retirá tu pedido antes del <strong style="color:${C.foreground};">${expiryStr}</strong>. Pasada esa fecha, el pedido puede ser liberado.
      </p>

      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
        <tr>
          <td style="background-color:${C.blue};border-radius:10px;padding:14px 32px;">
            <a href="${ORDERS_URL}?code=${p.orderCode}" style="font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;display:block;white-space:nowrap;">Ver mi pedido &rarr;</a>
          </td>
        </tr>
      </table>
    </div>`

  const text = `
Hola ${p.customerName},

Tu pedido ${p.orderCode} (${p.totalCards} cartas) ya esta disponible para retirar.

Punto de retiro: ${location}
Horarios: ${hours}

Retira antes del: ${expiryStr}

Ver pedido: ${ORDERS_URL}?code=${p.orderCode}

Proxie.cards · ${FOOTER_ADDRESS}`.trim()

  return { subject, html: base(content, `Tus cartas están listas. Retiralas antes del ${expiryStr}.`), text }
}
