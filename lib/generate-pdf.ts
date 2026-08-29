import type { PrintListEntry, ScryfallCard } from "@/types/scryfall"

// ── Double-faced card helpers ─────────────────────────────────────────────────

/**
 * Returns true when a card has two independent printable faces (transform,
 * modal_dfc, reversible_card, double_faced_token, etc.).
 * We require both faces to have their own image_uris.
 */
export function isDoubleFacedCard(card: ScryfallCard): boolean {
  return (
    Array.isArray(card.card_faces) &&
    card.card_faces.length >= 2 &&
    !!(card.card_faces[0]?.image_uris) &&
    !!(card.card_faces[1]?.image_uris)
  )
}

/** Returns true when any entry in the list contains a double-faced card. */
export function hasDoubleFacedCards(entries: PrintListEntry[]): boolean {
  return entries.some(e => isDoubleFacedCard(e.selectedPrint ?? e.card))
}

/** Count of individual card slots that are double-faced (quantity × 2 faces). */
export function countDoubleFacedCards(entries: PrintListEntry[]): number {
  return entries
    .filter(e => isDoubleFacedCard(e.selectedPrint ?? e.card))
    .reduce((s, e) => s + e.quantity, 0)
}

// ── Card & page dimensions (mm) ───────────────────────────────────────────────

const CARD_W_MM = 63
const CARD_H_MM = 88

// A4 landscape for the 8-card layout
const PAGE_W_MM = 297
const PAGE_H_MM = 210

// Cricut registration area — exact dimensions the SVG represents
const CRICUT_W_MM = 287.06
const CRICUT_H_MM = 202.99

// 8-card grid: 4 cols × 2 rows
const COLS = 4
const ROWS = 2

// Resolution — 600 DPI for Cricut / cutter-ready output (ZIP/PNG)
const PRINT_DPI = 600
// Lower DPI for the PDF export — 300 is print-quality and avoids canvas memory crashes
const PDF_DPI = 300

// Each card gets a 2 mm black bleed border on every side.
// The cell size is therefore 63+4=67 mm wide and 88+4=92 mm tall.
// Cells are placed edge-to-edge with NO overlap.
const BLEED_MM  = 2        // bleed on every side of every card
const CELL_W_MM = CARD_W_MM + BLEED_MM * 2   // 67 mm
const CELL_H_MM = CARD_H_MM + BLEED_MM * 2   // 92 mm

/** Maximum mirror-bleed in mm (the production default). */
export const BLEED_MM_MAX = BLEED_MM

// ── Guillotine layout (3×3, traditional paper cutter) ────────────────────────
// A4 PORTRAIT is used here (not landscape) because a 3×3 grid of upright cards
// (63×88 mm each) is taller than it is wide — 189×264 mm — which fits a
// 210×297 mm portrait sheet far better than a landscape one.

const GUILLOTINE_PAGE_W_MM = 210
const GUILLOTINE_PAGE_H_MM = 297

const GUILLOTINE_COLS = 3
const GUILLOTINE_ROWS = 3

// Cards sit edge-to-edge — no bleed, no gap — to maximise cards per sheet
const GUILLOTINE_CELL_W_MM = CARD_W_MM
const GUILLOTINE_CELL_H_MM = CARD_H_MM

// Solid black background sitting BEHIND the whole grid (drawn before the
// cards, never on top of them) — it only shows through in the thin sub-pixel
// seams between cards and along a slightly imprecise outer cut, so the sheet
// never reveals a white sliver. It bleeds a bit past the grid's outer edge
// (in place of a drawn border) for the same reason.
const GUILLOTINE_BG_BLEED_MM = 1.5

// Cut-guide lines: thin and plain — they sit UNDER the black background, so
// they are only visible in the sheet's white margins (outside the grid),
// used to align a guillotine against the sheet's edge.
const GUILLOTINE_LINE_MM = 0.12

// Corner alignment marks: a small white "+" at every card corner (i.e. every
// grid line intersection), drawn on top of everything. A thin black keyline
// behind the white cross keeps it visible even over light/white card borders.
const GUILLOTINE_MARK_ARM_MM       = 1.8
const GUILLOTINE_MARK_THICKNESS_MM = 0.22
const GUILLOTINE_MARK_OUTLINE_MM   = 0.5

// ── Layout type (kept as a union for future extensibility) ───────────────────

export type PdfLayout = "8-landscape" | "9-guillotine"

// ── Image helpers ─────────────────────────────────────────────────────────────

