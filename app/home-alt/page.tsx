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
  Zap,
  ShieldCheck,
  Truck,
  SlidersHorizontal,
  Upload,
  Plus,
  Check,
  Package,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ScryfallCard, ScryfallSearchResponse } from "@/types/scryfall"
import { Navbar } from "@/components/navbar"
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

// Game format modes
const FORMAT_MODES = [
  { key: "commander", label: "Commander", href: "/precons?type=Commander+Deck",         img: "https://api.scryfall.com/cards/named?exact=Sol+Ring&set=c21&format=image&version=art_crop" },
  { key: "standard",  label: "Standard",  href: "/precons?type=Challenger+Deck",         img: "https://api.scryfall.com/cards/named?exact=Atraxa%2C+Grand+Unifier&format=image&version=art_crop" },
  { key: "pioneer",   label: "Pioneer",   href: "/precons?type=Pioneer+Challenger+Deck", img: "https://api.scryfall.com/cards/named?exact=Thoughtseize&set=ths&format=image&version=art_crop" },
  { key: "modern",    label: "Modern",    href: "/precons?type=Modern+Event+Deck",       img: "https://api.scryfall.com/cards/named?exact=Snapcaster+Mage&format=image&version=art_crop" },
  { key: "legacy",    label: "Legacy",    href: "/deckbuilder",                          img: "https://api.scryfall.com/cards/named?exact=Force+of+Will&set=all&format=image&version=art_crop" },
  { key: "pauper",    label: "Pauper",    href: "/precons?type=Pauper+Deck",             img: "https://api.scryfall.com/cards/named?exact=Lightning+Bolt&set=m10&format=image&version=art_crop" },
]

// Latest sets for the landing strip
const LATEST_SETS = [
  { code: "dsk",  name: "Duskmourn",           year: 2024, img: "https://api.scryfall.com/cards/named?exact=Enduring+Curiosity&format=image&version=art_crop" },
  { code: "blb",  name: "Bloomburrow",          year: 2024, img: "https://api.scryfall.com/cards/named?exact=Mabel%2C+Heir+of+Cragflame&format=image&version=art_crop" },
  { code: "otj",  name: "Outlaws of Thunder Junction", year: 2024, img: "https://api.scryfall.com/cards/named?exact=Annie+Flash%2C+the+Veteran&format=image&version=art_crop" },
  { code: "mkm",  name: "Murders at Karlov Manor", year: 2024, img: "https://api.scryfall.com/cards/named?exact=Suspiciously+Speedy+Hare&format=image&version=art_crop" },
  { code: "lci",  name: "Lost Caverns of Ixalan", year: 2023, img: "https://api.scryfall.com/cards/named?exact=Ojer+Taq%2C+Deepest+Foundation&format=image&version=art_crop" },
  { code: "woe",  name: "Wilds of Eldraine",    year: 2023, img: "https://api.scryfall.com/cards/named?exact=Gruff+Triplets&format=image&version=art_crop" },
]

// Featured precons
const FEATURED_PRECONS = [
  { name: "Avengers Assemble", set: "Commander · 2025", img: "https://api.scryfall.com/cards/named?exact=Captain+America%2C+Team+Leader&format=image&version=art_crop", href: "/precons?q=avengers" },
  { name: "Eldrazi Unbound",   set: "Commander · 2023", img: "https://api.scryfall.com/cards/named?exact=Zhulodok%2C+Void+Gorger&format=image&version=art_crop",      href: "/precons?q=eldrazi" },
  { name: "Atraxa Reigns",     set: "Commander · 2022", img: "https://api.scryfall.com/cards/named?exact=Atraxa%2C+Praetors%27+Voice&format=image&version=art_crop",  href: "/precons?q=atraxa" },
  { name: "Ur-Dragon",         set: "Commander · 2017", img: "https://api.scryfall.com/cards/named?exact=The+Ur-Dragon&format=image&version=art_crop",                href: "/precons?q=dragons" },
]

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

function DeckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.5">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 7h8M8 11h6" strokeLinecap="round" />
    </svg>
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
  const { addSingleCard, cartDecks, hydrated } = usePrintStore()
  const singlesCount = cartDecks.find(d => d.id === SINGLES_DECK_ID)?.entries.reduce((s, e) => s + e.quantity, 0) ?? 0
  const [addedCardId,  setAddedCardId]  = useState<string | null>(null)

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
    const id = card.oracle_id ?? card.name
    setAddedCardId(id)
    setTimeout(() => setAddedCardId(null), 1200)
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
                        const justAdded = addedCardId === cardId
                        return (
                          <div
                            key={card.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Agregar ${card.name} a Singles`}
                            onClick={() => handleAddToSingles(card)}
                            onKeyDown={e => e.key === "Enter" && handleAddToSingles(card)}
                            className={cn(
                              "group flex flex-col overflow-hidden border transition-all cursor-pointer rounded-xl",
                              justAdded
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
                                justAdded ? "bg-emerald-500/25" : "bg-black/0 group-hover:bg-black/40"
                              )}>
                                {justAdded
                                  ? <Check className="h-5 w-5 text-emerald-300 drop-shadow-lg" />
                                  : <Plus className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
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

        {/* ── Banner belt ─────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden mt-10"
          style={{
            backgroundImage: "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Izzet_Wallpaper_2560x1440-owQclDTlzIEvNd8L17BCUHFXfZjBh5.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
          }}
        >
          <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
          <div className="relative z-10 flex items-center justify-center px-6 py-10">
            <div className="text-center max-w-3xl">
              <p
                className="text-2xl md:text-3xl text-white tracking-widest uppercase font-bold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Llevando Magic al bolsillo de todos
              </p>
            </div>
          </div>
        </section>

        {/* ── Modalidades de juego ────────────────────────────────────────── */}
        <section className="bg-[#0a0b10] border-t border-white/8 py-14 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white uppercase font-display tracking-wide">Formatos</h2>
              <Link href="/precons" className="hidden md:flex items-center gap-1.5 text-xs font-bold text-white/40 hover:text-accent-blue transition-colors uppercase tracking-widest font-display">
                Ver precons <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {FORMAT_MODES.map((fmt) => (
                <Link
                  key={fmt.key}
                  href={fmt.href}
                  className="group relative rounded-xl border border-white/10 overflow-hidden flex flex-col justify-end aspect-[3/4] hover:border-white/30 transition-all duration-300 hover:scale-[1.02]"
                >
                  {/* Background art — subtle blur */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fmt.img}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover blur-sm transition-all duration-500 group-hover:blur-0 group-hover:scale-105"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                  />
                  {/* Very soft overlay — only bottom half darkened */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                  {/* Content — larger text */}
                  <div className="relative z-10 p-4">
                    <p className="text-lg font-bold text-white font-display uppercase leading-tight">{fmt.label}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Preconstruidos destacados ────────────────────────────────────── */}
        <section className="bg-[#070810] border-t border-white/8 py-14 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-accent-blue mb-2 font-display">Listos para pedir</p>
                <h2 className="text-3xl md:text-4xl font-bold text-white uppercase font-display">Preconstruidos</h2>
              </div>
              <Link href="/precons" className="hidden md:flex items-center gap-1.5 text-xs font-bold text-white/40 hover:text-accent-blue transition-colors uppercase tracking-widest font-display">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {FEATURED_PRECONS.map((p) => (
                <Link
                  key={p.name}
                  href={p.href}
                  className="group relative rounded-xl overflow-hidden border border-white/8 hover:border-accent-blue/40 transition-all duration-300 aspect-[3/4] flex items-end"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.img}
                    alt={p.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="relative z-10 p-4">
                    <p className="text-base font-bold text-white font-display uppercase leading-tight">{p.name}</p>
                    <p className="text-xs text-white/50 mt-1 tracking-wide">{p.set}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center md:hidden">
              <Link href="/precons" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-blue uppercase tracking-widest font-display">
                Ver todos los precons <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Ultimos sets ──────���──────────────────────────────────────────── */}
        <section className="bg-[#0a0b10] border-t border-white/8 py-14 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-accent-blue mb-2 font-display">Lanzamientos</p>
                <h2 className="text-3xl md:text-4xl font-bold text-white uppercase font-display">Ultimos Sets</h2>
              </div>
              <Link href="/sets" className="hidden md:flex items-center gap-1.5 text-xs font-bold text-white/40 hover:text-accent-blue transition-colors uppercase tracking-widest font-display">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {LATEST_SETS.map((s) => (
                <Link
                  key={s.code}
                  href={`/sets/${s.code}`}
                  className="group relative rounded-xl overflow-hidden border border-white/8 hover:border-accent-blue/40 transition-all duration-300 aspect-[3/2] flex items-end"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.img}
                    alt={s.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.1" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="relative z-10 p-2.5">
                    <p className="text-[10px] font-bold text-white font-display uppercase leading-tight line-clamp-2">{s.name}</p>
                    <p className="text-[9px] text-white/40 mt-0.5">{s.year}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features strip ───────────────────────────────────────────────── */}
        <section className="bg-[#070810] border-t border-white/8 py-10 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-px bg-white/8 rounded-2xl overflow-hidden">
              <div className="bg-[#070810] p-7 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/15 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 text-accent-blue" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-display mb-1">Envio Rapido</h3>
                  <p className="text-xs text-white/50 leading-relaxed">24-48hs. Envios a todo el pais con seguimiento.</p>
                </div>
              </div>
              <div className="bg-[#070810] p-7 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/15 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-accent-blue" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-display mb-1">Calidad Garantizada</h3>
                  <p className="text-xs text-white/50 leading-relaxed">300gr Mate, 200gr Simple o Foil 230gr. Listas para sleeves.</p>
                </div>
              </div>
              <div className="bg-[#070810] p-7 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/15 flex items-center justify-center shrink-0">
                  <Truck className="h-5 w-5 text-accent-blue" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-display mb-1">A Todo el Pais</h3>
                  <p className="text-xs text-white/50 leading-relaxed">Llegamos a cualquier punto de Argentina. Retiro disponible.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA section ─────────────────────────────────────────────────── */}
        <section className="bg-accent-blue py-16 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl text-white leading-tight mb-3 uppercase font-bold font-display">
              ARMA TU DECKBOX AHORA
            </h2>
            <p className="text-white/75 mb-8 max-w-lg mx-auto text-sm">
              Busca las cartas que necesitas, elegilas y pedi tu deck impreso en alta calidad.
            </p>
            <Link
              href="/deckbuilder"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-accent-blue text-sm font-bold tracking-widest uppercase hover:bg-white/90 transition-colors rounded-xl font-display"
            >
              COMENZAR
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="bg-black border-t border-white/10 py-12 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-start justify-between gap-8">
              <div className="flex items-center gap-3">
                <DeckIcon className="h-6 w-6 text-accent-blue" />
                <span className="font-bold text-white tracking-widest uppercase text-sm font-display">
                  Proxie<span className="text-accent-blue">.cards</span>
                </span>
              </div>
              <nav className="flex flex-wrap gap-6">
                <Link href="/precons" className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-widest">Precons</Link>
                <Link href="/deckbuilder"    className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-widest">Builder</Link>
                <Link href="/nosotros"className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-widest">Nosotros</Link>
                <Link href="/orders"  className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-widest">Mi Pedido</Link>
              </nav>
              <p className="text-xs text-white/20">
                © {new Date().getFullYear()} Proxie.cards — No oficial, no afiliado con Wizards of the Coast.
              </p>
            </div>
          </div>
        </footer>
        </main>
      </div>
    </>
  )
}
