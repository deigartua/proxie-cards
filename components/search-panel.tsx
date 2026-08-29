"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, Plus, Minus, AlertCircle, Layers, Check, SlidersHorizontal, ExternalLink, GripVertical, FileUp, ChevronRight, MoreVertical, ImagePlus, Upload, X, LogIn, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AdvancedSearchModal } from "@/components/advanced-search-modal"
import { AuthModal } from "@/components/auth-modal"
import { looksLikeDeckList } from "@/lib/deck-import"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { compressCardImage, validateCardImageFile } from "@/lib/compress-card-image"
import { getRuleViolationReason } from "@/lib/format-rules"
import { RuleWarningDialog } from "@/components/rule-warning-dialog"
import type { ScryfallCard, ScryfallSearchResponse, GameFormatConfig } from "@/types/scryfall"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCardImage(card: ScryfallCard): string | undefined {
  return (
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal ??
    undefined
  )
}

function isDoubleFaced(card: ScryfallCard): boolean {
  return (
    Array.isArray(card.card_faces) &&
    card.card_faces.length >= 2 &&
    !!card.card_faces[0].image_uris &&
    !!card.card_faces[1].image_uris
  )
}

function getManaCostSymbols(card: ScryfallCard): string[] {
  const cost = card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? ""
  return cost.match(/\{[^}]+\}/g) ?? []
}

function getRarityDot(rarity?: string) {
  switch (rarity) {
    case "mythic": return "bg-orange-400"
    case "rare": return "bg-yellow-400"
    case "uncommon": return "bg-slate-300"
    default: return "bg-zinc-600"
  }
}

const MANA_COLOR: Record<string, string> = {
  W: "bg-yellow-50 text-yellow-900",
  U: "bg-blue-600 text-white",
  B: "bg-zinc-800 text-zinc-200",
  R: "bg-red-600 text-white",
  G: "bg-green-700 text-white",
  C: "bg-zinc-500 text-white",
}