function getCardImageUrls(card: ScryfallCard): string[] {
  if (Array.isArray(card.card_faces) && card.card_faces.length >= 2) {
    const urls: string[] = []
    for (const face of card.card_faces.slice(0, 2)) {
      const u = face.image_uris?.png ?? face.image_uris?.large ?? face.image_uris?.normal
      if (u) urls.push(u)
    }
    if (urls.length > 0) return urls
  }
  // Single-faced — PNG first (lossless, 745×1040), then large JPEG, then normal
  if (card.image_uris?.png)    return [card.image_uris.png]
  if (card.image_uris?.large)  return [card.image_uris.large]
  if (card.image_uris?.normal) return [card.image_uris.normal]
  return []
}

function resolveCard(entry: PrintListEntry): ScryfallCard {
  return entry.selectedPrint ?? entry.card
}

// ── Image loading via same-origin proxy ───────────────────────────────────────

async function loadImageFromUrl(url: string, proxyBase = ""): Promise<HTMLImageElement> {
  const proxied = `${proxyBase}/api/proxy-image?url=${encodeURIComponent(url)}`
  const res = await fetch(proxied)
  if (!res.ok) throw new Error(`Proxy ${res.status} for ${url}`)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(objectUrl); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`Failed to decode: ${url}`)) }
    img.src = objectUrl
  })
}

