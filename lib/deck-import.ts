/**
 * deck-import.ts
 * Parses the 4 common MTG deck list formats into a normalized list of
 * { name, count, setCode?, collectorNumber?, isFoil? } entries.
 *
 * Supported formats:
 *  - MTGO / PlainText:   "1 Card Name"
 *  - Moxfield:           "1 Card Name (SET) 123 *F*"
 *  - Arena:              sections like "About\nName Deck Name\n\nDeck\n1 Card Name\n\nSideboard\n1 Card"
 */

export interface ParsedEntry {
  name: string
  count: number
  setCode?: string
  collectorNumber?: string
  isFoil?: boolean
  isCommander?: boolean
}

// ── Format detection ──────────────────────────────────────────────────────────

/**
 * Returns true if the pasted text looks like a deck list rather than a card name.
 * Heuristic: at least 3 lines that match the simple "count name" pattern,
 * OR contains known Arena/Moxfield section headers.
 */
export function looksLikeDeckList(text: string): boolean {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return false

  // Has Arena section headers
  if (/^(About|Deck|Sideboard|Commander|Companion)$/im.test(text)) return true

  // Count how many lines match "number name" pattern
  const cardLineRe = /^\d+\s+[A-Z].{2,}/i
  const cardLines = lines.filter(l => cardLineRe.test(l))

  // Need at least 3 card-like lines to be considered a deck list
  return cardLines.length >= 3
}

// ── Format regexes ─────────────────────────────────────────────────────────────

// Moxfield / MTGO with set: "1 Card Name (SET) 123 *F*"
const MOXFIELD_RE = /^(\d+)\s+(.+?)\s+\(([A-Z0-9]{2,8})\)\s+([\w*/-]+)(\s+\*F\*)?$/i

// Plain MTGO / simple: "1 Card Name"
const SIMPLE_RE = /^(\d+)\s+(.+)$/

// Arena section headers to skip
const ARENA_SECTION_RE = /^(About|Deck|Sideboard|Commander|Companion|Attractions|Stickers|Tokens|Planes|Schemes|Emblems|Dungeon)$/i

// Arena "Name Deck Name" in About section
const ARENA_NAME_RE = /^Name\s+(.+)$/i

// ── Main parser ────────────────────────────────────────────────────────────────

export function parseDeckText(raw: string): {
  entries: ParsedEntry[]
  deckName: string | null
} {
  const lines = raw.split(/\r?\n/)
  const entries: ParsedEntry[] = []
  let deckName: string | null = null
  let inSideboard = false
  let inCommander = false

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Skip empty lines and comment lines
    if (!line || line.startsWith("//") || line.startsWith("#")) continue

    // Arena section headers
    if (ARENA_SECTION_RE.test(line)) {
      inSideboard = /^Sideboard$/i.test(line)
      inCommander = /^Commander$/i.test(line)
      continue
    }

    // Arena "Name" header inside About section
    const nameMatch = ARENA_NAME_RE.exec(line)
    if (nameMatch) {
      deckName = nameMatch[1].trim()
      continue
    }

    // Try Moxfield format first (most specific)
    const moxMatch = MOXFIELD_RE.exec(line)
    if (moxMatch) {
      const [, countStr, name, setCode, collectorNumber, foilStr] = moxMatch
      entries.push({
        name: cleanCardName(name),
        count: parseInt(countStr, 10),
        setCode: setCode.toUpperCase(),
        collectorNumber,
        isFoil: !!foilStr,
        isCommander: inCommander,
      })
      continue
    }

    // Try simple format "1 Card Name"
    const simpleMatch = SIMPLE_RE.exec(line)
    if (simpleMatch) {
      const [, countStr, name] = simpleMatch
      entries.push({
        name: cleanCardName(name),
        count: parseInt(countStr, 10),
        isCommander: inCommander,
      })
      continue
    }
  }

  return { entries, deckName }
}

/** Strip trailing set/number annotations that some exporters add, e.g. "Sol Ring // Sol Ring" */
function cleanCardName(name: string): string {
  // Remove trailing foil markers not caught by regex
  name = name.replace(/\s*\*F\*\s*$/i, "").trim()
  // Some formats double the card name with //
  const doubleFaceMatch = /^(.+?)\s*\/\/\s*.+$/.exec(name)
  if (doubleFaceMatch) return doubleFaceMatch[1].trim()
  return name
}

