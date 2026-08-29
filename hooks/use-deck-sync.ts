"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { usePrintStore } from "@/providers/print-store-provider"
import type { User } from "@supabase/supabase-js"
import type { DeckItem, PrintListEntry } from "@/types/scryfall"

export interface DeckMergePrompt {
  remote: DeckItem[]
  local: DeckItem[]
}

/** True if any deck actually has cards in it — used to tell a real, unsynced
 *  local session apart from the default empty "Singles" deck every browser starts with. */
function hasRealContent(decks: DeckItem[]): boolean {
  return decks.some(d => d.entries.length > 0)
}

/** Tracks which account this browser has already reconciled decks with (via
 *  backup-on-signup, remote-wins, or a resolved merge prompt). Once set, local
 *  decks are known to already reflect that account's saved state, so reloading
 *  the page must never re-ask the merge question — it should just silently
 *  keep pulling the account's latest decks like any normal logged-in session. */
const SYNCED_ACCOUNT_KEY = "proxie-synced-account"

function getSyncedAccountId(): string | null {
  try { return localStorage.getItem(SYNCED_ACCOUNT_KEY) } catch { return null }
}
function markAccountSynced(userId: string) {
  try { localStorage.setItem(SYNCED_ACCOUNT_KEY, userId) } catch { /* noop */ }
}

/** Merge a local deck list into a remote deck list without ever dropping cards.
 *  - Decks that only exist locally are appended as-is.
 *  - Decks that exist on both sides (in practice just the fixed "Singles" deck,
 *    since every other deck id is randomly generated) have their entries merged,
 *    summing quantities for any card present on both sides. */
function mergeDeckLists(remote: DeckItem[], local: DeckItem[]): DeckItem[] {
  const result = [...remote]
  for (const localDeck of local) {
    const idx = result.findIndex(d => d.id === localDeck.id)
    if (idx === -1) {
      if (localDeck.entries.length > 0) result.push(localDeck)
      continue
    }
    const remoteDeck = result[idx]
    const entryMap = new Map<string, PrintListEntry>(remoteDeck.entries.map(e => [e.id, e]))
    for (const entry of localDeck.entries) {
      const existing = entryMap.get(entry.id)
      entryMap.set(
        entry.id,
        existing ? { ...existing, quantity: Math.min(existing.quantity + entry.quantity, 99) } : entry,
      )
    }
    result[idx] = { ...remoteDeck, entries: Array.from(entryMap.values()) }
  }
  return result
}

/**
 * Syncs the local cart decks to Supabase when the user is logged in.
 *
 * - First-ever sync for an account (no remote row yet — right after signup, or an
 *   existing account that never synced from this browser): local decks are pushed
 *   as-is. This is the one-time backup that guarantees nobody loses decks by creating
 *   an account.
 * - Login on a device with no real local edits (just the default empty state):
 *   the account's remote decks win outright, no prompt needed.
 * - Login on a device that already has real, unsynced local decks: sync pauses and
 *   exposes `mergePrompt` so the UI can ask the user whether to add those decks to
 *   the account or discard them in favor of what's already saved.
 * - On every deck change while logged in: pushes the latest state to Supabase.
 * - On logout: wipes local storage so the next account (or anonymous visitor) on
 *   this device never inherits these decks.
 */
export function useDeckSync(user: User | null) {
  const { cartDecks, setCartDecks, resetLocalDeckState } = usePrintStore()
  const supabase = createClient()
  const synced = useRef(false)
  const wasLoggedIn = useRef(false)
  const [mergePrompt, setMergePrompt] = useState<DeckMergePrompt | null>(null)

  const pushDecks = useCallback(
    async (userId: string, decks: DeckItem[]) => {
      const { error } = await supabase.from("user_decks").upsert(
        { user_id: userId, data: { decks } },
        { onConflict: "user_id" },
      )
      if (error) {
        // Surface this loudly — a silent failure here means decks quietly
        // stop being backed up to the account, which previously went
        // completely unnoticed (missing UNIQUE constraint on user_id made
        // every upsert fail without anyone ever seeing it).
        console.error("[v0] Failed to sync decks to Supabase:", error.message, error)
      }
      return error
    },
    [supabase],
  )

  // On login / session restore — pull remote decks and reconcile with local state.
  useEffect(() => {
    if (!user) {
      // Real logout (was logged in, now isn't) — clear local storage so decks
      // don't bleed into the next account used on this device.
      if (wasLoggedIn.current) {
        resetLocalDeckState()
        try { localStorage.removeItem(SYNCED_ACCOUNT_KEY) } catch { /* noop */ }
      }
      wasLoggedIn.current = false
      synced.current = false
      setMergePrompt(null)
      return
    }
    wasLoggedIn.current = true
    if (synced.current || mergePrompt) return

    const pull = async () => {
      const { data, error } = await supabase
        .from("user_decks")
        .select("data")
        .eq("user_id", user.id)
        .single()

      if (error || !data) {
        // PGRST116-style "no rows" is expected the first time an account syncs
        // from any browser — anything else is worth surfacing since it's silent otherwise.
        if (error && error.code !== "PGRST116") {
          console.error("[v0] Failed to pull decks from Supabase:", error.message)
        }
        synced.current = true
        markAccountSynced(user.id)
        pushDecks(user.id, cartDecks)
        return
      }

      const remote = (data.data as { decks: DeckItem[] }).decks ?? []

      if (!hasRealContent(cartDecks) || getSyncedAccountId() === user.id) {
        // Either nothing meaningful on this device, or this exact device already
        // reconciled with this exact account before (backup, remote-wins, or a
        // resolved merge) — in both cases the account's data is the source of
        // truth going forward, no need to ask again.
        setCartDecks(remote)
        markAccountSynced(user.id)
        synced.current = true
        return
      }

      // Local has real decks never reconciled with this account — never overwrite
      // them silently. Ask first.
      setMergePrompt({ remote, local: cartDecks })
    }

    pull()
  }, [user])

  const keepBothDecks = useCallback(() => {
    if (!mergePrompt || !user) return
    const merged = mergeDeckLists(mergePrompt.remote, mergePrompt.local)
    setCartDecks(merged)
    pushDecks(user.id, merged)
    markAccountSynced(user.id)
    synced.current = true
    setMergePrompt(null)
  }, [mergePrompt, user, setCartDecks, pushDecks])

  const useOnlyAccountDecks = useCallback(() => {
    if (!mergePrompt || !user) return
    // Discard the local-only decks for real: overwrite local storage with just
    // the account's remote decks, so the rejected local cards can't resurface
    // on the next reload or get merged in later by mistake. Supabase (the
    // account's saved decks) is untouched — only this browser's local copy changes.
    setCartDecks(mergePrompt.remote)
    markAccountSynced(user.id)
    synced.current = true
    setMergePrompt(null)
  }, [mergePrompt, user, setCartDecks])

  // On cart change — push to Supabase (only once the initial sync/merge is resolved).
  useEffect(() => {
    if (!user || !synced.current) return
    pushDecks(user.id, cartDecks)
  }, [cartDecks, user])

  return { mergePrompt, keepBothDecks, useOnlyAccountDecks }
}