async function loadImage(url: string, proxyBase = ""): Promise<HTMLImageElement> {
  try {
    return await loadImageFromUrl(url, proxyBase)
  } catch (primaryErr) {
    // If the URL looks like a PNG variant, fall back to the large JPEG variant
    if (url.includes("/png/") || url.endsWith(".png")) {
      const fallbackUrl = url
        .replace(/\/png\//, "/large/")
        .replace(/\.png(\?.*)?$/, ".jpg$1")
      try {
        return await loadImageFromUrl(fallbackUrl, proxyBase)
      } catch {
        // both failed — re-throw the original error
        throw primaryErr
      }
    }
    throw primaryErr
  }
}

// ── Slot building ─────────────────────────────────────────────────────────────

interface Slot {
  url: string
  label: string
  /** Present only for double-faced card slots: "LADO A" | "LADO B" */
  sideLabel?: "LADO A" | "LADO B"
}

/**
 * Builds print slots from entries.
 * @param skipDfc  When true, double-faced card entries are excluded so they
 *                 can be sent to the separate DFC document.
 */
function buildSlots(entries: PrintListEntry[], skipDfc = false): Slot[] {
  const slots: Slot[] = []
  for (const entry of entries) {
    const card = resolveCard(entry)
    if (skipDfc && isDoubleFacedCard(card)) continue
    const urls = getCardImageUrls(card)
    for (let q = 0; q < entry.quantity; q++) {
      for (const url of urls) {
        slots.push({ url, label: entry.card.name })
      }
    }
  }
  return slots
}

/**
 * Builds labeled A/B slots for double-faced cards only.
 * Each copy of a DFC produces two adjacent slots: Lado A then Lado B.
 * The pairs are placed sequentially so the 8-card grid reads:
 *   [1A][1B][2A][2B]   ← row 1 (4 double cards)
 *   [3A][3B][4A][4B]   ← row 2
 */
function buildDoubleFacedSlots(entries: PrintListEntry[]): Slot[] {
  const slots: Slot[] = []
  for (const entry of entries) {
    const card = resolveCard(entry)
    if (!isDoubleFacedCard(card)) continue
    const faceA = card.card_faces![0]!
    const faceB = card.card_faces![1]!
    const urlA = faceA.image_uris?.png ?? faceA.image_uris?.large ?? faceA.image_uris?.normal ?? ""
    const urlB = faceB.image_uris?.png ?? faceB.image_uris?.large ?? faceB.image_uris?.normal ?? ""
    const cardName = entry.card.name
    for (let q = 0; q < entry.quantity; q++) {
      if (urlA) slots.push({ url: urlA, label: cardName, sideLabel: "LADO A" })
      if (urlB) slots.push({ url: urlB, label: cardName, sideLabel: "LADO B" })
    }
  }
  return slots
}

// ── Mirror bleed ──────────────────────────────────────────────────────────────

/**
 * Draws a card image with a mirrored bleed border into the destination canvas.
 *
 * Each of the 4 bleed strips is filled by reflecting the outermost pixels of
 * the card back onto itself — so a blue sky at the top becomes a mirrored blue
 * sky in the top bleed, a dark character at the bottom becomes a dark mirror,
 * etc. The four corners sample from the nearest corner pixel to avoid seams.
 *
 * @param ctx      - destination canvas context
 * @param img      - loaded card image
 * @param cellX    - x of the cell top-left (bleed origin)
 * @param cellY    - y of the cell top-left
 * @param cardWPx  - card width in px (63 mm at PRINT_DPI)
 * @param cardHPx  - card height in px (88 mm at PRINT_DPI)
 * @param bleedPx  - bleed thickness in px (2 mm at PRINT_DPI)
 */
function drawMirrorBleed(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cellX: number,
  cellY: number,
  cardWPx: number,
  cardHPx: number,
  bleedPx: number,
): void {
  const imgX = cellX + bleedPx   // card image origin X
  const imgY = cellY + bleedPx   // card image origin Y

  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // ── 1. Draw the card itself ─────────────────────────────────────────────────
  ctx.drawImage(img, imgX, imgY, cardWPx, cardHPx)

  // ── 2. TOP bleed — reflect a bleedPx-tall strip from the top edge of the card
  //    Source: top bleedPx rows of the card (in image coords: top bleedPx / cardHPx fraction)
  //    Dest:   strip above the card, flipped vertically
  ctx.save()
  // Translate to the bottom of the top-bleed area, then flip Y
  ctx.translate(imgX, imgY)
  ctx.scale(1, -1)
  // Draw just the top bleedPx rows of the card image into the bleed zone
  // drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
  const srcTopH = (bleedPx / cardHPx) * img.naturalHeight
  ctx.drawImage(
    img,
    0, 0, img.naturalWidth, srcTopH,   // source: top slice
    0, 0, cardWPx, bleedPx,            // dest: bleedPx tall, flipped up
  )
  ctx.restore()

  // ── 3. BOTTOM bleed — reflect a bleedPx-tall strip from the bottom edge
  ctx.save()
  ctx.translate(imgX, imgY + cardHPx + bleedPx)
  ctx.scale(1, -1)
  const srcBotH = (bleedPx / cardHPx) * img.naturalHeight
  const srcBotY = img.naturalHeight - srcBotH
  ctx.drawImage(
    img,
    0, srcBotY, img.naturalWidth, srcBotH,  // source: bottom slice
    0, 0, cardWPx, bleedPx,                 // dest: bleedPx tall, flipped down
  )
  ctx.restore()

  // ── 4. LEFT bleed — reflect a bleedPx-wide strip from the left edge
  ctx.save()
  ctx.translate(imgX, imgY)
  ctx.scale(-1, 1)
  const srcLeftW = (bleedPx / cardWPx) * img.naturalWidth
  ctx.drawImage(
    img,
    0, 0, srcLeftW, img.naturalHeight,  // source: left slice
    0, 0, bleedPx, cardHPx,             // dest: bleedPx wide, flipped left
  )
  ctx.restore()

  // ── 5. RIGHT bleed — reflect a bleedPx-wide strip from the right edge
  ctx.save()
  ctx.translate(imgX + cardWPx + bleedPx, imgY)
  ctx.scale(-1, 1)
  const srcRightW = (bleedPx / cardWPx) * img.naturalWidth
  const srcRightX = img.naturalWidth - srcRightW
  ctx.drawImage(
    img,
    srcRightX, 0, srcRightW, img.naturalHeight,  // source: right slice
    0, 0, bleedPx, cardHPx,                       // dest: bleedPx wide, flipped right
  )
  ctx.restore()

  // ── 6. CORNERS — fill each corner with the nearest edge pixel color
  //    (avoids seams at the 4 corners where strips don't overlap cleanly)
  //    We do this by scaling a single-pixel corner sample to the corner area.
  const corners = [
    // [srcX, srcY, srcW, srcH, dstX, dstY]  (all in image/canvas natural coords)
    { sx: 0,                          sy: 0,                           dx: cellX,             dy: cellY             },
    { sx: img.naturalWidth - 1,       sy: 0,                           dx: cellX + bleedPx + cardWPx, dy: cellY     },
    { sx: 0,                          sy: img.naturalHeight - 1,       dx: cellX,             dy: cellY + bleedPx + cardHPx },
    { sx: img.naturalWidth - 1,       sy: img.naturalHeight - 1,       dx: cellX + bleedPx + cardWPx, dy: cellY + bleedPx + cardHPx },
  ]
  for (const c of corners) {
    ctx.drawImage(img, c.sx, c.sy, 1, 1, c.dx, c.dy, bleedPx, bleedPx)
  }

  ctx.restore()
}

// ── Cricut registration marks ─────────────────────────────────────────────────

/** Cache the loaded SVG image so it is only fetched once across all pages. */
let _cricutSvgImage: HTMLImageElement | null = null

/**
 * Loads /cricut-marks.svg exactly once and draws it onto the canvas context.
 *
 * Normal mode: scaled to CRICUT_W_MM × CRICUT_H_MM and centered on the page.
 * Centered test mode (cricutCenteredMode=true): forced to exactly 27 cm wide,
 * height derived from the SVG's original aspect ratio (6781 × 4795), centered
 * both horizontally and vertically. Useful for plotter calibration tests.
 */
async function drawCricutMarks(
  ctx: CanvasRenderingContext2D,
  pageWPx: number,
  pageHPx: number,
  mmToPx: (v: number) => number,
  cricutCenteredMode = false,
): Promise<void> {
  // Load the SVG once — failure is non-fatal (skip marks if SVG unavailable)
  if (!_cricutSvgImage) {
    try {
      _cricutSvgImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload  = () => resolve(img)
        img.onerror = () => reject(new Error("Failed to load cricut-marks.svg"))
        // Try absolute path first; fall back to origin-relative for iframes
        const origin = typeof window !== "undefined" ? window.location.origin : ""
        img.src = `${origin}/cricut-marks.svg`
      })
    } catch {
      // SVG not available — continue without registration marks
      return
    }
  }

  if (!_cricutSvgImage) return

  let drawW: number
  let drawH: number

  if (cricutCenteredMode) {
    // Fixed calibration dimensions — 27 cm × 19.4 cm (not proportional to SVG)
    drawW = mmToPx(270)
    drawH = mmToPx(194)
  } else {
    drawW = mmToPx(CRICUT_W_MM)
    drawH = mmToPx(CRICUT_H_MM)
  }

  const drawX = Math.round((pageWPx - drawW) / 2)
  const drawY = Math.round((pageHPx - drawH) / 2)

  ctx.save()
  ctx.drawImage(_cricutSvgImage, drawX, drawY, drawW, drawH)
  ctx.restore()
}