function MiniMana({ symbols }: { symbols: string[] }) {
  if (!symbols.length) return null
  // Show max 5 symbols then "..."
  const shown = symbols.slice(0, 6)
  const rest = symbols.length - shown.length
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {shown.map((s, i) => {
        const inner = s.replace(/[{}]/g, "")
        const cls = MANA_COLOR[inner] ?? "bg-zinc-700 text-zinc-200"
        return (
          <span
            key={i}
            className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold leading-none ${cls}`}
          >
            {inner}
          </span>
        )
      })}
      {rest > 0 && <span className="text-[8px] text-muted-foreground">+{rest}</span>}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
  <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-3 py-2.5 animate-pulse">
  <div className="h-[88px] w-[63px] shrink-0 rounded-md bg-surface-raised" />
  <div className="flex-1 space-y-2 min-w-0">
  <div className="h-3.5 w-2/3 rounded bg-surface-raised" />
  <div className="h-3 w-1/2 rounded bg-surface-raised" />
  <div className="flex gap-1 mt-1.5">
  {[1, 2].map((n) => (
  <div key={n} className="h-3.5 w-3.5 rounded-full bg-surface-raised" />
  ))}
  </div>
  </div>
  <div className="shrink-0 flex flex-col items-end gap-1.5">
  <div className="h-7 w-24 rounded-lg bg-surface-raised" />
  <div className="h-8 w-24 rounded-lg bg-surface-raised" />
      </div>
    </div>
  )
}

// ─── Card Result Row ──────────────────────────────────────────────────────────

interface CardResultProps {
  isIllegal?: boolean
  /** Adding this card breaks the active format's singleton/copy-limit rule.
   *  This is guidance only — shown as an amber warning, never blocks the action. */
  isSingletonWarning?: boolean
  card: ScryfallCard
  isInDeck: boolean
  qty: number
  onQtyChange: (v: number) => void
  onAdd: (card: ScryfallCard, qty: number) => void
  onViewDetail: (card: ScryfallCard) => void
}

function CardResult({ card, isInDeck, qty, onQtyChange, onAdd, onViewDetail, isIllegal, isSingletonWarning }: CardResultProps) {
  const imgSrc = getCardImage(card)
  const dfc = isDoubleFaced(card)
  const symbols = getManaCostSymbols(card)
  const rarityDot = getRarityDot(card.rarity)

  const typeLine = card.type_line?.split("—")[0].trim() ?? ""

  // Drag: encode card JSON in dataTransfer so the deck panel can receive it
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "copy"
    e.dataTransfer.setData("application/proxie-card", JSON.stringify({ card, qty }))
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group relative flex items-center gap-3.5 rounded-xl border px-3 py-2.5 transition-all duration-150 cursor-grab active:cursor-grabbing overflow-hidden ${
        isIllegal
          ? "border-red-500/40 bg-red-950/10 hover:border-red-400/60"
          : isSingletonWarning
          ? "border-amber-400/50 bg-amber-500/5 hover:border-amber-400/70"
          : isInDeck
          ? "border-accent-gold/30 bg-accent-gold/5 hover:border-accent-gold/60 hover:bg-accent-gold/10"
          : "border-border bg-card hover:border-accent-gold/40 hover:bg-surface-raised"
      }`}
    >
      {/* Left accent bar for in-deck state */}
      {isInDeck && (
        <div className={`absolute left-0 inset-y-0 w-0.5 rounded-r-full ${isSingletonWarning ? "bg-amber-400/70" : "bg-accent-gold/70"}`} />
      )}

      {/* Drag handle — fades in on hover */}
      <div className="shrink-0 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Thumbnail — click opens detail */}
      <button
        onClick={() => onViewDetail(card)}
        className="relative h-[88px] w-[63px] shrink-0 overflow-hidden rounded-md bg-surface-raised hover:ring-2 hover:ring-accent-gold/50 transition-all"
        aria-label={`Ver detalle de ${card.name}`}
      >
        {imgSrc ? (
          <img src={imgSrc} alt={card.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-raised">
            <span className="text-[9px] text-muted-foreground text-center leading-tight px-0.5">{card.name}</span>
          </div>
        )}
        {dfc && (
          <div className="absolute bottom-0.5 right-0.5 rounded-sm bg-accent-gold/90 p-0.5">
            <Layers className="h-2.5 w-2.5 text-background" />
          </div>
        )}
      </button>

      {/* Info — click opens detail */}
      <button onClick={() => onViewDetail(card)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[15px] font-semibold text-foreground leading-tight">{card.name}</p>
          {card.rarity && (
            <span className={`h-2 w-2 shrink-0 rounded-full ${rarityDot}`} title={card.rarity} />
          )}
        </div>
        <p className="truncate text-[12px] text-muted-foreground leading-tight mt-1">
          {card.set_name}{typeLine ? ` · ${typeLine}` : ""}
        </p>
        {symbols.length > 0 && (
          <div className="mt-1.5">
            <MiniMana symbols={symbols} />
          </div>
        )}
      </button>

      {/* Right controls — qty stepper + add button */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {/* Qty stepper */}
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onQtyChange(Math.max(1, qty - 1)) }}
            className="h-7 w-7 rounded border border-border bg-surface-raised text-muted-foreground hover:border-red-400/50 hover:text-red-400 transition-colors flex items-center justify-center"
            aria-label="Reducir cantidad"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            min={1}
            max={99}
            value={qty}
            onClick={e => e.stopPropagation()}
            onChange={e => {
              e.stopPropagation()
              const v = parseInt(e.target.value, 10)
              if (!isNaN(v)) onQtyChange(Math.max(1, Math.min(v, 99)))
            }}
            className="w-9 h-7 text-center text-[13px] font-bold rounded border border-border bg-surface-raised text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:ring-1 focus:ring-accent-gold/50"
            aria-label="Cantidad"
          />
          <button
            onClick={e => { e.stopPropagation(); onQtyChange(Math.min(99, qty + 1)) }}
            className="h-7 w-7 rounded border border-border bg-surface-raised text-muted-foreground hover:border-accent-blue/50 hover:text-accent-blue transition-colors flex items-center justify-center"
            aria-label="Aumentar cantidad"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Add to deck button — singleton/copy-limit rules are guidance, never a
            hard block, so this stays clickable and just warns in amber */}
        <button
          onClick={e => { e.stopPropagation(); onAdd(card, qty) }}
          title={isSingletonWarning ? "Este formato pide copia única — se agregará de todos modos" : undefined}
          aria-label={isSingletonWarning ? `Agregar ${qty} copia(s) más (supera el límite de copia única)` : isInDeck ? `Agregar ${qty} copia(s) más` : `Agregar ${qty} al mazo`}
          className={`h-8 w-full min-w-[96px] px-3 rounded-lg border text-[12.5px] font-bold transition-all flex items-center justify-center gap-1.5 ${
            isSingletonWarning
              ? "border-amber-400/60 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-400/80"
              : isInDeck
              ? "border-accent-gold/50 text-accent-gold bg-accent-gold/10 hover:bg-accent-gold/20 hover:border-accent-gold/70"
              : "border-border text-muted-foreground hover:border-accent-gold/60 hover:text-accent-gold hover:bg-accent-gold/10"
          }`}
        >
          {isSingletonWarning
            ? <><AlertCircle className="h-3.5 w-3.5" /> Agregar</>
            : isInDeck
            ? <><Check className="h-3.5 w-3.5" /> Agregar más</>
            : <><Plus className="h-3.5 w-3.5" /> Agregar</>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Search Panel ─────────────────────────────────────────────────────────────

interface SearchPanelProps {
  formatConfig?: GameFormatConfig
  deckIds: Set<string>
  /** Local id of the deck being built — used to scope custom-upload quotas server-side */
  deckId?: string
  onAddCard: (card: ScryfallCard, qty?: number) => void
  onViewDetail: (card: ScryfallCard) => void
  onOpenImport?: (prefillText?: string) => void
  initialQuery?: string
  /** When false (default), rule-breaking cards are highlighted and adding one opens a
   *  confirmation popup with the reason. When true, free mode — no warnings at all. */
  relaxedRules?: boolean
}

function isSingletonFormat(cfg?: GameFormatConfig): boolean {
  return (cfg?.maxCopies ?? Infinity) === 1
}

/** Basic lands are always exempt from singleton restrictions */
function isBasicLand(card: ScryfallCard): boolean {
  const typeLine = (card.type_line ?? "").toLowerCase()
  return typeLine.includes("basic") && typeLine.includes("land")
}
/** Any land card (basic or nonbasic) */
function isLand(card: ScryfallCard): boolean {
  return (card.type_line ?? "").toLowerCase().includes("land")
}
/** Basics are always exempt from singleton; in Commander, any land is exempt too; custom uploads always are */
function isSingletonExempt(card: ScryfallCard, cfg?: GameFormatConfig): boolean {
  if (card.isCustomUpload) return true
  return isBasicLand(card) || (cfg?.key === "commander" && isLand(card))
}

// ─── Upload Tab ───────────────────────────────────────────────────────────────

interface UploadItem {
  key: string
  file: File
  previewUrl: string
  status: "compressing" | "uploading" | "done" | "error"
  error?: string
}

const MAX_CONCURRENT_UPLOADS = 3

function UploadTab({ deckId, onAddCard }: { deckId?: string; onAddCard: (card: ScryfallCard, qty?: number) => void }) {
  const { user, loading: authLoading } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const queueRef = useRef<UploadItem[]>([])
  const activeCountRef = useRef(0)

  const processNext = useCallback(() => {
    while (activeCountRef.current < MAX_CONCURRENT_UPLOADS && queueRef.current.length > 0) {
      const item = queueRef.current.shift()
      if (!item) break
      activeCountRef.current += 1
      void uploadOne(item).finally(() => {
        activeCountRef.current -= 1
        processNext()
      })
    }
  }, [])

  const uploadOne = async (item: UploadItem) => {
    try {
      const { blob } = await compressCardImage(item.file)
      setItems(prev => prev.map(i => (i.key === item.key ? { ...i, status: "uploading" } : i)))

      const formData = new FormData()
      formData.append("file", blob, item.file.name)
      if (deckId) formData.append("deckId", deckId)
      formData.append("cardName", item.file.name.replace(/\.[^/.]+$/, ""))

      const res = await fetch("/api/custom-cards/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir la imagen")

      setItems(prev => prev.map(i => (i.key === item.key ? { ...i, status: "done" } : i)))

      const syntheticCard: ScryfallCard = {
        id: `custom:${data.id}`,
        name: item.file.name.replace(/\.[^/.]+$/, "") || "Carta propia",
        layout: "normal",
        set: "custom",
        set_name: "Cartas propias",
        collector_number: "0",
        image_uris: { normal: data.url, small: data.url, large: data.url },
        isCustomUpload: true,
      }
      onAddCard(syntheticCard, 1)

      // Remove from the visible queue shortly after success so the list stays tidy
      setTimeout(() => {
        setItems(prev => prev.filter(i => i.key !== item.key))
      }, 1500)
    } catch (err) {
      setItems(prev =>
        prev.map(i => (i.key === item.key ? { ...i, status: "error", error: (err as Error).message } : i)),
      )
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const next: UploadItem[] = []
    for (const file of Array.from(files)) {
      const validationError = validateCardImageFile(file)
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`
      next.push({
        key,
        file,
        previewUrl: URL.createObjectURL(file),
        status: validationError ? "error" : "compressing",
        error: validationError ?? undefined,
      })
    }
    setItems(prev => [...prev, ...next])
    const queueable = next.filter(i => i.status !== "error")
    queueRef.current.push(...queueable)
    processNext()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  if (authLoading) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div className="h-12 w-12 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
          <ImagePlus className="h-5 w-5 text-accent-blue" />
        </div>
        <p className="text-sm font-bold text-foreground">Iniciá sesión para subir tus imágenes</p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
          Guardamos tus cartas propias en tu cuenta para poder imprimirlas y evitar que se pierdan.
        </p>
        <Button
          onClick={() => setShowAuthModal(true)}
          size="sm"
          className="mt-1 rounded-xl bg-accent-blue text-white hover:bg-accent-blue/90"
        >
          <LogIn className="h-3.5 w-3.5 mr-1.5" />
          Iniciar sesión
        </Button>
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            reason="Iniciá sesión o creá una cuenta para subir tus propias imágenes de cartas."
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3">
      <label
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="shrink-0 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-accent-blue/50 bg-surface-raised/40 hover:bg-accent-blue/5 transition-colors cursor-pointer py-8 px-4 text-center"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = "" }}
        />
        <Upload className="h-6 w-6 text-muted-foreground/60" />
        <p className="text-sm font-semibold text-foreground">Arrastrá una imagen o tocá para elegir</p>
        <p className="text-xs text-muted-foreground/70">Se recorta automáticamente al tamaño de una carta</p>
      </label>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(item => (
            <div
              key={item.key}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
                item.status === "error" ? "border-red-500/40 bg-red-950/10" : "border-border bg-card",
              )}
            >
              <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden bg-surface-raised">
                <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[12px] font-medium text-foreground">{item.file.name}</p>
                {item.status === "error" ? (
                  <p className="truncate text-[10px] text-red-400">{item.error}</p>
                ) : (
                  <p className="truncate text-[10px] text-muted-foreground">
                    {item.status === "compressing" && "Comprimiendo..."}
                    {item.status === "uploading" && "Subiendo..."}
                    {item.status === "done" && "Agregada al mazo"}
                  </p>
                )}
              </div>
              {item.status === "done" ? (
                <Check className="h-4 w-4 shrink-0 text-accent-gold" />
              ) : item.status === "error" ? (
                <button
                  onClick={() => setItems(prev => prev.filter(i => i.key !== item.key))}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Descartar"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 text-muted-foreground animate-spin" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SearchPanel({ deckIds, deckId, onAddCard, onViewDetail, onOpenImport, initialQuery = "", formatConfig, relaxedRules = false }: SearchPanelProps) {
  const [activeTab, setActiveTab] = useState<"search" | "upload">("search")
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<ScryfallCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextPage, setNextPage] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cardQtys, setCardQtys] = useState<Record<string, number>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Rule-violation interception — when a card breaks the active format's rules,
  // adding it opens a confirm popup instead of silently adding it. Purely
  // guidance: "Agregar igual" always proceeds. Skipped entirely in relaxed mode.
  const [pendingViolation, setPendingViolation] = useState<{ card: ScryfallCard; qty: number; reason: string } | null>(null)
  const requestAdd = useCallback((card: ScryfallCard, qty: number = 1) => {
    if (!relaxedRules) {
      const alreadyInDeck = deckIds.has(card.oracle_id ?? card.name)
      const reason = getRuleViolationReason(card, formatConfig, { alreadyInDeck, isCommanderFormat: formatConfig?.key === "commander" })
      if (reason) {
        setPendingViolation({ card, qty, reason })
        return
      }
    }
    onAddCard(card, qty)
  }, [relaxedRules, deckIds, formatConfig, onAddCard])

  // Close the mobile actions menu on any outside tap
  useEffect(() => {
    if (!menuOpen) return
    function handler(e: Event) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [menuOpen])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (!onOpenImport) return
      const pasted = e.clipboardData.getData("text")
      if (looksLikeDeckList(pasted)) {
        e.preventDefault()
        onOpenImport(pasted)
      }
    },
    [onOpenImport]
  )

  function getQty(card: ScryfallCard) {
    return cardQtys[card.id] ?? 1
  }
  function setQty(card: ScryfallCard, v: number) {
    setCardQtys(prev => ({ ...prev, [card.id]: Math.max(1, Math.min(v, 99)) }))
  }

  const doSearch = useCallback(async (q: string, pageUrl?: string) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // unique=cards gives one result per card name — much faster and cleaner
    // Art variant selection happens in the detail modal via prints_search_uri
    const url = pageUrl
      ? pageUrl
      : `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=name&unique=cards`

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        if (res.status === 404) {
          setResults([])
          setError("No se encontraron cartas con ese nombre.")
          setHasMore(false)
          setNextPage(null)
          setLoading(false)
          return
        }
        throw new Error(`Error ${res.status}`)
      }
      const data: ScryfallSearchResponse = await res.json()
      if (pageUrl) {
        setResults((prev) => [...prev, ...data.data])
      } else {
        setResults(data.data)
      }
      setHasMore(data.has_more)
      setNextPage(data.next_page ?? null)
      setError(null)
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setError("Error al conectar con Scryfall. Intentá de nuevo.")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      // Cancel any pending request and reset state immediately
      if (abortRef.current) abortRef.current.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setResults([])
      setError(null)
      setHasMore(false)
      setNextPage(null)
      setLoading(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    setResults([])
    setError(null)
    debounceRef.current = setTimeout(() => {
      doSearch(query.trim())
    }, 220)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch])

  const loadMore = async () => {
    if (!nextPage) return
    setLoadingMore(true)
    await doSearch(query, nextPage)
    setLoadingMore(false)
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden min-h-0">
      {/* Segmented control: Buscar / Subir imagen */}
      <div className="shrink-0 flex items-center gap-1 rounded-xl bg-surface-raised border border-border p-1">
        <button
          onClick={() => setActiveTab("search")}
          className={cn(
            "flex-1 h-8 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5",
            activeTab === "search" ? "bg-accent-gold text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Search className="h-3.5 w-3.5" />
          Buscar
        </button>
        <button
          onClick={() => setActiveTab("upload")}
          className={cn(
            "flex-1 h-8 rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5",
            activeTab === "upload" ? "bg-accent-gold text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Subir imagen
        </button>
      </div>

      {activeTab === "upload" && <UploadTab deckId={deckId} onAddCard={onAddCard} />}

      {activeTab === "search" && (
      <>
      {/* Search input + filter + import buttons */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPaste={handlePaste}
            placeholder="Buscar"
            className="pl-9 pr-4 bg-surface-raised border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-accent-gold/50 focus-visible:border-accent-gold/50 rounded-xl h-10"
            aria-label="Buscar cartas de Magic"
          />
        </div>
        {/* Import button — desktop only */}
        {onOpenImport && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenImport()}
            className="hidden sm:flex h-10 px-3 shrink-0 rounded-xl border-border text-muted-foreground hover:text-foreground hover:border-accent-gold/50"
            title="Importar lista de mazo"
            aria-label="Importar lista de mazo"
          >
            <FileUp className="h-4 w-4" />
          </Button>
        )}
        {/* Filter button — desktop only */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(true)}
          className="hidden sm:flex h-10 px-3 shrink-0 rounded-xl border-border text-muted-foreground hover:text-foreground hover:border-accent-gold/50"
          title="Búsqueda avanzada"
          aria-label="Abrir búsqueda avanzada"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>

        {/* Mobile-only overflow — three-dots opens the actions as a list */}
        <div ref={menuRef} className="relative sm:hidden shrink-0">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={cn(
              "h-10 w-10 flex items-center justify-center rounded-xl border transition-colors",
              menuOpen
                ? "border-accent-gold/60 bg-accent-gold/10 text-accent-gold"
                : "border-border bg-surface-raised text-muted-foreground hover:text-foreground hover:border-accent-gold/50"
            )}
            aria-label="Más opciones de búsqueda"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-52 rounded-2xl border border-border bg-card shadow-2xl shadow-black/60 overflow-hidden"
            >
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); setShowAdvanced(true) }}
                className="w-full min-h-12 flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-surface-raised active:bg-surface-raised transition-colors text-left"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">Búsqueda avanzada</span>
              </button>
              {onOpenImport && (
                <button
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onOpenImport() }}
                  className="w-full min-h-12 flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-surface-raised active:bg-surface-raised transition-colors text-left border-t border-border/40"
                >
                  <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">Importar lista</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showAdvanced && (
        <AdvancedSearchModal
          onSearch={(q) => setQuery(q)}
          onClose={() => setShowAdvanced(false)}
        />
      )}

      {/* Hint — desktop only */}
      {!query.trim() && (
        <p className="hidden sm:flex text-[11px] text-muted-foreground/60 px-1 items-center gap-1.5 flex-wrap">
          <span>Tip: filtros Scryfall —</span>
          <code className="font-mono text-muted-foreground">t:instant</code>
          <code className="font-mono text-muted-foreground">c:u</code>
          <code className="font-mono text-muted-foreground">r:rare</code>
          <a
            href="/mtg/syntax"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-accent-gold/80 hover:text-accent-gold transition-colors font-medium"
          >
            Ver sintaxis <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </p>
      )}

      {/* Results area */}

      {/* Mobile: horizontal card image carousel */}
      <div className="sm:hidden flex-shrink-0 space-y-2">
        <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {loading && (
            <div className="flex gap-2 pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[104px] h-[145px] rounded-lg bg-surface-raised animate-pulse" />
              ))}
            </div>
          )}
          {!loading && results.length > 0 && (
            <div className="flex gap-2 pb-2">
            {results.map((card) => {
              const img = getCardImage(card)
              const alreadyInDeck = deckIds.has(card.oracle_id ?? card.name)
              const singleton = isSingletonFormat(formatConfig)
              // Guidance only — never blocks adding, just flags with an amber ring
              const isSingletonWarning = singleton && alreadyInDeck && !isSingletonExempt(card, formatConfig)
              const legalityKey = formatConfig?.legalityKey
              const isIllegal = legalityKey
                ? (card.legalities?.[legalityKey] !== undefined && card.legalities?.[legalityKey] !== "legal")
                : false
              return (
                // Outer wrapper is a div (not a button) because it contains its own
                // nested "Agregar" button — a <button> inside a <button> is invalid
                // HTML and causes a hydration mismatch.
                <div
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onViewDetail(card)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewDetail(card) } }}
                  className={cn(
                    "relative shrink-0 w-[104px] h-[145px] rounded-lg overflow-hidden border transition-all active:scale-95 cursor-pointer",
                    isSingletonWarning
                      ? "border-amber-400/60 ring-1 ring-amber-400/40"
                      : alreadyInDeck ? "border-accent-blue/60 ring-1 ring-accent-blue/40" : "border-border/40",
                    isIllegal && "opacity-50"
                  )}
                >
                  {img
                    ? <img src={img} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full bg-surface-raised flex items-center justify-center">
                        <Search className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                  }
                  {alreadyInDeck && (
                    <div className={cn("absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center", isSingletonWarning ? "bg-amber-500" : "bg-accent-blue")}>
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); requestAdd(card, 1) }}
                    disabled={isIllegal && !alreadyInDeck}
                    className={cn(
                      "absolute bottom-0 inset-x-0 h-7 flex items-center justify-center text-white text-[10px] font-bold gap-0.5 transition-colors disabled:opacity-40",
                      isSingletonWarning ? "bg-amber-600/80 hover:bg-amber-500/90" : "bg-black/70 hover:bg-accent-blue/80"
                    )}
                  >
                    <Plus className="h-3 w-3" /> Agregar
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {!loading && !error && results.length === 0 && query.trim() && (
          <p className="text-xs text-muted-foreground/60 py-2 px-1">Sin resultados para &ldquo;{query}&rdquo;</p>
        )}
        {!loading && !query.trim() && (
          <div className="flex items-center gap-2 py-3 px-1 text-muted-foreground/50">
            <Search className="h-4 w-4 shrink-0 opacity-40" />
            <p className="text-xs">Buscá cartas por nombre</p>
          </div>
        )}
        </div>
        
        {/* Carousel scroll indicator */}
        {!loading && results.length > 0 && (
          <div className="flex items-center justify-between px-1 py-1">
            <p className="text-[10px] text-muted-foreground/50 font-medium">Desliza para ver más</p>
            <div className="flex gap-1">
              <div className="animate-pulse">
                <ChevronRight className="h-3 w-3 text-accent-gold/60" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: vertical scrollable list */}
      <div
        className="hidden sm:block flex-1 overflow-y-auto min-h-0 pr-0.5"
        style={{ scrollbarGutter: "stable" }}
        onWheel={e => e.stopPropagation()}
      >
        <div className="space-y-2 pb-4">
        {/* Skeleton loaders while fetching */}
        {loading && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && results.length === 0 && query.trim() && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Sin resultados para &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Welcome state */}
        {!query.trim() && !loading && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Search className="mx-auto mb-3 h-9 w-9 opacity-20" />
            <p className="font-medium">Buscá cartas por nombre</p>
            <p className="mt-1 text-xs opacity-60">Cliqueá una carta para ver su detalle, artes alternativos y agregarla al mazo</p>
          </div>
        )}

        {/* Results */}
        {!loading && results.map((card) => {
          const legalityKey = formatConfig?.legalityKey
          const isIllegal = legalityKey
            ? (card.legalities?.[legalityKey] !== undefined && card.legalities?.[legalityKey] !== "legal")
            : false
          const singleton = isSingletonFormat(formatConfig)
          const alreadyInDeck = deckIds.has(card.oracle_id ?? card.name)
          // Basic lands (and, in Commander, any land) are always exempt from singleton.
          // This is guidance only — never blocks adding another copy, just flags it.
          const isSingletonWarning = singleton && alreadyInDeck && !isSingletonExempt(card, formatConfig)
          return (
            <CardResult
              key={card.id}
              card={card}
              isInDeck={alreadyInDeck}
              qty={getQty(card)}
              onQtyChange={(v) => setQty(card, v)}
              onAdd={(c, q) => { requestAdd(c, q ?? 1); setQty(c, 1) }}
              onViewDetail={onViewDetail}
              isIllegal={isIllegal}
              isSingletonWarning={isSingletonWarning}
            />
          )
        })}

        {/* Load more */}
        {!loading && hasMore && (
          <div className="pt-2 pb-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-border text-muted-foreground hover:text-foreground hover:border-accent-gold/50"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
                  Cargando...
                </>
              ) : (
                "Cargar más resultados"
              )}
            </Button>
          </div>
        )}
        </div>{/* end inner pb-4 wrapper */}
      </div>
      </>
      )}

      {/* Rule-violation confirm popup — appears when adding a card that breaks
          the active format's rules; "Agregar igual" always proceeds. */}
      {pendingViolation && (
        <RuleWarningDialog
          reason={pendingViolation.reason}
          onClose={() => setPendingViolation(null)}
          onConfirm={() => onAddCard(pendingViolation.card, pendingViolation.qty)}
        />
      )}
    </div>
  )
}
