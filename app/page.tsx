"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Search,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  SlidersHorizontal,
  Upload,
  Plus,
  Check,
  Package,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ScryfallCard, ScryfallSearchResponse } from "@/types/scryfall"
import { Navbar } from "@/components/navbar"
import { CardDetailModal } from "@/components/card-detail-modal"
import { usePrintStore, SINGLES_DECK_ID, MIN_CARDS_TO_SAVE } from "@/providers/print-store-provider"

// ── Hero wallpapers ────────────────────────────────────────────────────────────
const HERO_SLIDES = [
  { id: "boros",    bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Boros_Wallpaper_2560x1440-SXA7OwV6YbT7HhdpQWKfEI375ITBN7.jpg" },
  { id: "rakdos",  bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Rakdos_Wallpaper_2560x1440-8zFDpKuqRPqwb5BtOEX3g7kiwiKDGn.jpg" },
  { id: "golgari", bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Golgari_Wallpaper_2560x1440-kAx1wIgSje98UdECZJZnxINmh0J65C.jpg" },
  { id: "simic",   bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Simic_Wallpaper_2560x1440-qawL4KjaKf2TQvVgidxrEgLwNpmFGJ.jpg" },
  { id: "dimir",   bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Dimir_Wallpaper_2560x1440-Tq0LwIACMD3WgfIk7KGBE8l7N3wjyK.jpg" },
  { id: "azorius", bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Azorius_Wallpaper_2560x1440-Rc9yw4ljZDJl4pq3kQaVJyu3YTYxID.jpg" },
  { id: "orzhov",  bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Orzhov_Wallpaper_2560x1440-d3LjIbocLVyp98AAV6H2AqN19UcTWY.jpg" },
  { id: "izzet",   bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Izzet_Wallpaper_2560x1440-owQclDTlzIEvNd8L17BCUHFXfZjBh5.jpg" },
  { id: "selesnya",bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Selesnya_Wallpaper_2560x1440-uK4hZO8gBnBpdhVs7g945S5y0nJoDR.jpg" },
  { id: "gruul",   bg: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Gruul_Wallpaper_2560x1440-LPN8PMX6XizcVw2b5arxwmGlUU6nvu.jpg" },
]

// Typewriter demo queries — these cycle automatically when user is idle
const DEMO_QUERIES = ["Sol Ring", "Arcane Signet", "Cyclonic Rift", "Swords to Plowshares"]


function getCardImage(card: ScryfallCard): string | undefined {
  return (
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.normal
  )
}

// Skeleton placeholder card
function SearchCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden border border-white/10 bg-white/5 animate-pulse rounded">
      <div className="aspect-[5/7] bg-white/10" />
      <div className="p-2 space-y-1.5">
        <div className="h-3 w-3/4 bg-white/10 rounded" />
        <div className="h-2 w-1/2 bg-white/10 rounded" />
      </div>
    </div>
  )
}

// ── Typewriter hook ────────────────────────────────────────────────────────────
// Cycles through queries letter-by-letter. Returns the current animated text
// and whether we're in "ghost" (demo) mode vs real user input.
function useTypewriter(
  queries: string[],
  active: boolean, // pause when user is typing
  onQueryReady: (q: string) => void
) {
  const [ghostText, setGhostText]       = useState("")
  const [queryIdx,  setQueryIdx]        = useState(0)
  const [charIdx,   setCharIdx]         = useState(0)
  const [phase,     setPhase]           = useState<"typing" | "hold" | "erasing">("typing")

  useEffect(() => {
    if (!active) {
      setGhostText("")
      setCharIdx(0)
      setPhase("typing")
      return
    }

    const current = queries[queryIdx]

    if (phase === "typing") {
      if (charIdx < current.length) {
        const t = setTimeout(() => {
          const next = current.slice(0, charIdx + 1)
          setGhostText(next)
          setCharIdx(charIdx + 1)
          // Fire search when word is fully typed
          if (charIdx + 1 === current.length) onQueryReady(next)
        }, 80)
        return () => clearTimeout(t)
      } else {
        // Hold for 2s then start erasing
        const t = setTimeout(() => setPhase("erasing"), 2000)
        return () => clearTimeout(t)
      }
    }

    if (phase === "erasing") {
      if (charIdx > 0) {
        const t = setTimeout(() => {
          setGhostText(current.slice(0, charIdx - 1))
          setCharIdx(charIdx - 1)
        }, 40)
        return () => clearTimeout(t)
      } else {
        // Move to next query
        setQueryIdx((queryIdx + 1) % queries.length)
        setPhase("typing")
      }
    }
  }, [active, phase, charIdx, queryIdx, queries, onQueryReady])

  return ghostText
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const [heroSlide,   setHeroSlide]   = useState(0)
  const [dragStart,   setDragStart]   = useState<number | null>(null)

  // Print store — for adding cards to singles deck
  const { addSingleCard, cartDecks, hydrated, updatePrint } = usePrintStore()
  const singlesEntries = cartDecks.find(d => d.id === SINGLES_DECK_ID)?.entries ?? []
  const singlesCount = singlesEntries.reduce((s, e) => s + e.quantity, 0)

  // Card preview — clicking a search result opens the same detail/preview modal
  // used in the deckbuilder instead of adding the card immediately.
  const [previewCard, setPreviewCard] = useState<ScryfallCard | null>(null)
  const closePreview = useCallback(() => setPreviewCard(null), [])
  const previewEntry = previewCard
    ? singlesEntries.find(e => e.id === (previewCard.oracle_id ?? previewCard.name))
    : undefined

  // Real user search state
  const [userQuery,    setUserQuery]   = useState("")
  const [results,      setResults]     = useState<ScryfallCard[]>([])
  const [searching,    setSearching]   = useState(false)
  const [searchError,  setSearchError] = useState<string | null>(null)
  const [userActive,   setUserActive]  = useState(false) // true when user has focused/typed

  // Ghost (typewriter demo) results
  const [ghostResults, setGhostResults] = useState<ScryfallCard[]>([])
  const [ghostLoading, setGhostLoading] = useState(false)

  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ghostDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef        = useRef<HTMLInputElement>(null)

  function handleAddToSingles(card: ScryfallCard) {
    addSingleCard(card, 1)
  }

  // Auto-rotate hero slides
  useEffect(() => {
    const iv = setInterval(() => setHeroSlide(p => (p + 1) % HERO_SLIDES.length), 6000)
    return () => clearInterval(iv)
  }, [])

  // Fetch ghost results when typewriter finishes a word
  const handleGhostQuery = useCallback((q: string) => {
    if (ghostDebounce.current) clearTimeout(ghostDebounce.current)
    setGhostLoading(true)
    setGhostResults([])
    ghostDebounce.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=name&unique=cards`)
        if (!res.ok) { setGhostResults([]); setGhostLoading(false); return }
        const data: ScryfallSearchResponse = await res.json()
        setGhostResults(data.data.slice(0, 6))
      } catch { /* silent */ }
      finally   { setGhostLoading(false) }
    }, 150)
  }, [])

  const ghostText = useTypewriter(DEMO_QUERIES, !userActive, handleGhostQuery)

  // Real user search
  function handleUserInput(val: string) {
    setUserActive(true)
    setUserQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setResults([])
      setSearchError(null)
      setSearching(false)
      return
    }
    setSearching(true)
    setSearchError(null)
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(val.trim())}&order=name&unique=cards`)
        if (!res.ok) { setResults([]); setSearchError("No se encontraron cartas."); return }
        const data: ScryfallSearchResponse = await res.json()
        setResults(data.data.slice(0, 6))
        setSearchError(null)
      } catch {
        setSearchError("Error de conexion. Intenta de nuevo.")
      } finally {
        setSearching(false)
      }
    }, 280)
  }

  function handleOpenBuilder() {
    const q = userActive ? userQuery.trim() : ghostText.trim()
    if (q) router.push(`/deckbuilder?q=${encodeURIComponent(q)}`)
    else router.push("/deckbuilder")
  }

  // When user focuses input, hand over control
  function handleFocus() {
    setUserActive(true)
  }

  // Hero carousel drag/swipe handlers
  function handleHeroDragStart(e: React.MouseEvent | React.TouchEvent) {
    const x = "clientX" in e ? e.clientX : e.touches?.[0]?.clientX
    if (x !== undefined) setDragStart(x)
  }

  function handleHeroDragEnd(e: React.MouseEvent | React.TouchEvent) {
    if (dragStart === null) return
    const x = "clientX" in e ? e.clientX : e.changedTouches?.[0]?.clientX
    if (x === undefined) return
    const diff = dragStart - x
    if (Math.abs(diff) > 50) {
      // Swiped right (< 50px left) → next slide, left (> 50px right) → prev slide
      if (diff > 0) {
        setHeroSlide(p => (p + 1) % HERO_SLIDES.length)
      } else {
        setHeroSlide(p => (p - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
      }
    }
    setDragStart(null)
  }

  // Decide what to show — ghost panel is never shown, only used for placeholder text
  const showGhost    = !userActive
  const showSkeleton = userActive && searching
  const hasResults   = results.length > 0
  const hasError     = userActive && searchError

  const slide = HERO_SLIDES[heroSlide]

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />

        <main>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section 
          className="relative overflow-hidden h-screen flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleHeroDragStart}
          onMouseUp={handleHeroDragEnd}
          onTouchStart={handleHeroDragStart}
          onTouchEnd={handleHeroDragEnd}
          role="region"
          aria-label="Galería de fondos — desliza para cambiar"
        >
          {HERO_SLIDES.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "absolute inset-0 transition-opacity duration-1000",
                i === heroSlide ? "opacity-100" : "opacity-0"
              )}
              aria-hidden="true"
            >
              <Image
                src={s.bg}
                alt=""
                fill
                className="object-cover object-center"
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : "low"}
                loading={i === 0 ? "eager" : "lazy"}
                sizes="100vw"
                quality={75}
              />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/15 to-transparent" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" aria-hidden="true" />

          <div className="relative z-10 w-full max-w-3xl mx-auto px-6 flex flex-col items-center text-center">
            <div className="mb-8 mt-2">
              <Image
                src="/proxie-logo.png"
                alt="Proxie Cards"
                width={400}
                height={160}
                sizes="(max-width: 768px) 224px, 288px"
                className="h-28 md:h-36 w-auto object-contain brightness-0 invert mx-auto drop-shadow-2xl"
                priority
              />
            </div>
            <p className="text-sm md:text-base text-white mb-8 leading-relaxed max-w-lg mx-auto text-balance">
              Proxies premium de Magic: The Gathering
            </p>

            {/* ── Search widget ──────────────────────────────────────────── */}
            <div className="w-full">
              {/* Input row — rounded pill style */}
              <div className={cn(
                "flex items-center border bg-black/70 backdrop-blur-sm transition-all duration-300 rounded-2xl overflow-hidden",
                userActive && userQuery
                  ? "border-accent-blue shadow-[0_0_32px_rgba(37,99,235,0.30)]"
                  : "border-white/20"
              )}>
                <div className="flex items-center pl-5">
                  {searching
                    ? <span className="h-4 w-4 border-2 border-white/30 border-t-accent-blue rounded-full animate-spin" />
                    : <Search className="h-4 w-4 shrink-0 text-white/40" />
                  }
                </div>

                {/* Input */}
                <div className="relative flex-1 min-w-0">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userActive ? userQuery : ""}
                    onChange={e => handleUserInput(e.target.value)}
                    onFocus={handleFocus}
                    placeholder={showGhost ? ghostText || "Busca cualquier carta de Magic..." : "Busca cualquier carta de Magic..."}
                    className="relative z-10 w-full bg-transparent text-base text-white outline-none py-4 px-4 min-w-0 placeholder:text-white/30"
                    aria-label="Buscar cartas de Magic: The Gathering"
                  />
                </div>

                {/* Filter button */}
                <button
                  type="button"
                  onClick={() => router.push("/deckbuilder")}
                  title="Filtros avanzados"
                  className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-white/40 hover:text-white/70 hover:border-white/25 transition-colors mx-1 shrink-0"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>

                {/* Import button */}
                <button
                  type="button"
                  onClick={() => router.push("/deckbuilder?import=1")}
                  title="Importar lista"
                  className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-white/40 hover:text-white/70 hover:border-white/25 transition-colors mr-1 shrink-0"
                >
                  <Upload className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenBuilder}
                  className="m-1.5 px-6 py-2.5 bg-accent-blue text-white text-xs font-bold tracking-widest uppercase hover:bg-accent-blue/85 active:scale-95 transition-all shrink-0 font-display rounded-xl"
                >
                  {hasResults && userActive ? "CONTINUAR" : "BUSCAR"}
                </button>
              </div>

              {/* Results panel — only for real user searches, never ghost */}
              {userActive && (hasResults || showSkeleton || hasError) && (
                <div className="mt-1.5 border border-white/10 bg-black/90 backdrop-blur-md rounded-2xl overflow-hidden">
                  {/* Singles deck target bar */}
                  {hydrated && (
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-white/3">
                      <div className="flex items-center gap-1.5">
                        <Package className="h-3 w-3 text-white/40 shrink-0" />
                        <span className="text-[10px] text-white/50 font-medium">Agregando a: <span className="text-white/70 font-bold">Singles</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-[10px] font-bold tabular-nums", singlesCount >= MIN_CARDS_TO_SAVE ? "text-emerald-400" : "text-white/50")}>
                          {singlesCount}/{MIN_CARDS_TO_SAVE} min
                        </span>
                        {singlesCount >= MIN_CARDS_TO_SAVE && <Check className="h-3 w-3 text-emerald-400" />}
                      </div>
                    </div>
                  )}
                  {showSkeleton && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-4">
                      {Array.from({ length: 6 }).map((_, i) => <SearchCardSkeleton key={i} />)}
                    </div>
                  )}
                  {hasError && (
                    <div className="flex items-center gap-2 px-5 py-4 text-sm text-white/50">
                      <AlertCircle className="h-4 w-4 shrink-0" />{searchError}
                    </div>
                  )}
                  {!showSkeleton && hasResults && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-4">
                      {results.map((card) => {
                        const imgSrc = getCardImage(card)
                        const cardId = card.oracle_id ?? card.name
                        const inSingles = singlesEntries.some(e => e.id === cardId)
                        return (
                          <div
                            key={card.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Ver detalle de ${card.name}`}
                            onClick={() => setPreviewCard(card)}
                            onKeyDown={e => e.key === "Enter" && setPreviewCard(card)}
                            className={cn(
                              "group flex flex-col overflow-hidden border transition-all cursor-pointer rounded-xl",
                              inSingles
                                ? "border-emerald-500/70 ring-1 ring-emerald-500/40"
                                : "border-white/10 hover:border-accent-blue/60"
                            )}
                          >
                            <div className="relative aspect-[5/7] overflow-hidden">
                              {imgSrc ? (
                                <img src={imgSrc} alt={card.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                                  <span className="text-[9px] text-white/60 text-center px-1 leading-tight">{card.name}</span>
                                </div>
                              )}
                              <div className={cn(
                                "absolute inset-0 transition-all duration-200 flex items-center justify-center",
                                inSingles ? "bg-emerald-500/15" : "bg-black/0 group-hover:bg-black/40"
                              )}>
                                {inSingles
                                  ? <Check className="h-5 w-5 text-emerald-300 drop-shadow-lg" />
                                  : <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                }
                              </div>
                            </div>
                            <div className="px-1.5 py-1.5 bg-black/90">
                              <p className="text-[9px] font-semibold text-white truncate leading-tight">{card.name}</p>
                              <p className="text-[8px] text-white/35 truncate mt-0.5">{card.set_name}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {hasResults && (
                    <button
                      onClick={handleOpenBuilder}
                      className="w-full px-5 py-3 text-xs font-bold tracking-widest uppercase border-t border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 font-display text-accent-blue"
                    >
                      VER TODOS EN EL BUILDER
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Hero slide dots */}
            <div className="flex gap-2 justify-center mt-6">
              {HERO_SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroSlide(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all border border-white/60",
                    i === heroSlide ? "w-6 bg-white" : "w-2 bg-transparent hover:bg-white/30"
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        </main>
      </div>

      {previewCard && (
        <CardDetailModal
          card={previewCard}
          entry={previewEntry}
          isInDeck={!!previewEntry}
          onAdd={(card) => { handleAddToSingles(card); closePreview() }}
          onUpdatePrint={updatePrint}
          onClose={closePreview}
        />
      )}
    </>
  )
}