// ── Core renderer ─────────────────────────────────────────────────────────────

interface RenderedPage { canvas: HTMLCanvasElement }

async function renderPages(
  slots: Slot[],
  onProgress?: (loaded: number, total: number) => void,
  proxyBase = "",
  dpi = PRINT_DPI,
  bleedMm = BLEED_MM,
  cricutCenteredMode = false,
  cardOffsetXMm = 0,
): Promise<RenderedPage[]> {

  // Load all images sequentially (proxy requires same-origin fetch)
  const images: (HTMLImageElement | null)[] = []
  for (let i = 0; i < slots.length; i++) {
    try {
      images.push(await loadImage(slots[i].url, proxyBase))
    } catch {
      images.push(null)
    }
    onProgress?.(i + 1, slots.length)
  }

  // mm → px at given DPI
  const mm = (v: number) => Math.round((v / 25.4) * dpi)

  const pageWPx  = mm(PAGE_W_MM)
  const pageHPx  = mm(PAGE_H_MM)
  const cardWPx  = mm(CARD_W_MM)           // 63 mm — the actual card
  const cardHPx  = mm(CARD_H_MM)           // 88 mm
  const bleedPx  = mm(bleedMm)             // configurable bleed (0–2 mm)
  const cellWPx  = mm(CARD_W_MM + bleedMm * 2)  // card + bleed on both sides
  const cellHPx  = mm(CARD_H_MM + bleedMm * 2)

  // Center the 4×2 cell grid on the page, then apply horizontal offset (cards only)
  const gridWPx      = COLS * cellWPx
  const gridHPx      = ROWS * cellHPx
  const offsetXPx    = mm(cardOffsetXMm)
  const marginXPx    = Math.round((pageWPx - gridWPx) / 2) + offsetXPx
  const marginYPx    = Math.round((pageHPx - gridHPx) / 2)

  const cardsPerPage = COLS * ROWS
  const totalPages   = Math.ceil(slots.length / cardsPerPage)
  const pages: RenderedPage[] = []

  for (let page = 0; page < totalPages; page++) {
    const canvas = document.createElement("canvas")
    canvas.width  = pageWPx
    canvas.height = pageHPx
    const ctx = canvas.getContext("2d")!

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, pageWPx, pageHPx)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const slotIndex = page * cardsPerPage + row * COLS + col
        if (slotIndex >= slots.length) break

        // Top-left corner of this cell (cell = bleed + card + bleed)
        const cellX = marginXPx + col * cellWPx
        const cellY = marginYPx + row * cellHPx

        const imgX = cellX + bleedPx
        const imgY = cellY + bleedPx
        const img  = images[slotIndex]

        if (img) {
          // Draw card with mirrored bleed on all 4 sides
          drawMirrorBleed(ctx, img, cellX, cellY, cardWPx, cardHPx, bleedPx)
        } else {
          // Fallback: black cell with placeholder text
          ctx.fillStyle = "#1a1a1a"
          ctx.fillRect(cellX, cellY, cellWPx, cellHPx)
          ctx.fillStyle = "#666666"
          ctx.font = `${mm(3)}px sans-serif`
          ctx.textAlign = "center"
          ctx.fillText("Sin imagen", imgX + cardWPx / 2, imgY + cardHPx / 2)
        }

        // ── Side label overlay (double-faced cards only) ──────────────────
        const { sideLabel, label: cardLabel } = slots[slotIndex]
        if (sideLabel) {
          const labelH   = mm(6)          // 6 mm tall strip
          const labelY   = imgY           // top of the card image
          const labelX   = imgX
          const labelW   = cardWPx
          const fontSize = mm(2.8)

          // Dark translucent background
          ctx.save()
          ctx.globalAlpha = 0.82
          ctx.fillStyle = "#050505"
          ctx.fillRect(labelX, labelY, labelW, labelH)
          ctx.globalAlpha = 1

          // Card name (left-aligned, truncated)
          ctx.font = `bold ${fontSize}px sans-serif`
          ctx.textAlign = "left"
          ctx.fillStyle = "#e5e5e5"
          const maxNameW  = labelW - mm(18)
          const nameText  = cardLabel.length > 22
            ? cardLabel.slice(0, 21) + "…"
            : cardLabel
          ctx.fillText(nameText, labelX + mm(1.2), labelY + labelH * 0.70)

          // Side badge (right-aligned, coloured)
          ctx.font = `bold ${fontSize}px sans-serif`
          ctx.textAlign = "right"
          ctx.fillStyle = sideLabel === "LADO A" ? "#60a5fa" : "#f59e0b"
          ctx.fillText(sideLabel, labelX + labelW - mm(1.2), labelY + labelH * 0.70)

          ctx.restore()

          // Thin separator line below label
          ctx.save()
          ctx.strokeStyle = sideLabel === "LADO A" ? "#3b82f680" : "#f59e0b80"
          ctx.lineWidth = mm(0.3)
          ctx.beginPath()
          ctx.moveTo(labelX, labelY + labelH)
          ctx.lineTo(labelX + labelW, labelY + labelH)
          ctx.stroke()
          ctx.restore()
        }
      }
    }

    // Cricut registration marks — drawn on top of cards using the exact SVG
    await drawCricutMarks(ctx, pageWPx, pageHPx, mm, cricutCenteredMode)

    // Subtle page number
    ctx.fillStyle = "#999999"
    ctx.font = `${mm(2.5)}px sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(`Página ${page + 1} de ${totalPages}`, pageWPx / 2, pageHPx - mm(2))

    pages.push({ canvas })
  }

  return pages
}

/**
 * Renders the "Exportación rápida" guillotine layout: a 3×3 grid of cards
 * placed edge-to-edge (no bleed, no gap) on an A4 portrait sheet — no Cricut
 * marks, since this document is meant for a traditional paper guillotine.
 *
 * Drawing order (bottom → top) matters a lot here:
 *  1. White page background.
 *  2. Full-length cut-guide lines (thin, plain) — drawn early so the next
 *     layer covers them everywhere except the sheet's white margins.
 *  3. A solid black background behind the whole grid (bleeding a touch past
 *     its outer edge) — fills any sub-pixel seam between cards and hides
 *     the cut-guide lines wherever they run under the grid.
 *  4. The card images themselves, edge-to-edge on top of the black background.
 *  5. Small white "+" alignment marks at every card corner, on top of
 *     everything, to help square up the second round of cuts (rows) once
 *     the sheet has already been cut into columns.
 */
async function renderGuillotinePages(
  slots: Slot[],
  onProgress?: (loaded: number, total: number) => void,
  proxyBase = "",
  dpi = PDF_DPI,
): Promise<RenderedPage[]> {

  const images: (HTMLImageElement | null)[] = []
  for (let i = 0; i < slots.length; i++) {
    try {
      images.push(await loadImage(slots[i].url, proxyBase))
    } catch {
      images.push(null)
    }
    onProgress?.(i + 1, slots.length)
  }

  // mm → px at given DPI
  const mm = (v: number) => Math.round((v / 25.4) * dpi)

  const pageWPx   = mm(GUILLOTINE_PAGE_W_MM)
  const pageHPx   = mm(GUILLOTINE_PAGE_H_MM)
  const cellWPx   = mm(GUILLOTINE_CELL_W_MM)
  const cellHPx   = mm(GUILLOTINE_CELL_H_MM)
  const bgBleedPx = Math.max(1, mm(GUILLOTINE_BG_BLEED_MM))
  const lineWPx   = Math.max(1, mm(GUILLOTINE_LINE_MM))
  const markArmPx = Math.max(1, mm(GUILLOTINE_MARK_ARM_MM))
  const markWPx   = Math.max(1, mm(GUILLOTINE_MARK_THICKNESS_MM))
  const markOutWPx = Math.max(markWPx + 1, mm(GUILLOTINE_MARK_OUTLINE_MM))

  const gridWPx   = GUILLOTINE_COLS * cellWPx
  const gridHPx   = GUILLOTINE_ROWS * cellHPx
  const marginXPx = Math.round((pageWPx - gridWPx) / 2)
  const marginYPx = Math.round((pageHPx - gridHPx) / 2)

  const cardsPerPage = GUILLOTINE_COLS * GUILLOTINE_ROWS
  const totalPages    = Math.ceil(slots.length / cardsPerPage)
  const pages: RenderedPage[] = []

  for (let page = 0; page < totalPages; page++) {
    const canvas = document.createElement("canvas")
    canvas.width  = pageWPx
    canvas.height = pageHPx
    const ctx = canvas.getContext("2d")!

    // ── 1. White page background ───────────────────────────────────────────
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, pageWPx, pageHPx)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    // ── 2. Cut-guide lines — thin and plain, full page length. They will be
    //    covered by the black background/cards everywhere except the
    //    sheet's white margins, which is exactly where they're needed to
    //    align a guillotine against the sheet's edge. ──────────────────────
    ctx.save()
    ctx.lineCap = "butt"
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = lineWPx

    for (let i = 0; i <= GUILLOTINE_COLS; i++) {
      const x = marginXPx + i * cellWPx
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, pageHPx); ctx.stroke()
    }
    for (let j = 0; j <= GUILLOTINE_ROWS; j++) {
      const y = marginYPx + j * cellHPx
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pageWPx, y); ctx.stroke()
    }
    ctx.restore()

    // ── 3. Solid black background behind the whole grid, bleeding a touch
    //    past its outer edge — covers the lines above and fills any seam
    //    between cards without ever showing on top of them. ────────────────
    ctx.fillStyle = "#000000"
    ctx.fillRect(
      marginXPx - bgBleedPx,
      marginYPx - bgBleedPx,
      gridWPx + bgBleedPx * 2,
      gridHPx + bgBleedPx * 2,
    )

    // ── 4. Cards, placed edge-to-edge — no bleed, no gap between them ─────
    for (let row = 0; row < GUILLOTINE_ROWS; row++) {
      for (let col = 0; col < GUILLOTINE_COLS; col++) {
        const slotIndex = page * cardsPerPage + row * GUILLOTINE_COLS + col
        if (slotIndex >= slots.length) continue

        const cellX = marginXPx + col * cellWPx
        const cellY = marginYPx + row * cellHPx
        const img   = images[slotIndex]

        if (img) {
          ctx.drawImage(img, cellX, cellY, cellWPx, cellHPx)
        } else {
          ctx.fillStyle = "#1a1a1a"
          ctx.fillRect(cellX, cellY, cellWPx, cellHPx)
          ctx.fillStyle = "#666666"
          ctx.font = `${mm(3)}px sans-serif`
          ctx.textAlign = "center"
          ctx.fillText("Sin imagen", cellX + cellWPx / 2, cellY + cellHPx / 2)
        }
      }
    }

    // ── 5. White "+" alignment marks at every card corner (every grid line
    //    intersection) — drawn last, on top of the cards, so they survive
    //    for the second round of cuts (rows) after the sheet is already cut
    //    into columns. A thin black keyline behind the white cross keeps it
    //    visible even over a light or white card border. ───────────────────
    ctx.save()
    ctx.lineCap = "butt"
    for (let i = 0; i <= GUILLOTINE_COLS; i++) {
      for (let j = 0; j <= GUILLOTINE_ROWS; j++) {
        const x = marginXPx + i * cellWPx
        const y = marginYPx + j * cellHPx

        ctx.beginPath(); ctx.moveTo(x - markArmPx, y); ctx.lineTo(x + markArmPx, y)
        ctx.moveTo(x, y - markArmPx); ctx.lineTo(x, y + markArmPx)
        ctx.strokeStyle = "#000000"; ctx.lineWidth = markOutWPx; ctx.stroke()

        ctx.beginPath(); ctx.moveTo(x - markArmPx, y); ctx.lineTo(x + markArmPx, y)
        ctx.moveTo(x, y - markArmPx); ctx.lineTo(x, y + markArmPx)
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = markWPx; ctx.stroke()
      }
    }
    ctx.restore()

    // Footer note
    ctx.fillStyle = "#999999"
    ctx.font = `${mm(2.5)}px sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(
      `Guias de corte para guillotina tradicional  ·  Pagina ${page + 1} de ${totalPages}`,
      pageWPx / 2,
      pageHPx - mm(4),
    )

    pages.push({ canvas })
  }

  return pages
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GeneratePdfOptions {
  entries: PrintListEntry[]
  layout?: PdfLayout
  onProgress?: (loaded: number, total: number) => void
  /**
   * Mirror-bleed thickness in mm added to each side of every card.
   * Range: 0 (no bleed) – 2 (default, maximum).
   * Defaults to BLEED_MM_MAX (2 mm) when omitted.
   */
  bleedMm?: number
  /**
   * When true, cricut-marks.svg is drawn at exactly 27 cm × 19.4 cm
   * and centred both horizontally and vertically, instead of the production size.
   * Use this to calibrate the plotter without moving the card grid.
   */
  cricutCenteredMode?: boolean
  /**
   * Horizontal offset in mm applied only to the card grid, relative to the
   * Cricut registration marks. Positive = right, negative = left.
   * The Cricut SVG is never moved.
   */
  cardOffsetXMm?: number
}

