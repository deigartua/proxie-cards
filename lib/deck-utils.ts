import type { ScryfallCard } from "@/types/scryfall"

// ── Shared deck types ────────────────────────────────────────────────────────

export interface DeckCard {
  name: string
  count: number
  scryfallId?: string
  type?: string | null
  isCommander?: boolean
}

export interface DeckMetadata {
  id: string
  name: string
  code: string
  type: string | null
  releaseDate: string | null
  colorIdentity: string[]
  commanderName: string | null
  commanderScryfallId: string | null
  firstCardScryfallId: string | null
  sourceSetCodes: string[]
  cardCount: number
  cards: DeckCard[]
}

// ── Cache ────────────────────────────────────────────────────────────────────

let decksCache: DeckMetadata[] | null = null

export async function fetchDecksMetadata(): Promise<DeckMetadata[]> {
  if (decksCache) return decksCache
  try {
    const res = await fetch("/decks-all.json")
    if (!res.ok) throw new Error("Failed")
    const data = await res.json()
    decksCache = data.decks || []
    return decksCache!
  } catch {
    return []
  }
}

// ── fetchCardsForDeck ────────────────────────────────────────────────────────
// Fetches ScryfallCard objects for every card in a deck, correctly assigning
// `quantity` even when the same card appears multiple times in the deck list.
//
// The core fix: pre-aggregate count by scryfallId (or name) before hitting
// Scryfall's /cards/collection endpoint, which deduplicates by oracle identity.
// Without aggregation, multiple "Plains" entries collapse to 1 card returned
// and quantity ends up as 1 instead of the real total.

export async function fetchCardsForDeck(deck: DeckMetadata): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = []

  // Pre-aggregate: sum count for duplicate scryfallIds / names
  const byId   = new Map<string, { totalCount: number; isCommander: boolean }>()
  const byName = new Map<string, { totalCount: number; isCommander: boolean }>()

  for (const c of deck.cards) {
    if (c.scryfallId) {
      const existing = byId.get(c.scryfallId)
      if (existing) {
        existing.totalCount += c.count
        if (c.isCommander) existing.isCommander = true
      } else {
        byId.set(c.scryfallId, { totalCount: c.count, isCommander: !!c.isCommander })
      }
    } else {
      const key = c.name.toLowerCase()
      const existing = byName.get(key)
      if (existing) {
        existing.totalCount += c.count
        if (c.isCommander) existing.isCommander = true
      } else {
        byName.set(key, { totalCount: c.count, isCommander: !!c.isCommander })
      }
    }
  }

  const uniqueIds   = Array.from(byId.entries())
  const uniqueNames = Array.from(byName.entries())

  // Fetch by scryfallId in batches of 75
  for (let i = 0; i < uniqueIds.length; i += 75) {
    const batch = uniqueIds.slice(i, i + 75)
    try {
      const res = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: batch.map(([id]) => ({ id })) }),
      })
      if (!res.ok) continue
      const data = await res.json()
      for (const card of (data.data as ScryfallCard[])) {
        const meta = byId.get(card.id)
        ;(card as any).quantity    = meta?.totalCount ?? 1
        ;(card as any).isCommander = meta?.isCommander ?? false
        cards.push(card)
      }
    } catch { /* skip batch */ }
    if (i + 75 < uniqueIds.length) await new Promise(r => setTimeout(r, 100))
  }

  // Fallback: fetch by name in batches of 75
  for (let i = 0; i < uniqueNames.length; i += 75) {
    const batch = uniqueNames.slice(i, i + 75)
    try {
      const res = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: batch.map(([name]) => ({ name })) }),
      })
      if (!res.ok) continue
      const data = await res.json()
      for (const card of (data.data as ScryfallCard[])) {
        const key  = card.name.toLowerCase()
        const meta = byName.get(key)
        ;(card as any).quantity    = meta?.totalCount ?? 1
        ;(card as any).isCommander = meta?.isCommander ?? false
        cards.push(card)
      }
    } catch { /* skip batch */ }
    if (i + 75 < uniqueNames.length) await new Promise(r => setTimeout(r, 100))
  }

  return cards
}
