"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { PrintListEntry, ScryfallCard, DeckItem, GameFormat, GameFormatConfig } from "@/types/scryfall"

export const GAME_FORMATS: GameFormatConfig[] = [
  { key: "singles",     label: "Singles",     legalityKey: undefined,      deckSize: undefined, maxCopies: undefined, description: "+30 cartas" },
  { key: "commander",   label: "Commander",   legalityKey: "commander",    deckSize: 100,       maxCopies: 1,         description: "100 cartas · Singleton" },
  { key: "standard",    label: "Standard",    legalityKey: "standard",     deckSize: 60,        maxCopies: 4,         description: "60 cartas · 4x máximo" },
  { key: "pioneer",     label: "Pioneer",     legalityKey: "pioneer",      deckSize: 60,        maxCopies: 4,         description: "60 cartas · 4x máximo" },
  { key: "modern",      label: "Modern",      legalityKey: "modern",       deckSize: 60,        maxCopies: 4,         description: "60 cartas · 4x máximo" },
  { key: "legacy",      label: "Legacy",      legalityKey: "legacy",       deckSize: 60,        maxCopies: 4,         description: "60 cartas · 4x máximo" },
  { key: "vintage",     label: "Vintage",     legalityKey: "vintage",      deckSize: 60,        maxCopies: 4,         description: "60 cartas · 4x máximo" },
  { key: "pauper",      label: "Pauper",      legalityKey: "pauper",       deckSize: 60,        maxCopies: 4,         description: "60 cartas · 4x máximo" },
  { key: "oathbreaker", label: "Oathbreaker", legalityKey: "oathbreaker",  deckSize: 60,        maxCopies: 1,         description: "60 cartas · Singleton" },
  { key: "brawl",       label: "Brawl",       legalityKey: "brawl",        deckSize: 60,        maxCopies: 1,         description: "60 cartas · Singleton" },
  { key: "historic",    label: "Historic",    legalityKey: "historic",     deckSize: 60,        maxCopies: 4,         description: "60 cartas · 4x máximo" },
]

const STORAGE_KEY_CART        = "proxie-cart-v4"
const STORAGE_KEY_BUILDER     = "proxie-builder-v4"
const STORAGE_KEY_EDITING_ID  = "proxie-editing-v4"
const STORAGE_KEY_DRAFTS      = "proxie-drafts-v1"

export const MIN_CARDS_TO_SAVE   = 30
export const SINGLES_DECK_ID     = "proxie-singles-deck"
export const SINGLES_DECK_NAME   = "Singles"