/** Download as a PDF file */
export async function generatePdf({ entries, onProgress, bleedMm = BLEED_MM, cricutCenteredMode = false, cardOffsetXMm = 0 }: GeneratePdfOptions): Promise<void> {
  const slots = buildSlots(entries, false)
  if (slots.length === 0) return

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const pages = await renderPages(slots, onProgress, origin, PDF_DPI, bleedMm, cricutCenteredMode, cardOffsetXMm)

  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) doc.addPage("a4", "landscape")
    // Use JPEG at high quality (95%) — much smaller than PNG for photo-heavy content,
    // avoids memory crashes on large canvases (7000×5000 px at 600 DPI)
    const dataUrl = pages[i].canvas.toDataURL("image/jpeg", 0.95)
    doc.addImage(dataUrl, "JPEG", 0, 0, PAGE_W_MM, PAGE_H_MM)
  }

  doc.save("mtg-proxies-8h.pdf")
}

// ── ZIP of PNGs ───────────────────────────────────────────────────────────────

export interface GenerateZipOptions extends GeneratePdfOptions {
  /** Used to name the ZIP file: "{clientName}_{date}_{N}cartas.zip" */
  clientName?: string
  /** ISO date string — defaults to today */
  date?: string
}

/**
 * Renders every page as a 600 DPI PNG and bundles them in a ZIP file that
 * is immediately downloaded. The ZIP is named:
 *   {clientName}_{YYYY-MM-DD}_{N}cartas.zip
 *
 * If the order contains double-faced cards (DFC), they are placed in a
 * separate subfolder `doble_cara/` with labeled A/B pages so the printer
 * knows to change paper before printing that section.
 *
 * Folder structure:
 *   normales/pagina_01.png …   ← single-faced cards
 *   doble_cara/pagina_01.png … ← DFC pairs with LADO A / LADO B overlays
 */
