/**
 * lib/pricing.ts
 *
 * Central pricing logic. Tiers are loaded from Supabase so they can be
 * edited via the admin panel without a redeploy.
 *
 * Tier rules:
 *  - Each tier defines a price for a range [min_cards, max_cards].
 *  - If max_cards is null it means "this tier and above" (open-ended).
 *  - For a cart total that falls BETWEEN tiers, we find the tier whose
 *    min_cards is ≤ cartTotal and use that tier's unit price
 *    (total_price / min_cards) applied to the actual card count.
 *  - For a cart total above the largest tier we extrapolate using the
 *    unit price of the highest tier.
 */

export interface PriceTier {
  id: string
  min_cards: number
  max_cards: number | null
  total_price: number   // ARS for exactly min_cards cards
  label: string | null
  is_active: boolean
  sort_order: number
}

/**
 * Minimum total cards required for a purchase.
 * Applies to the ENTIRE order, not per-deck.
 * e.g. 9 singles + 75 commander = 84 total → allowed.
 */
export const MIN_ORDER_CARDS = 30

/**
 * Given a sorted (ascending by min_cards) list of active tiers and a
 * card count, returns the total price in ARS.
 *
 * Returns 0 if cardCount <= 0 or no tiers are available.
 */
export function calcPrice(tiers: PriceTier[], cardCount: number): number {
  if (cardCount <= 0 || tiers.length === 0) return 0

  const sorted = [...tiers].sort((a, b) => a.min_cards - b.min_cards)

  // Find the best tier: largest whose min_cards <= cardCount
  let ref: PriceTier | undefined
  for (const tier of sorted) {
    if (tier.min_cards <= cardCount) ref = tier
  }

  // If cardCount is below the smallest tier, use the smallest tier
  if (!ref) ref = sorted[0]

  // Unit price of the reference tier
  const unitPrice = ref.total_price / ref.min_cards

  return Math.round(unitPrice * cardCount)
}

/**
 * Returns info about the next cheaper bracket above the current card count,
 * or null if the user is already at the best (highest) tier.
 *
 * Example: 75 cards → { cardsNeeded: 25, nextUnitPrice: 375, nextMin: 100 }
 */
export function getNextBracket(
  tiers: PriceTier[],
  cardCount: number
): { cardsNeeded: number; nextUnitPrice: number; nextMin: number } | null {
  const sorted = [...tiers]
    .filter(t => t.is_active)
    .sort((a, b) => a.min_cards - b.min_cards)

  // Find the tier the user is currently in
  let currentTier: PriceTier | undefined
  for (const t of sorted) {
    if (t.min_cards <= cardCount) currentTier = t
  }

  // Find the next tier above
  const nextTier = sorted.find(t => t.min_cards > (currentTier?.min_cards ?? 0))
  if (!nextTier) return null // already at highest tier

  const cardsNeeded  = nextTier.min_cards - cardCount
  const nextUnitPrice = Math.round(nextTier.total_price / nextTier.min_cards)

  return { cardsNeeded, nextUnitPrice, nextMin: nextTier.min_cards }
}

/**
 * Returns the unit price (per card) for a given card count.
 */
export function calcUnitPrice(tiers: PriceTier[], cardCount: number): number {
  if (cardCount <= 0 || tiers.length === 0) return 0
  const total = calcPrice(tiers, cardCount)
  return Math.round(total / cardCount)
}

/**
 * Formats an ARS amount as "$ 16.700"
 */
export function formatARS(amount: number): string {
  return `$ ${amount.toLocaleString("es-AR")}`
}

// ─── Fallback tiers used when the DB is unavailable ───────────────────────────
export const FALLBACK_TIERS: PriceTier[] = [
  { id: "fallback-1", min_cards: 30,  max_cards: 59,  total_price: 16700, label: null,           is_active: true, sort_order: 1 },
  { id: "fallback-2", min_cards: 60,  max_cards: 99,  total_price: 29000, label: "Popular",       is_active: true, sort_order: 2 },
  { id: "fallback-3", min_cards: 100, max_cards: null, total_price: 37500, label: "Mejor precio", is_active: true, sort_order: 3 },
]