function generateId(): string {
  return `deck-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function loadCart(): DeckItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CART)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DeckItem[]
    return parsed.map(d => ({ ...d, format: (d.format ?? "singles") as GameFormat }))
  } catch { return [] }
}

function saveCart(decks: DeckItem[]) {
  try { localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(decks)) } catch { /* noop */ }
}

function loadBuilder(): DeckItem | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BUILDER)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DeckItem
    return { ...parsed, format: (parsed.format ?? "singles") as GameFormat }
  } catch { return null }
}

function saveBuilder(deck: DeckItem | null) {
  try {
    if (deck) localStorage.setItem(STORAGE_KEY_BUILDER, JSON.stringify(deck))
    else localStorage.removeItem(STORAGE_KEY_BUILDER)
  } catch { /* noop */ }
}

function loadEditingId(): string | null {
  if (typeof window === "undefined") return null
  try { return localStorage.getItem(STORAGE_KEY_EDITING_ID) ?? null } catch { return null }
}

function saveEditingId(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY_EDITING_ID, id)
    else localStorage.removeItem(STORAGE_KEY_EDITING_ID)
  } catch { /* noop */ }
}

function loadDrafts(): DeckItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRAFTS)
    if (!raw) return []
    return JSON.parse(raw) as DeckItem[]
  } catch { return [] }
}

function saveDrafts(drafts: DeckItem[]) {
  try { localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(drafts)) } catch { /* noop */ }
}

function makeEmptyDeck(existingNames: string[] = []): DeckItem {
  let n = 1
  while (existingNames.includes(`Deck ${n}`)) n++
  return {
    id: generateId(),
    name: `Deck ${n}`,
    type: "custom",
    format: "singles",
    description: "",
    entries: [],
    coverCard: undefined,
    isModified: false,
    setupCompleted: false,
    createdAt: Date.now(),
  }
}

export function usePrintStore() {
  const [builderDeck, setBuilderDeck]           = useState<DeckItem>(() => makeEmptyDeck([]))
  const [cartDecks, setCartDecksState]          = useState<DeckItem[]>([])
  const [draftDecks, setDraftDecksState]        = useState<DeckItem[]>([])
  const [editingCartDeckId, setEditingCartDeckId] = useState<string | null>(null)
  const [hydrated, setHydrated]                 = useState(false)

  const builderRef  = useRef<DeckItem>(builderDeck)
  const cartRef     = useRef<DeckItem[]>([])
  const draftsRef   = useRef<DeckItem[]>([])
  const editingRef  = useRef<string | null>(null)

  // The ID used to track the live builder slot in cartDecks
  const builderCartIdRef = useRef<string | null>(null)

  useEffect(() => {
    const cart      = loadCart()
    const builder   = loadBuilder()
    const editingId = loadEditingId()
    const drafts    = loadDrafts()

    // Always ensure the fixed singles deck exists (with min 30 target)
    let finalCart = cart
    const hasSingles = cart.some(d => d.id === SINGLES_DECK_ID)
    if (!hasSingles) {
      const singlesDeck: DeckItem = {
        id:             SINGLES_DECK_ID,
        name:           SINGLES_DECK_NAME,
        type:           "singles",
        format:         "singles",
        entries:        [],
        coverCard:      undefined,
        isModified:     false,
        setupCompleted: true,
        createdAt:      Date.now(),
      }
      finalCart = [singlesDeck, ...cart]
      saveCart(finalCart)
    }

    cartRef.current    = finalCart
    editingRef.current = editingId
    draftsRef.current  = drafts

    const initialDeck = builder ?? makeEmptyDeck(finalCart.map(d => d.name))
    builderRef.current = initialDeck

    // If the builder already had entries, ensure it exists in cart as a live slot
    if (initialDeck.entries.length > 0) {
      const existingLive = finalCart.find(d => d.id === initialDeck.id)
      if (existingLive) {
        builderCartIdRef.current = initialDeck.id
      }
    }

    setCartDecksState(finalCart)
    setDraftDecksState(drafts)
    setBuilderDeck(initialDeck)
    setEditingCartDeckId(editingId)
    setHydrated(true)
  }, [])

  const setBuilderDeckInner = useCallback((deck: DeckItem) => {
    builderRef.current = deck
    setBuilderDeck(deck)
    saveBuilder(deck)

    // Auto-upsert the live builder deck into cartDecks so it appears in DECKBOX immediately.
    // Upsert if there are entries OR if setup has been completed (so an empty new deck
    // still shows up in the deckbox right after the user confirms the format/name).
    if (deck.entries.length > 0 || deck.setupCompleted) {
      const liveId = builderCartIdRef.current ?? deck.id
      builderCartIdRef.current = liveId
      const alreadyInCart = cartRef.current.some(d => d.id === liveId)
      if (alreadyInCart) {
        const updated = cartRef.current.map(d =>
          d.id === liveId ? { ...deck, id: liveId, isModified: true } : d
        )
        cartRef.current = updated
        setCartDecksState(updated)
        saveCart(updated)
      } else {
        const liveEntry: DeckItem = { ...deck, id: liveId, isModified: true }
        const updated = [...cartRef.current, liveEntry]
        cartRef.current = updated
        setCartDecksState(updated)
        saveCart(updated)
      }
    } else {
      // Builder is empty AND setup not completed — remove live slot if present
      if (builderCartIdRef.current) {
        const updated = cartRef.current.filter(d => d.id !== builderCartIdRef.current)
        cartRef.current = updated
        setCartDecksState(updated)
        saveCart(updated)
      }
    }
  }, [])

  const setCartState = useCallback((decks: DeckItem[]) => {
    // Update ref IMMEDIATELY so concurrent operations see the latest state
    cartRef.current = decks
    setCartDecksState(decks)
    saveCart(decks)
  }, [])

  const clearBuilder = useCallback(() => {
    // Remove the live builder entry from cart before clearing
    if (builderCartIdRef.current) {
      const updated = cartRef.current.filter(d => d.id !== builderCartIdRef.current)
      cartRef.current = updated
      setCartDecksState(updated)
      saveCart(updated)
      builderCartIdRef.current = null
    }
    const empty = makeEmptyDeck(cartRef.current.map(d => d.name))
    builderRef.current  = empty
    editingRef.current  = null
    setBuilderDeck(empty)
    setEditingCartDeckId(null)
    saveBuilder(null)
    saveEditingId(null)
  }, [])

  const setBuilderName = useCallback((name: string) => {
    const deck = { ...builderRef.current, name }
    builderRef.current = deck
    setBuilderDeck(deck)
    saveBuilder(deck)
  }, [])

  const setBuilderFormat = useCallback((format: GameFormat) => {
    const deck = { ...builderRef.current, format }
    builderRef.current = deck
    setBuilderDeck(deck)
    saveBuilder(deck)
  }, [])

  /** Save current builder as a draft (in-progress, not ready for cart) */
  const saveBuilderAsDraft = useCallback(() => {
    const deck = builderRef.current
    if (!deck.setupCompleted) return
    const existing = draftsRef.current.find(d => d.id === deck.id)
    const updated = existing
      ? draftsRef.current.map(d => d.id === deck.id ? { ...deck } : d)
      : [...draftsRef.current, { ...deck }]
    draftsRef.current = updated
    setDraftDecksState(updated)
    saveDrafts(updated)
  }, [])

  /** Load a draft deck back into the builder */
  const loadDraftToBuilder = useCallback((draftId: string) => {
    const draft = draftsRef.current.find(d => d.id === draftId)
    if (!draft) return
    // Remove from drafts
    const updatedDrafts = draftsRef.current.filter(d => d.id !== draftId)
    draftsRef.current = updatedDrafts
    setDraftDecksState(updatedDrafts)
    saveDrafts(updatedDrafts)
    // Load into builder
    builderRef.current = { ...draft }
    builderCartIdRef.current = null
    setBuilderDeck({ ...draft })
    saveBuilder({ ...draft })
  }, [])

  /** Delete a draft permanently */
  const deleteDraft = useCallback((draftId: string) => {
    const updated = draftsRef.current.filter(d => d.id !== draftId)
    draftsRef.current = updated
    setDraftDecksState(updated)
    saveDrafts(updated)
  }, [])

  /** Reset the builder to a fresh empty deck (after saving current as draft) */
  const resetBuilder = useCallback(() => {
    const allNames = [
      ...cartRef.current.map(d => d.name),
      ...draftsRef.current.map(d => d.name),
    ]
    const fresh = makeEmptyDeck(allNames)
    builderRef.current = fresh
    builderCartIdRef.current = null
    setBuilderDeck(fresh)
    saveBuilder(fresh)
  }, [])

  /** Called when the user completes the setup wizard (name + format).
   *  Routes through setBuilderDeckInner so the deck is immediately upserted into
   *  cartDecks (the deckbox) without requiring any card to be added first. */
  const completeBuilderSetup = useCallback((name: string, format: GameFormat, relaxedRules?: boolean) => {
    const deck: DeckItem = {
      ...builderRef.current,
      name: name.trim() || builderRef.current.name,
      format,
      setupCompleted: true,
      isModified: true,
      relaxedRules: relaxedRules ?? false,
    }
    setBuilderDeckInner(deck)
  }, [setBuilderDeckInner])

  const setRelaxedRules = useCallback((value: boolean) => {
    const deck = builderRef.current
    setBuilderDeckInner({ ...deck, relaxedRules: value })
  }, [setBuilderDeckInner])

  const addCard = useCallback((card: ScryfallCard, qty = 1) => {
    const deck = builderRef.current
    const id   = card.oracle_id ?? card.name
    const existing = deck.entries.find(e => e.id === id)
    let newEntries: PrintListEntry[]

    if (existing) {
      newEntries = deck.entries.map(e =>
        e.id === id ? { ...e, quantity: Math.min(e.quantity + qty, 99) } : e
      )
    } else {
      newEntries = [...deck.entries, { id, card, quantity: Math.min(qty, 99) }]
    }

    setBuilderDeckInner({
      ...deck,
      entries: newEntries,
      coverCard: newEntries[0]?.card ?? deck.coverCard,
      isModified: true,
    })
  }, [setBuilderDeckInner])

  const removeCard = useCallback((id: string) => {
    const deck = builderRef.current
    setBuilderDeckInner({
      ...deck,
      entries: deck.entries.filter(e => e.id !== id),
      // Clear the Commander reference if the removed card was the Commander
      commanderEntryId: deck.commanderEntryId === id ? null : deck.commanderEntryId,
      isModified: true,
    })
  }, [setBuilderDeckInner])

  /** Mark (or unmark) an entry as the deck's Commander — only one at a time. */
  const setCommander = useCallback((entryId: string | null) => {
    const deck = builderRef.current
    setBuilderDeckInner({
      ...deck,
      commanderEntryId: deck.commanderEntryId === entryId ? null : entryId,
      isModified: true,
    })
  }, [setBuilderDeckInner])

  const setQuantity = useCallback((id: string, quantity: number) => {
    const deck = builderRef.current
    const qty  = Math.max(0, Math.min(quantity, 99))
    setBuilderDeckInner({
      ...deck,
      entries: qty === 0
        ? deck.entries.filter(e => e.id !== id)
        : deck.entries.map(e => e.id === id ? { ...e, quantity: qty } : e),
      isModified: true,
    })
  }, [setBuilderDeckInner])

  const updatePrint = useCallback((id: string, selectedPrint: ScryfallCard) => {
    const deck = builderRef.current
    setBuilderDeckInner({
      ...deck,
      entries: deck.entries.map(e => e.id === id ? { ...e, selectedPrint } : e),
      isModified: true,
    })
  }, [setBuilderDeckInner])

  const replaceAll = useCallback((incoming: { card: ScryfallCard; quantity: number }[]) => {
    const deck    = builderRef.current
    const entries = incoming.map(({ card, quantity }) => ({
      id: card.oracle_id ?? card.name,
      card,
      quantity: Math.max(1, Math.min(quantity, 99)),
    }))
    setBuilderDeckInner({
      ...deck,
      entries,
      coverCard: entries[0]?.card ?? deck.coverCard,
      isModified: true,
    })
  }, [setBuilderDeckInner])

  const saveBuilderToCart = useCallback((name: string) => {
    const deck = builderRef.current
    if (!deck.entries.length) return

    if (editingRef.current) {
      const updated = cartRef.current.map(d =>
        d.id === editingRef.current
          ? { ...deck, id: editingRef.current!, name, isModified: true }
          : d
      )
      setCartState(updated)
    } else {
      const newDeck: DeckItem = {
        ...deck,
        id: generateId(),
        name,
        isModified: false,
        createdAt: Date.now(),
      }
      setCartState([...cartRef.current, newDeck])
    }

    setTimeout(() => clearBuilder(), 50)
  }, [clearBuilder, setCartState])

  const editCartDeck = useCallback((deckId: string) => {
    const deck = cartRef.current.find(d => d.id === deckId)
    if (!deck) return
    // Set builderCartIdRef BEFORE setBuilderDeckInner so the auto-upsert
    // finds the deck already in cart (by deckId) and updates instead of duplicating.
    builderCartIdRef.current = deckId
    editingRef.current = deckId
    setEditingCartDeckId(deckId)
    saveEditingId(deckId)
    setBuilderDeckInner({ ...deck, sideboardMode: false })
  }, [setBuilderDeckInner])

  /** Load a precon into the builder for art customization, keeping type="precon" */
  const editPreconDeck = useCallback((deckId: string) => {
    const deck = cartRef.current.find(d => d.id === deckId)
    if (!deck) return
    builderCartIdRef.current = deckId
    editingRef.current = deckId
    setEditingCartDeckId(deckId)
    saveEditingId(deckId)
    setBuilderDeckInner({ ...deck, isModified: true, setupCompleted: true, sideboardMode: false })
  }, [setBuilderDeckInner])

  /** Open builder in sideboard mode for a specific cart deck */
  const editSideboard = useCallback((deckId: string) => {
    const deck = cartRef.current.find(d => d.id === deckId)
    if (!deck) return
    builderCartIdRef.current = deckId
    editingRef.current = deckId
    setEditingCartDeckId(deckId)
    saveEditingId(deckId)
    setBuilderDeckInner({ ...deck, sideboardMode: true, setupCompleted: true })
  }, [setBuilderDeckInner])

  /** Save sideboard entries back to a cart deck */
  const saveSideboardToCart = useCallback((deckId: string, sideboard: PrintListEntry[]) => {
    const updated = cartRef.current.map(d =>
      d.id === deckId ? { ...d, sideboard } : d
    )
    setCartState(updated)
  }, [setCartState])

  /** Add a card to the persistent "Singles" deck (never touches the active builder deck) */
  const addSingleCard = useCallback((card: ScryfallCard, qty = 1) => {
    const id       = card.oracle_id ?? card.name
    const existing = cartRef.current.find(d => d.id === SINGLES_DECK_ID)
    if (existing) {
      const entry = existing.entries.find(e => e.id === id)
      const newEntries = entry
        ? existing.entries.map(e => e.id === id ? { ...e, quantity: e.quantity + qty } : e)
        : [...existing.entries, { id, card, quantity: qty }]
      const updated = cartRef.current.map(d =>
        d.id === SINGLES_DECK_ID ? { ...d, entries: newEntries, coverCard: d.coverCard ?? card } : d
      )
      setCartState(updated)
    } else {
      const singlesDeck: DeckItem = {
        id:              SINGLES_DECK_ID,
        name:            SINGLES_DECK_NAME,
        type:            "singles",
        format:          "singles",
        entries:         [{ id, card, quantity: qty }],
        coverCard:       card,
        isModified:      false,
        setupCompleted:  true,
        createdAt:       Date.now(),
      }
      setCartState([...cartRef.current, singlesDeck])
    }
  }, [setCartState])

  /** Add a card to any specific deck already in cart (used by the deck-picker popover) */
  const addCardToDeck = useCallback((deckId: string, card: ScryfallCard, qty = 1) => {
    if (deckId === SINGLES_DECK_ID) {
      addSingleCard(card, qty)
      return
    }
    const id = card.oracle_id ?? card.name
    const updated = cartRef.current.map(d => {
      if (d.id !== deckId) return d
      const entry = d.entries.find(e => e.id === id)
      const newEntries = entry
        ? d.entries.map(e => e.id === id ? { ...e, quantity: e.quantity + qty } : e)
        : [...d.entries, { id, card, quantity: qty }]
      return { ...d, entries: newEntries }
    })
    setCartState(updated)
  }, [setCartState, addSingleCard])

  // Keep cartRef in sync with state so mutations always see fresh cart data
  useEffect(() => {
    cartRef.current = cartDecks
  }, [cartDecks])

  /** Wipes all locally-persisted deck state (cart, builder, drafts, editing id) and
   *  resets in-memory state to a fresh, empty session — mirroring a brand-new browser.
   *  Used on logout so decks from one account never bleed into whichever account
   *  (or anonymous session) uses this device/browser next. */
  const resetLocalDeckState = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_CART)
      localStorage.removeItem(STORAGE_KEY_BUILDER)
      localStorage.removeItem(STORAGE_KEY_EDITING_ID)
      localStorage.removeItem(STORAGE_KEY_DRAFTS)
    } catch { /* noop */ }

    const freshSingles: DeckItem = {
      id:             SINGLES_DECK_ID,
      name:           SINGLES_DECK_NAME,
      type:           "singles",
      format:         "singles",
      entries:        [],
      coverCard:      undefined,
      isModified:     false,
      setupCompleted: true,
      createdAt:      Date.now(),
    }
    const freshCart    = [freshSingles]
    const freshBuilder = makeEmptyDeck(freshCart.map(d => d.name))

    cartRef.current          = freshCart
    builderRef.current       = freshBuilder
    draftsRef.current        = []
    editingRef.current       = null
    builderCartIdRef.current = null

    setCartDecksState(freshCart)
    setBuilderDeck(freshBuilder)
    setDraftDecksState([])
    setEditingCartDeckId(null)
  }, [])

  const addPreconToCart = useCallback((
    name: string,
    entries: PrintListEntry[],
    coverCard?: ScryfallCard,
    originalPreconId?: string,
  ) => {
    const deck: DeckItem = {
      id: generateId(),
      name,
      type: "precon",
      format: "singles",
      entries,
      coverCard: coverCard ?? entries[0]?.card,
      isModified: false,
      originalPreconId,
      createdAt: Date.now(),
    }
    setCartState([...cartRef.current, deck])
    return deck
  }, [setCartState])

  const removeDeck = useCallback((deckId: string) => {
    setCartState(cartRef.current.filter(d => d.id !== deckId))
    // If this deck was loaded into the builder, clear the session so it can't auto-upsert back
    if (editingRef.current === deckId || builderCartIdRef.current === deckId) {
      builderCartIdRef.current = null
      editingRef.current = null
      setEditingCartDeckId(null)
      saveEditingId(null)
      const remaining = cartRef.current.filter(d => d.id !== deckId).map(d => d.name)
      const empty = makeEmptyDeck(remaining)
      builderRef.current = empty
      setBuilderDeck(empty)
      saveBuilder(null)
    }
  }, [setCartState])

  const renameDeck = useCallback((deckId: string, name: string) => {
    setCartState(cartRef.current.map(d => d.id === deckId ? { ...d, name } : d))
  }, [setCartState])

  const entries    = builderDeck.entries
  const totalCards = entries.reduce((s, e) => s + e.quantity, 0)
  const canSave    = totalCards >= MIN_CARDS_TO_SAVE
  const totalCartCards = cartDecks.reduce(
    (s, d) => s + d.entries.reduce((ss, e) => ss + e.quantity, 0), 0
  )

  return {
    builderDeck,
    builderCartId: builderCartIdRef.current,
    entries,
    totalCards,
    canSave,
    addCard,
    removeCard,
    setQuantity,
    updatePrint,
    replaceAll,
    clearBuilder,
    setBuilderName,
    setBuilderFormat,
    setRelaxedRules,
    setCommander,
    completeBuilderSetup,
    saveBuilderAsDraft,
    loadDraftToBuilder,
    deleteDraft,
    resetBuilder,
    draftDecks,

    saveBuilderToCart,
    editCartDeck,
    editPreconDeck,
    editSideboard,
    saveSideboardToCart,
    editingCartDeckId,

    cartDecks,
    setCartDecks: setCartState,
    totalCartCards,
    addPreconToCart,
    addSingleCard,
    addCardToDeck,
    removeDeck,
    renameDeck,

    addBuilderToCart: saveBuilderToCart,
    clearAll: clearBuilder,
    decks: cartDecks,

    resetLocalDeckState,

    hydrated,
  }
}
