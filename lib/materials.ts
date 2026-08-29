// ─── Pack sizes ───────────────────────────────────────────────────────────────
export const PACK_SIZES = [30, 60, 100] as const
export type PackSize = (typeof PACK_SIZES)[number]
export type AnyPackSize = PackSize

// ─── Materials ────────────────────────────────────────────────────────────────
// Único material disponible: Satinado 300gr. El precio varía solo por cantidad.
export type MaterialId = "sat300"

export interface PackPrice {
  size: PackSize
  price: number
}

export interface Material {
  id: MaterialId
  name: string
  subtitle: string
  description: string
  specs: string[]
  doubleSided: boolean
  packPrices: PackPrice[]
}

export const MATERIALS: Material[] = [
  {
    id: "sat300",
    name: "Satinado 300 gr",
    subtitle: "Doble faz · Alta resolución",
    description:
      "Papel satinado de 300 gr con impresión doble faz en resolución Scryfall máxima. El material estándar de Proxie Cards.",
    specs: ["300 gr/m²", "Doble faz", "Acabado satinado", "Alta resolución"],
    doubleSided: true,
    packPrices: [
      { size: 30, price: 16700 },
      { size: 60, price: 29000 },
      { size: 100, price: 37500 },
    ],
  },
]

export const DEFAULT_MATERIAL_ID: MaterialId = "sat300"
export const DEFAULT_PACK_SIZE: PackSize = 60

export function getMaterial(id: MaterialId | string): Material {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0]
}

export function getPackPrice(materialId: MaterialId | string, packSize: PackSize): number {
  const mat = getMaterial(materialId)
  return mat.packPrices.find((p) => p.size === packSize)?.price ?? 0
}

export function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Calculate price for any card count using proportional unit pricing.
 * Finds the unit price-per-card from the nearest pack tier (largest tier ≤ count,
 * or the smallest tier if count < 15) and multiplies by the actual count.
 *
 * Example: 110 cards with mate300 → unit = 37500/100 = $375/card → $41,250 total
 * Minimum tier is 30 cards.
 */
export function getPriceForCount(materialId: MaterialId | string, cardCount: number): number {
  if (cardCount <= 0) return 0
  const mat = getMaterial(materialId)
  const sorted = [...mat.packPrices].sort((a, b) => a.size - b.size)

  // Find the best reference tier: largest pack whose size ≤ cardCount
  // If count < 30 (minimum), use the 30-card tier pricing
  let ref = sorted[0]
  for (const tier of sorted) {
    if (tier.size <= cardCount) ref = tier
  }

  const unitPrice = ref.price / ref.size
  return Math.round(unitPrice * cardCount)
}
