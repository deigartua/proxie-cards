import type { ScryfallCard, GameFormatConfig } from "@/types/scryfall"

/** True only when the format allows exactly 1 copy of each card (e.g. Commander). */
export function isSingletonFormat(cfg?: GameFormatConfig): boolean {
  return (cfg?.maxCopies ?? Infinity) === 1
}

/** Basic lands (Plains, Island, Swamp, Mountain, Forest, Wastes and variants). */
export function isBasicLand(card: ScryfallCard): boolean {
  const typeLine = (card.type_line ?? "").toLowerCase()
  return typeLine.includes("basic") && typeLine.includes("land")
}

/** Any land card (basic or nonbasic). */
export function isLand(card: ScryfallCard): boolean {
  return (card.type_line ?? "").toLowerCase().includes("land")
}

/**
 * Cards exempt from singleton restrictions: basic lands everywhere, any land in
 * Commander, and user-uploaded custom cards (no real Scryfall identity to dedupe).
 */
export function isSingletonExempt(card: ScryfallCard, isCommanderFormat = false): boolean {
  if (card.isCustomUpload) return true
  return isBasicLand(card) || (isCommanderFormat && isLand(card))
}

/**
 * True if a card is legally allowed to be a Commander: a Legendary Creature,
 * or any card whose text explicitly grants it ("... can be your commander" —
 * Backgrounds, some Planeswalkers/Sagas). Checked across both the front face
 * and, for double-faced cards, each card_face (the ability can live on either
 * face, e.g. many Legendary creature // Legendary planeswalker transformations).
 */
export function isEligibleCommander(card: ScryfallCard): boolean {
  const faces = card.card_faces?.length ? card.card_faces : [card]
  return faces.some(face => {
    const typeLine = (face.type_line ?? card.type_line ?? "").toLowerCase()
    const oracleText = (face.oracle_text ?? card.oracle_text ?? "").toLowerCase()
    const isLegendaryCreature = typeLine.includes("legendary") && typeLine.includes("creature")
    const grantsCommander = oracleText.includes("can be your commander")
    return isLegendaryCreature || grantsCommander
  })
}

/**
 * Human-readable reason a card can't be marked as this deck's Commander, or
 * null if it's eligible. Purely about Commander eligibility (legendary
 * creature / "can be your commander" text) — not format legality.
 */
export function getCommanderIneligibleReason(card: ScryfallCard): string | null {
  if (isEligibleCommander(card)) return null
  return `"${card.name}" no puede ser el comandante — debe ser una criatura legendaria o una carta que indique "puede ser tu comandante".`
}

/**
 * Human-readable reason a card breaks the active format's rules, or null if it
 * doesn't. Used to power the non-blocking warning UI (borders, badges, and the
 * "Agregar igual" confirmation popup) — never used to actually prevent an action.
 */
export function getRuleViolationReason(
  card: ScryfallCard,
  formatConfig: GameFormatConfig | undefined,
  opts: { alreadyInDeck?: boolean; isCommanderFormat?: boolean } = {},
): string | null {
  if (!formatConfig) return null
  const formatLabel = formatConfig.label ?? formatConfig.key

  const legalityKey = formatConfig.legalityKey
  if (legalityKey) {
    const status = card.legalities?.[legalityKey]
    if (status !== undefined && status !== "legal") {
      if (status === "banned") return `"${card.name}" está banneada en ${formatLabel}.`
      if (status === "restricted") return `"${card.name}" está restringida en ${formatLabel} (máximo 1 copia).`
      return `"${card.name}" no es legal en el formato ${formatLabel}.`
    }
  }

  const maxCopies = formatConfig.maxCopies ?? Infinity
  if (opts.alreadyInDeck && maxCopies < 99 && !isSingletonExempt(card, opts.isCommanderFormat)) {
    if (maxCopies === 1) {
      return `${formatLabel} es singleton — sólo se permite 1 copia de "${card.name}".`
    }
    return `${formatLabel} permite hasta ${maxCopies} copias de "${card.name}".`
  }

  return null
}
