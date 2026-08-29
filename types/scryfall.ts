export interface ScryfallImageUris {
  small?: string
  normal?: string
  large?: string
  png?: string
  art_crop?: string
  border_crop?: string
}

export interface ScryfallCardFace {
  name: string
  type_line?: string
  oracle_text?: string
  mana_cost?: string
  image_uris?: ScryfallImageUris
  artist?: string
}

/** Scryfall legality values per format */
export type LegalityStatus = "legal" | "not_legal" | "banned" | "restricted"

export interface ScryfallLegalities {
  standard?: LegalityStatus
  pioneer?: LegalityStatus
  modern?: LegalityStatus
  legacy?: LegalityStatus
  vintage?: LegalityStatus
  commander?: LegalityStatus
  oathbreaker?: LegalityStatus
  pauper?: LegalityStatus
  historic?: LegalityStatus
  explorer?: LegalityStatus
  alchemy?: LegalityStatus
  brawl?: LegalityStatus
  [key: string]: LegalityStatus | undefined
}

export interface ScryfallCard {
  id: string
  oracle_id?: string
  name: string
  layout: string
  type_line?: string
  oracle_text?: string
  mana_cost?: string
  colors?: string[]
  color_identity?: string[]
  rarity?: "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus"
  set: string
  set_name: string
  set_type?: string
  collector_number: string
  artist?: string
  released_at?: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
  prints_search_uri?: string
  scryfall_uri?: string
  flavor_text?: string
  power?: string
  toughness?: string
  loyalty?: string
  prices?: {
    usd?: string | null
    usd_foil?: string | null
  }
  legalities?: ScryfallLegalities
  /** True only for a synthetic card created from a user-uploaded image (never legalities/singleton-checked). */
  isCustomUpload?: boolean
}

export interface ScryfallSearchResponse {
  object: "list"
  total_cards: number
  has_more: boolean
  next_page?: string
  data: ScryfallCard[]
}

export type DeckMode = "custom" | "precon"

export type GameFormat =
  | "singles"
  | "commander"
  | "standard"
  | "pioneer"
  | "modern"
  | "legacy"
  | "vintage"
  | "pauper"
  | "oathbreaker"
  | "brawl"
  | "historic"

export interface GameFormatConfig {
  key: GameFormat
  label: string
  legalityKey?: keyof ScryfallLegalities
  deckSize?: number
  maxCopies?: number
  description?: string
}

export interface PrintListEntry {
  id: string
  card: ScryfallCard
  quantity: number
  selectedPrint?: ScryfallCard
}

export interface DeckItem {
  id: string
  name: string
  type: "precon" | "set" | "custom" | "singles"
  format: GameFormat
  description?: string
  entries: PrintListEntry[]
  sideboard?: PrintListEntry[]       // up to 15 extra cards for 60-card formats
  sideboardMode?: boolean            // builder is open in sideboard-editing mode
  originalPreconId?: string
  coverCard?: ScryfallCard
  isModified?: boolean
  setupCompleted?: boolean
  /** When true, format restrictions (singleton, deck size, legality) are bypassed in the builder */
  relaxedRules?: boolean
  /** id (PrintListEntry.id) of the entry marked as this Commander deck's Commander */
  commanderEntryId?: string | null
  createdAt: number
}

export type LegacyPrintList = PrintListEntry[]