export async function generateZip({
  entries,
  onProgress,
  clientName = "cliente",
  date,
  bleedMm = BLEED_MM,
  cricutCenteredMode = false,
  cardOffsetXMm = 0,
}: GenerateZipOptions): Promise<void> {
  const hasDfc = hasDoubleFacedCards(entries)

  const normalSlots = buildSlots(entries, hasDfc /* skipDfc when there are DFCs */)
  const dfcSlots    = hasDfc ? buildDoubleFacedSlots(entries) : []

  if (normalSlots.length === 0 && dfcSlots.length === 0) return

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const JSZip  = (await import("jszip")).default
  const zip    = new JSZip()

  // ── Normal pages ────────────────────────────────────────────────────────────
  if (normalSlots.length > 0) {
    const normalTotal = normalSlots.length + dfcSlots.length
    const normalPages = await renderPages(
      normalSlots,
      (loaded, total) => onProgress?.(loaded, normalTotal),
      origin,
      PRINT_DPI,
      bleedMm,
      cricutCenteredMode,
      cardOffsetXMm,
    )
    const folder = hasDfc ? zip.folder("normales")! : zip
    for (let i = 0; i < normalPages.length; i++) {
      const blob = await new Promise<Blob>((resolve, reject) =>
        normalPages[i].canvas.toBlob(
          b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png",
        ),
      )
      folder.file(`pagina_${String(i + 1).padStart(2, "0")}.png`, blob)
    }
  }

  // ── Double-faced pages ──────────────────────────────────────────────────────
  if (dfcSlots.length > 0) {
    const offset    = normalSlots.length
    const dfcPages  = await renderPages(
      dfcSlots,
      (loaded, total) => onProgress?.(offset + loaded, normalSlots.length + total),
      origin,
      PRINT_DPI,
      bleedMm,
      cricutCenteredMode,
      cardOffsetXMm,
    )
    const dfcFolder = zip.folder("doble_cara")!
    for (let i = 0; i < dfcPages.length; i++) {
      const blob = await new Promise<Blob>((resolve, reject) =>
        dfcPages[i].canvas.toBlob(
          b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png",
        ),
      )
      dfcFolder.file(`pagina_${String(i + 1).padStart(2, "0")}.png`, blob)
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" })

  // Build file name
  const safeClient = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "cliente"

  const dateStr    = (date ? new Date(date) : new Date()).toISOString().slice(0, 10)
  const totalCards = normalSlots.length + dfcSlots.length
  const fileName   = `${safeClient}_${dateStr}_${totalCards}cartas.zip`

  const url = URL.createObjectURL(zipBlob)
  const a   = document.createElement("a")
  a.href     = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 2000)
}

/** Open a print preview in the browser — no download, uses window.print() */
export async function printPdf({ entries, onProgress, bleedMm = BLEED_MM, cricutCenteredMode = false, cardOffsetXMm = 0 }: GeneratePdfOptions): Promise<void> {
  const slots = buildSlots(entries)
  if (slots.length === 0) return

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const pages = await renderPages(slots, onProgress, origin, PRINT_DPI, bleedMm, cricutCenteredMode, cardOffsetXMm)

  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;inset:0;width:0;height:0;border:none;opacity:0;pointer-events:none;"
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument!
  const imgTags = pages
    .map(p => `<img src="${p.canvas.toDataURL("image/png")}" style="display:block;width:${PAGE_W_MM}mm;height:${PAGE_H_MM}mm;page-break-after:always;" />`)
    .join("")

  iframeDoc.open()
  iframeDoc.write(`<!DOCTYPE html><html><head><style>
    @page { size: A4 landscape; margin: 0; }
    body  { margin: 0; padding: 0; background: #fff; }
    img   { display: block; width: ${PAGE_W_MM}mm; height: ${PAGE_H_MM}mm; page-break-after: always; }
  </style></head><body>${imgTags}</body></html>`)
  iframeDoc.close()

  await new Promise(r => setTimeout(r, 400))
  iframe.contentWindow!.focus()
  iframe.contentWindow!.print()

  setTimeout(() => document.body.removeChild(iframe), 5000)
}

// ── "Exportación rápida" — 3×3 guillotine PDF ─────────────────────────────────

export interface GenerateGuillotinePdfOptions {
  entries: PrintListEntry[]
  onProgress?: (loaded: number, total: number) => void
}

/**
 * Downloads a PDF laid out for a traditional paper guillotine instead of a
 * Cricut plotter: a 3×3 grid (9 cards/sheet, A4 portrait) with cards placed
 * edge-to-edge to make the most of the page, a thin black frame around the
 * outer edge of the grid, and full-length cut-guide lines instead of Cricut
 * registration marks.
 */
export async function generateGuillotinePdf({ entries, onProgress }: GenerateGuillotinePdfOptions): Promise<void> {
  const slots = buildSlots(entries, false)
  if (slots.length === 0) return

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const pages = await renderGuillotinePages(slots, onProgress, origin, PDF_DPI)

  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) doc.addPage("a4", "portrait")
    const dataUrl = pages[i].canvas.toDataURL("image/jpeg", 0.95)
    doc.addImage(dataUrl, "JPEG", 0, 0, GUILLOTINE_PAGE_W_MM, GUILLOTINE_PAGE_H_MM)
  }

  doc.save("mtg-proxies-guillotina-9c.pdf")
}
