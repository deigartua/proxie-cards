"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { usePrintStore } from "@/providers/print-store-provider"
import { useDeckbox } from "@/providers/deckbox-provider"
import { useAuth } from "@/hooks/use-auth"
import { AuthModal } from "@/components/auth-modal"
import { ChevronDown, ShoppingBag, Menu, X, ChevronRight, Check, ArrowRight, User as UserIcon, LogOut, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Data ──────────────────────────────────────────────────────────────────────

// These labels + hrefs must match the TYPE_GROUPS in app/precons/page.tsx exactly
const PRECONS_FORMATS = [
  { label: "Commander",       href: "/precons?type=Commander+Deck",          desc: "100 cartas · Singleton" },
  { label: "Standard",        href: "/precons?type=Challenger+Deck",         desc: "60 cartas · Competitivo" },
  { label: "Pioneer",         href: "/precons?type=Pioneer+Challenger+Deck", desc: "60 cartas · Competitivo" },
  { label: "Modern",          href: "/precons?type=Modern+Event+Deck",       desc: "60 cartas · Competitivo" },
  { label: "Brawl / Historic",href: "/precons?type=Brawl+Deck",              desc: "60 cartas · Singleton" },
  { label: "Pauper",          href: "/precons?type=Pauper+Deck",             desc: "60 cartas · Solo comunes" },
]

const PRECONS_EXTRA = [
  { label: "Secret Lair", href: "/precons?type=Secret+Lair+Drop" },
  { label: "Duel Decks",  href: "/precons?type=Duel+Deck" },
  { label: "Planechase",  href: "/precons?type=Planechase+Deck" },
]

// Featured precon decks shown as cards in the dropdown
const PRECONS_FEATURED = [
  {
    name: "Lorehold Spirit",
    set: "SOC",
    href: "/precons?type=Commander+Deck",
    img: "https://api.scryfall.com/cards/named?exact=Quintorius%2C+History+Chaser&format=image&version=art_crop",
  },
  {
    name: "Mirko, Obsessive Theorist",
    set: "DSK",
    href: "/precons?type=Commander+Deck",
    img: "https://api.scryfall.com/cards/named?exact=Mirko%2C+Obsessive+Theorist&format=image&version=art_crop",
  },
  {
    name: "Animated Army",
    set: "BLB",
    href: "/precons?type=Commander+Deck",
    img: "https://api.scryfall.com/cards/named?exact=Glarb%2C+Calamity%27s+Augur&format=image&version=art_crop",
  },
]

// Recent sets shown in the SETS dropdown, ordered by release date descending.
// href uses /sets?set=CODE so the sets page opens that set directly.
const SETS_RECENT = [
  { code: "fic", label: "Final Fantasy",                 year: 2025, href: "/sets?set=fic" },
  { code: "trc", label: "Star Trek Commander",           year: 2025, href: "/sets?set=trc" },
  { code: "trk", label: "Star Trek",                     year: 2025, href: "/sets?set=trk" },
  { code: "fdn", label: "Foundations",                   year: 2024, href: "/sets?set=fdn" },
  { code: "dsk", label: "Duskmourn",                     year: 2024, href: "/sets?set=dsk" },
  { code: "blb", label: "Bloomburrow",                   year: 2024, href: "/sets?set=blb" },
]

// These type values match Scryfall's set_type field used in /sets?type=xxx
const SETS_BY_TYPE = [
  { label: "Expansiones",  href: "/sets?type=expansion",        desc: "Standard legal" },
  { label: "Core Sets",    href: "/sets?type=core",             desc: "Sets base" },
  { label: "Commander",    href: "/sets?type=commander",        desc: "Sets de Commander" },
  { label: "Masters",      href: "/sets?type=masters",          desc: "Reediciones premium" },
  { label: "Box Sets",     href: "/sets?type=box",              desc: "UB · Colaboraciones" },
  { label: "Draft",        href: "/sets?type=draft_innovation", desc: "Draft Innovation" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Nav item with an animated accent underline on hover */
function NavItem({
  children,
  active = false,
  className,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  className?: string
  onClick?: () => void
}) {
  return (
    <span
      className={cn(
        "relative group px-4 h-14 flex items-center gap-0.5 font-bold tracking-widest uppercase text-white font-display text-sm cursor-pointer select-none transition-colors",
        active ? "text-accent-blue" : "hover:text-accent-blue",
        className
      )}
      onClick={onClick}
    >
      {children}
      {/* Animated underline flash — accent-blue, slides in from left on hover */}
      <span
        className={cn(
          "absolute bottom-0 left-0 h-[2px] bg-accent-blue transition-all duration-200 ease-out",
          active ? "w-full" : "w-0 group-hover:w-full"
        )}
      />
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface NavbarProps {
  onCartClick?: () => void
  onAddDeck?: () => void
  deckJustAdded?: boolean
}

// Types needed for dynamic recent sets
interface NavScryfallSet { code: string; name: string; released_at: string }

// Only show these set types in the "recent" column
const RECENT_ALLOWED_TYPES = new Set(["expansion", "core", "masters", "commander", "box", "draft_innovation"])

export function Navbar({ onCartClick, onAddDeck, deckJustAdded }: NavbarProps = {}) {
  const [preconsOpen, setPreconsOpen] = useState(false)
  const [setsOpen,    setSetsOpen]    = useState(false)
  const { toggle: toggleDeckbox, open: deckboxOpen } = useDeckbox()
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [mobileSub,   setMobileSub]   = useState<"precons" | "sets" | null>(null)
  const { user, signOut } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [recentSets,  setRecentSets]  = useState<NavScryfallSet[]>(
    // Start from hardcoded list so there's no flicker on first open
    SETS_RECENT.map(s => ({ code: s.code, name: s.label, released_at: `${s.year}-01-01` }))
  )
  const recentFetched = useRef(false)
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => { setMobileOpen(false); setMobileSub(null); setProfileOpen(false) }, [pathname])

  // Close profile dropdown when clicking outside of it
  useEffect(() => {
    if (!profileOpen) return
    const handleClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [profileOpen])

  // Fetch recent sets from Scryfall once when the sets dropdown first opens
  useEffect(() => {
    if (!setsOpen || recentFetched.current) return
    recentFetched.current = true
    fetch("https://api.scryfall.com/sets")
      .then(r => r.json())
      .then((data: { data: (NavScryfallSet & { set_type: string })[] }) => {
        const recent = data.data
          .filter(s => RECENT_ALLOWED_TYPES.has(s.set_type) && s.released_at)
          .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime())
          .slice(0, 6)
        setRecentSets(recent)
      })
      .catch(() => {}) // keep hardcoded fallback on error
  }, [setsOpen])

  const { cartDecks } = usePrintStore()
  const deckCount = cartDecks.filter(d => d.entries.length > 0).length

  const isOnDeckbox = pathname?.startsWith("/deckbox") || pathname?.startsWith("/carrito")
  const isOnDeckbuilder = pathname?.startsWith("/deckbuilder")

  const handleCartClick = () => {
    if (isOnDeckbox) return
    if (isOnDeckbuilder) {
      router.push("/deckbox")
    } else if (onCartClick) {
      onCartClick()
    } else {
      toggleDeckbox()
    }
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-[#0a0b10] z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo with underline flash */}
          <Link href="/" className="relative group flex items-center shrink-0">
            <Image
              src="/proxie-logo.png"
              alt="Proxie Cards"
              width={100}
              height={40}
              className="h-8 w-auto object-contain brightness-0 invert"
              priority
            />
            <span className="absolute bottom-0 left-0 h-[2px] bg-accent-blue w-0 group-hover:w-full transition-all duration-200 ease-out" />
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-0 flex-1">

            {/* PRECONS */}
            <div
              className="relative"
              onMouseEnter={() => setPreconsOpen(true)}
              onMouseLeave={() => setPreconsOpen(false)}
            >
              <NavItem active={pathname?.startsWith("/precons")} onClick={() => { setPreconsOpen(false); router.push("/precons") }}>
                PRECONS
                <ChevronDown className={cn("h-2.5 w-2.5 transition-transform ml-0.5", preconsOpen && "rotate-180")} />
              </NavItem>

              {preconsOpen && (
                <div className="fixed top-14 left-0 right-0 bg-[#0a0b10]/98 backdrop-blur-sm border-t-2 border-accent-blue z-50 shadow-2xl">
                  <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-[1fr_1fr_320px] gap-0 p-0">

                      {/* Col 1: Formats */}
                      <div className="p-6 border-r border-white/6">
                        <p className="text-[9px] font-bold tracking-widest uppercase text-accent-blue mb-4 font-display">
                          Por formato
                        </p>
                        <div className="space-y-0.5">
                          {PRECONS_FORMATS.map(item => (
                            <Link
                              key={item.label}
                              href={item.href}
                              onClick={() => setPreconsOpen(false)}
                              className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                            >
                              <span className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-white/30 group-hover:text-white/50 transition-colors">
                                {item.desc}
                              </span>
                            </Link>
                          ))}
                          <div className="pt-3 border-t border-white/6 mt-2 space-y-0.5">
                            {PRECONS_EXTRA.map(item => (
                              <Link
                                key={item.label}
                                href={item.href}
                                onClick={() => setPreconsOpen(false)}
                                className="block px-3 py-2 text-xs text-white/40 hover:text-white/70 transition-colors rounded-lg hover:bg-white/5"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Col 2: Featured decks */}
                      <div className="p-6 border-r border-white/6">
                        <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 mb-4 font-display">
                          Destacados
                        </p>
                        <div className="space-y-2">
                          {PRECONS_FEATURED.map(deck => (
                            <Link
                              key={deck.name}
                              href={deck.href}
                              onClick={() => setPreconsOpen(false)}
                              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={deck.img}
                                alt={deck.name}
                                className="w-14 h-10 object-cover rounded-md shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors truncate">
                                  {deck.name}
                                </p>
                                <p className="text-[10px] text-white/30 font-mono uppercase">{deck.set}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Col 3: CTAs */}
                      <div className="p-6 flex flex-col gap-3">
                        <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 mb-1 font-display">
                          Acciones
                        </p>
                        <Link
                          href="/precons"
                          onClick={() => setPreconsOpen(false)}
                          className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 hover:border-accent-blue/40 hover:bg-accent-blue/5 transition-all group"
                        >
                          <span className="text-sm font-bold text-white/70 group-hover:text-white transition-colors">
                            Ver todos los precons
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-accent-blue transition-colors" />
                        </Link>
                        <Link
                          href="/deckbuilder"
                          onClick={() => setPreconsOpen(false)}
                          className="flex items-center justify-between px-4 py-3 rounded-xl border border-accent-blue/30 bg-accent-blue/10 hover:bg-accent-blue/20 transition-all group"
                        >
                          <span className="text-sm font-bold text-accent-blue group-hover:text-white transition-colors">
                            Armar mazo propio
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-accent-blue/60 group-hover:text-white transition-colors" />
                        </Link>
                        <p className="text-[10px] text-white/20 mt-auto pt-2 leading-relaxed">
                          Todos los mazos son imprimibles. Elegí el formato y empezá a jugar.
                        </p>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SETS */}
            <div
              className="relative"
              onMouseEnter={() => setSetsOpen(true)}
              onMouseLeave={() => setSetsOpen(false)}
            >
              <NavItem active={pathname?.startsWith("/sets")} onClick={() => { setSetsOpen(false); router.push("/sets") }}>
                SETS
                <ChevronDown className={cn("h-2.5 w-2.5 transition-transform ml-0.5", setsOpen && "rotate-180")} />
              </NavItem>

              {setsOpen && (
                <div className="fixed top-14 left-0 right-0 bg-[#0a0b10]/98 backdrop-blur-sm border-t-2 border-accent-blue z-50 shadow-2xl">
                  <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-[1fr_1fr_320px] gap-0 p-0">

                      {/* Col 1: Available sets */}
                      <div className="p-6 border-r border-white/6">
                        <p className="text-[9px] font-bold tracking-widest uppercase text-accent-blue mb-4 font-display">
                          Ya disponibles
                        </p>
                        <div className="space-y-0.5">
                          {recentSets.map(item => (
                            <Link
                              key={item.code}
                              href={`/sets?set=${item.code}`}
                              onClick={() => setSetsOpen(false)}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                            >
                              {/* Scryfall set icon */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`https://svgs.scryfall.io/sets/${item.code}.svg`}
                                alt={item.name}
                                className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-80 invert transition-opacity"
                              />
                              <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors flex-1 truncate">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-white/25 tabular-nums shrink-0">{item.released_at.slice(0, 4)}</span>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Col 2: By type */}
                      <div className="p-6 border-r border-white/6">
                        <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 mb-4 font-display">
                          Por tipo
                        </p>
                        <div className="space-y-0.5">
                          {SETS_BY_TYPE.map(item => (
                            <Link
                              key={item.label}
                              href={item.href}
                              onClick={() => setSetsOpen(false)}
                              className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                            >
                              <span className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-white/25 group-hover:text-white/45 transition-colors">
                                {item.desc}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Col 3: CTAs */}
                      <div className="p-6 flex flex-col gap-3">
                        <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 mb-1 font-display">
                          Acciones
                        </p>
                        <Link
                          href="/sets"
                          onClick={() => setSetsOpen(false)}
                          className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 hover:border-accent-blue/40 hover:bg-accent-blue/5 transition-all group"
                        >
                          <span className="text-sm font-bold text-white/70 group-hover:text-white transition-colors">
                            Ver todos los sets
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-accent-blue transition-colors" />
                        </Link>
                        <Link
                          href="/sets"
                          onClick={() => setSetsOpen(false)}
                          className="flex items-center justify-between px-4 py-3 rounded-xl border border-accent-blue/30 bg-accent-blue/10 hover:bg-accent-blue/20 transition-all group"
                        >
                          <span className="text-sm font-bold text-accent-blue group-hover:text-white transition-colors">
                            Buscar por edición
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-accent-blue/60 group-hover:text-white transition-colors" />
                        </Link>
                        <p className="text-[10px] text-white/20 mt-auto pt-2 leading-relaxed">
                          Todas las ediciones están disponibles para imprimir, incluyendo colaboraciones y crossovers.
                        </p>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>

            <NavItem active={pathname === "/precios"}>
              <Link href="/precios" className="contents">PRECIOS</Link>
            </NavItem>
            <NavItem active={pathname === "/nosotros"}>
              <Link href="/nosotros" className="contents">NOSOTROS</Link>
            </NavItem>
            <NavItem active={pathname?.startsWith("/orders")}>
              <Link href="/orders" className="contents">MI PEDIDO</Link>
            </NavItem>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {/* DECKBOX — always-split button */}
            <div className={cn(
              "flex items-stretch h-9 rounded-lg overflow-hidden border shrink-0 transition-all",
              onAddDeck ? "border-emerald-600/50" : "border-accent-blue"
            )}>
              {onAddDeck ? (
                <button
                  onClick={deckJustAdded ? undefined : onAddDeck}
                  className={cn(
                    "flex items-center gap-1.5 pl-3 pr-2.5 text-xs font-bold tracking-widest uppercase transition-all font-display",
                    deckJustAdded
                      ? "bg-emerald-700/80 text-emerald-100 cursor-default"
                      : "bg-emerald-800/60 text-emerald-300 hover:bg-emerald-700/70 hover:text-emerald-200"
                  )}
                >
                  {deckJustAdded
                    ? <><Check className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">AÑADIDO</span></>
                    : <><ShoppingBag className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">AÑADIR</span><span className="sm:hidden">+</span></>
                  }
                </button>
              ) : isOnDeckbuilder ? (
                <button
                  onClick={handleCartClick}
                  className="flex items-center gap-1.5 pl-3 pr-2 text-xs font-bold tracking-widest uppercase transition-all font-display bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                  <span>COMPRAR</span>
                  {deckCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-white/25 text-[10px] font-bold text-white tabular-nums">
                      {deckCount}
                    </span>
                  )}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", deckboxOpen && "rotate-180")} />
                </button>
              ) : isOnDeckbox ? (
                <button
                  disabled
                  className="flex items-center gap-1.5 pl-3 pr-2 text-xs font-bold tracking-widest uppercase transition-all font-display bg-accent-blue/40 text-white/50 cursor-not-allowed"
                >
                  <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                  <span>DECKBOX</span>
                  {deckCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-white/25 text-[10px] font-bold text-white tabular-nums">
                      {deckCount}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={toggleDeckbox}
                  className={cn(
                    "flex items-center gap-1.5 pl-3 pr-2 text-xs font-bold tracking-widest uppercase transition-all font-display",
                    "bg-accent-blue text-white hover:bg-accent-blue/85"
                  )}
                >
                  <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                  <span>DECKBOX</span>
                  {deckCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-white/25 text-[10px] font-bold text-white tabular-nums">
                      {deckCount}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Profile icon — square button, opens auth modal or account dropdown.
                Hidden on mobile (< md) where space is tight — account access lives
                in the hamburger drawer instead. */}
            <div className="relative hidden md:block" ref={profileMenuRef}>
              <button
                onClick={() => (user ? setProfileOpen(v => !v) : setAuthModalOpen(true))}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-lg border transition-colors shrink-0",
                  user
                    ? "border-accent-blue/50 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20"
                    : "border-white/15 text-white/70 hover:text-white hover:border-white/30"
                )}
                aria-label={user ? "Mi cuenta" : "Iniciar sesión"}
              >
                <UserIcon className="h-4 w-4" />
              </button>

              {profileOpen && user && (
                <div className="absolute top-11 right-0 w-56 rounded-xl border border-white/10 bg-[#0a0b10] shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/6">
                    <p className="text-sm font-semibold text-white/90 truncate">{user.email}</p>
                  </div>
                  <div className="flex flex-col py-1">
                    <Link
                      href="/cuenta"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <UserRound className="h-3.5 w-3.5 text-white/40" />
                      Mi cuenta
                    </Link>
                    <button
                      onClick={() => { setProfileOpen(false); signOut() }}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/5 transition-colors text-left"
                    >
                      <LogOut className="h-3.5 w-3.5 text-white/40" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* DeckboxSidePanel is rendered at layout level via DeckboxProvider */}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col" style={{ top: 56 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-[#0a0b10] border-t-2 border-accent-blue flex-1 overflow-y-auto">

            {!mobileSub && (
              <nav className="flex flex-col divide-y divide-white/6">
                <button onClick={() => setMobileSub("precons")} className="flex items-center justify-between px-6 py-4 text-sm font-bold tracking-widest uppercase text-white/80 hover:text-white hover:bg-white/4 transition-colors font-display">
                  PRECONS <ChevronRight className="h-4 w-4 text-white/30" />
                </button>
                <button onClick={() => setMobileSub("sets")} className="flex items-center justify-between px-6 py-4 text-sm font-bold tracking-widest uppercase text-white/80 hover:text-white hover:bg-white/4 transition-colors font-display">
                  SETS <ChevronRight className="h-4 w-4 text-white/30" />
                </button>
                <Link href="/precios" onClick={() => setMobileOpen(false)} className="px-6 py-4 text-sm font-bold tracking-widest uppercase text-white/80 hover:text-white hover:bg-white/4 transition-colors font-display">PRECIOS</Link>
                <Link href="/nosotros" className="px-6 py-4 text-sm font-bold tracking-widest uppercase text-white/80 hover:text-white hover:bg-white/4 transition-colors font-display">NOSOTROS</Link>
                <Link href="/orders"   className="px-6 py-4 text-sm font-bold tracking-widest uppercase text-white/80 hover:text-white hover:bg-white/4 transition-colors font-display">MI PEDIDO</Link>
                {user ? (
                  <>
                    <Link href="/cuenta" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-6 py-4 text-sm font-bold tracking-widest uppercase text-white/80 hover:text-white hover:bg-white/4 transition-colors font-display">
                      <UserRound className="h-4 w-4 text-white/40" /> MI CUENTA
                    </Link>
                    <button onClick={() => { setMobileOpen(false); signOut() }} className="flex items-center gap-2.5 px-6 py-4 text-sm font-bold tracking-widest uppercase text-white/80 hover:text-white hover:bg-white/4 transition-colors font-display text-left">
                      <LogOut className="h-4 w-4 text-white/40" /> CERRAR SESIÓN
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setMobileOpen(false); setAuthModalOpen(true) }} className="flex items-center gap-2.5 px-6 py-4 text-sm font-bold tracking-widest uppercase text-white/80 hover:text-white hover:bg-white/4 transition-colors font-display text-left">
                    <UserIcon className="h-4 w-4 text-white/40" /> INICIAR SESIÓN
                  </button>
                )}
              </nav>
            )}

            {mobileSub === "precons" && (
              <div>
                <button onClick={() => setMobileSub(null)} className="flex items-center gap-2 px-6 py-4 text-xs font-bold tracking-widest uppercase text-accent-blue hover:text-accent-blue/80 transition-colors font-display border-b border-white/6 w-full">
                  <ChevronRight className="h-3 w-3 rotate-180" /> PRECONS
                </button>
                <div className="divide-y divide-white/6">
                  <div className="px-6 pt-4 pb-2">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-accent-blue mb-3 font-display">Por formato</p>
                    {PRECONS_FORMATS.map(item => (
                      <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-3 border-b border-white/4 last:border-0">
                        <span className="text-sm font-semibold text-white/85">{item.label}</span>
                        <span className="text-[11px] text-white/35">{item.desc}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-white/30 mb-3 font-display">Otros</p>
                    {PRECONS_EXTRA.map(item => (
                      <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm text-white/55 border-b border-white/4 last:border-0">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div className="px-6 py-4 flex flex-col gap-3">
                    <Link href="/precons" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 text-sm font-bold text-white/70">
                      Ver todos los precons <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link href="/deckbuilder" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-4 py-3 rounded-xl border border-accent-blue/30 bg-accent-blue/10 text-sm font-bold text-accent-blue">
                      Armar mazo propio <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {mobileSub === "sets" && (
              <div>
                <button onClick={() => setMobileSub(null)} className="flex items-center gap-2 px-6 py-4 text-xs font-bold tracking-widest uppercase text-accent-blue hover:text-accent-blue/80 transition-colors font-display border-b border-white/6 w-full">
                  <ChevronRight className="h-3 w-3 rotate-180" /> SETS
                </button>
                <div className="divide-y divide-white/6">
                  <div className="px-6 pt-4 pb-2">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-accent-blue mb-3 font-display">Ya disponibles</p>
                    {SETS_RECENT.map(item => (
                      <Link key={item.code} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-3 border-b border-white/4 last:border-0">
                        <span className="text-sm text-white/80">{item.label}</span>
                        <span className="text-[11px] text-white/30 tabular-nums">{item.year}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-white/30 mb-3 font-display">Por tipo</p>
                    {SETS_BY_TYPE.map(item => (
                      <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-2.5 text-sm text-white/55 border-b border-white/4 last:border-0">
                        <span>{item.label}</span>
                        <span className="text-[10px] text-white/25">{item.desc}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="px-6 py-4 flex flex-col gap-3">
                    <Link href="/sets" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 text-sm font-bold text-white/70">
                      Ver todos los sets <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link href="/sets" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-4 py-3 rounded-xl border border-accent-blue/30 bg-accent-blue/10 text-sm font-bold text-accent-blue">
                      Buscar por edición <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
    </>
  )
}