// ── Scryfall batch resolver ────────────────────────────────────────────────────

import type { ScryfallCard } from "@/types/scryfall"

export interface ResolvedEntry {
  name: string
  count: number
  card: ScryfallCard | null
  error?: string
}

// Maximum identifiers per /cards/collection request (Scryfall documented limit)
const COLLECTION_BATCH_SIZE = 75

/**
 * Builds a Scryfall identifier object for /cards/collection from a ParsedEntry.
 * Prefers set+collector_number for exact-print matching, falls back to name.
 */
function toIdentifier(entry: ParsedEntry): Record<string, string> {
  if (entry.setCode && entry.collectorNumber) {
    return { set: entry.setCode.toLowerCase(), collector_number: entry.collectorNumber }
  }
  return { name: entry.name }
}

/**
 * Resolves parsed entries against Scryfall using the /cards/collection endpoint.
 * Sends up to 75 identifiers per POST request, drastically reducing the number
 * of HTTP calls vs one-per-card lookups. Calls onProgress after each batch.
 */
export async function resolveEntries(
  entries: ParsedEntry[],
  onProgress?: (resolved: number, total: number, last?: ResolvedEntry) => void
): Promise<ResolvedEntry[]> {
  const total = entries.length

  // Deduplicate by canonical key so we only look up each unique print once
  // but still produce one ResolvedEntry per original entry (preserving count).
  const keyOf = (e: ParsedEntry) =>
    e.setCode && e.collectorNumber
      ? `${e.setCode.toLowerCase()}/${e.collectorNumber}`
      : e.name.toLowerCase()

  // Build ordered unique entry list (preserving first occurrence order)
  const seen = new Map<string, ScryfallCard | null | "error">()
  const uniqueEntries: ParsedEntry[] = []
  for (const entry of entries) {
    const k = keyOf(entry)
    if (!seen.has(k)) {
      seen.set(k, null)          // placeholder — filled after batch fetch
      uniqueEntries.push(entry)
    }
  }

  // Split unique entries into batches of COLLECTION_BATCH_SIZE
  const batches: ParsedEntry[][] = []
  for (let i = 0; i < uniqueEntries.length; i += COLLECTION_BATCH_SIZE) {
    batches.push(uniqueEntries.slice(i, i + COLLECTION_BATCH_SIZE))
  }

  let resolvedCount = 0

  for (const batch of batches) {
    const identifiers = batch.map(toIdentifier)

    try {
      const res = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers }),
      })

      if (!res.ok) {
        // Mark the whole batch as errored
        for (const entry of batch) seen.set(keyOf(entry), "error")
      } else {
        const json = await res.json() as {
          data: ScryfallCard[]
          not_found: Array<Record<string, string>>
        }

        // Map returned cards back by name (lowercased) and set/collector_number
        const byName = new Map<string, ScryfallCard>()
        const byPrint = new Map<string, ScryfallCard>()
        for (const card of json.data) {
          byName.set(card.name.toLowerCase(), card)
          if (card.set && card.collector_number) {
            byPrint.set(`${card.set}/${card.collector_number}`, card)
          }
        }

        for (const entry of batch) {
          const k = keyOf(entry)
          const card =
            (entry.setCode && entry.collectorNumber
              ? byPrint.get(`${entry.setCode.toLowerCase()}/${entry.collectorNumber}`)
              : byName.get(entry.name.toLowerCase())) ?? null
          seen.set(k, card ?? "error")
        }
      }
    } catch {
      for (const entry of batch) seen.set(keyOf(entry), "error")
    }

    resolvedCount += batch.length
    onProgress?.(Math.min(resolvedCount, total), total)

    // One small courtesy delay between batches (not between individual cards)
    if (resolvedCount < uniqueEntries.length) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  // Build final result array in original entry order
  const results: ResolvedEntry[] = []
  for (const entry of entries) {
    const k = keyOf(entry)
    const hit = seen.get(k) ?? "error"
    const card = hit === "error" || hit === null ? null : hit
    const error = hit === "error" ? "Carta no encontrada" : undefined
    const resolved: ResolvedEntry = { name: entry.name, count: entry.count, card, error }
    results.push(resolved)
    onProgress?.(results.length, total, resolved)
  }

  return results
}
