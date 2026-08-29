"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { X, Upload, AlertCircle, CheckCircle2, Loader2, FileText, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { parseDeckText, resolveEntries, type ResolvedEntry } from "@/lib/deck-import"
import type { ScryfallCard } from "@/types/scryfall"

interface ImportDeckModalProps {
  onClose: () => void
  onImport: (cards: { card: ScryfallCard; quantity: number }[], replace: boolean) => void
  initialText?: string
}

type Phase = "input" | "resolving" | "preview"

const FORMAT_EXAMPLES = [
  {
    label: "MTGO / Plain Text",
    example: "1 Sol Ring\n1 Lightning Bolt\n20 Forest",
  },
  {
    label: "Moxfield",
    example: "1 Sol Ring (2XM) 274\n1 Lightning Bolt (M11) 149 *F*",
  },
  {
    label: "Arena",
    example: "About\nName Mi Mazo\n\nDeck\n1 Sol Ring\n1 Lightning Bolt\n\nSideboard\n1 Counterspell",
  },
]

export function ImportDeckModal({ onClose, onImport, initialText = "" }: ImportDeckModalProps) {
  const [text, setText] = useState(initialText)
  const [phase, setPhase] = useState<Phase>("input")
  const [progress, setProgress] = useState({ resolved: 0, total: 0 })
  const [results, setResults] = useState<Array<{ name: string; count: number; card: ScryfallCard | null; error?: string }>>([])
  const [resolvedCards, setResolvedCards] = useState<Array<{ name: string; img: string | null }>>([])
  const [deckName, setDeckName] = useState<string | null>(null)
  const [showFailed, setShowFailed] = useState(false)
  const [replaceExisting, setReplaceExisting] = useState(true)
  const abortRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setText(ev.target?.result as string ?? "")
    reader.readAsText(file)
  }, [])

  const handleResolve = useCallback(async () => {
    if (!text.trim()) return
    abortRef.current = false
    const { entries, deckName: parsedName } = parseDeckText(text)
    if (!entries.length) return
    setDeckName(parsedName)
    setProgress({ resolved: 0, total: entries.length })
    setResolvedCards([])
    setPhase("resolving")

    const resolved = await resolveEntries(entries, (done, total, last?: ResolvedEntry) => {
      if (!abortRef.current) {
        setProgress({ resolved: done, total })
        if (last?.card) {
          const img =
            last.card.image_uris?.small ??
            last.card.card_faces?.[0]?.image_uris?.small ??
            null
          setResolvedCards(prev => [...prev, { name: last.card!.name, img }])
        }
      }
    })

    if (!abortRef.current) {
      setResults(resolved)
      setPhase("preview")
    }
  }, [text])

  const handleConfirm = useCallback(() => {
    const valid = results
      .filter((r) => r.card !== null)
      .map((r) => ({ card: r.card!, quantity: r.count }))
    onImport(valid, replaceExisting)
    onClose()
  }, [results, replaceExisting, onImport, onClose])

  const handleCancel = useCallback(() => {
    abortRef.current = true
    setResolvedCards([])
    setPhase("input")
  }, [])

  const failed = results.filter((r) => !r.card)
  const succeeded = results.filter((r) => !!r.card)
  const totalCards = succeeded.reduce((s, r) => s + r.count, 0)
  const progressPct = progress.total > 0 ? Math.round((progress.resolved / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-xl flex flex-col"
        style={{ maxHeight: "90dvh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Importar lista de cartas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compatible con Moxfield, Arena, MTGO y texto plano
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Phase: input ── */}
          {phase === "input" && (
            <div className="p-5 flex flex-col gap-4">
              {/* Format examples */}
              <div className="grid grid-cols-3 gap-2">
                {FORMAT_EXAMPLES.map((fmt) => (
                  <button
                    key={fmt.label}
                    onClick={() => setText(fmt.example)}
                    className="text-left p-2.5 rounded-lg border border-border bg-surface hover:border-accent-gold/50 hover:bg-accent-gold/5 transition-colors group"
                  >
                    <span className="text-[10px] font-semibold text-accent-gold block mb-1">{fmt.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono leading-tight line-clamp-2">
                      {fmt.example.split("\n")[0]}...
                    </span>
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={"Pega aquí tu lista de cartas...\n\nEjemplos:\n1 Sol Ring\n1 Lightning Bolt (M11) 149\n4 Forest"}
                  className={cn(
                    "w-full h-48 resize-none rounded-lg border border-border bg-surface",
                    "text-sm font-mono text-foreground placeholder:text-muted-foreground",
                    "px-3 py-3 focus:outline-none focus:ring-1 focus:ring-accent-gold/50 focus:border-accent-gold/50"
                  )}
                  spellCheck={false}
                  autoComplete="off"
                />
                <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground pointer-events-none">
                  {text.split("\n").filter((l) => l.trim() && /^\d/.test(l.trim())).length} líneas
                </span>
              </div>

              {/* File upload */}
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept=".txt,.dec,.mwdeck" onChange={handleFile} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-accent-gold transition-colors border border-border rounded-lg px-3 py-2"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Cargar desde archivo (.txt, .dec)
                </button>
                <span className="text-xs text-muted-foreground">o pega el texto directamente</span>
              </div>

              {/* Replace / merge toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setReplaceExisting(!replaceExisting)}
                  className={cn(
                    "relative w-9 h-5 rounded-full transition-colors",
                    replaceExisting ? "bg-accent-gold" : "bg-surface border border-border"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    replaceExisting ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {replaceExisting ? "Reemplazar mazo actual" : "Agregar al mazo actual"}
                </span>
              </label>
            </div>
          )}

          {/* ── Phase: resolving ── */}
          {phase === "resolving" && (
            <div className="p-5 flex flex-col gap-4">
              {/* Header status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-accent-gold animate-spin shrink-0" />
                  <span className="text-sm font-medium text-foreground">Armando el mazo...</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {progress.resolved}/{progress.total}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-surface rounded-full h-1.5 border border-border overflow-hidden">
                <div
                  className="h-full bg-accent-gold transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Animated card grid */}
              <div
                className="grid gap-1.5 overflow-y-auto"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
                  maxHeight: "260px",
                }}
              >
                {resolvedCards.map((rc, i) => (
                  <div
                    key={i}
                    className="aspect-[63/88] rounded overflow-hidden bg-surface border border-border/50 animate-card-in"
                    style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
                    title={rc.name}
                  >
                    {rc.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={rc.img}
                        alt={rc.name}
                        className="w-full h-full object-cover"
                        loading="eager"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-raised flex items-center justify-center p-0.5">
                        <span className="text-[6px] text-muted-foreground text-center leading-tight line-clamp-3">{rc.name}</span>
                      </div>
                    )}
                  </div>
                ))}
                {/* Pending ghost slots */}
                {Array.from({ length: Math.max(0, progress.total - resolvedCards.length) }).map((_, i) => (
                  <div
                    key={`ghost-${i}`}
                    className="aspect-[63/88] rounded border border-dashed border-border/30 bg-surface/30"
                  />
                ))}
              </div>

              <button
                onClick={handleCancel}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors self-center"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* ── Phase: preview ── */}
          {phase === "preview" && (
            <div className="p-5 flex flex-col gap-4">
              {/* Summary */}
              <div className="rounded-lg border border-border bg-surface p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {succeeded.length} de {results.length} cartas encontradas
                  </p>
                  {deckName && (
                    <p className="text-xs text-muted-foreground mt-0.5">Deck: <span className="text-accent-gold">{deckName}</span></p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{totalCards} cartas en total (contando copias)</p>
                </div>
              </div>

              {/* Failed cards */}
              {failed.length > 0 && (
                <div className="rounded-lg border border-red-900/30 bg-red-950/20">
                  <button
                    onClick={() => setShowFailed(!showFailed)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left"
                  >
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                    <span className="text-sm font-medium text-red-300 flex-1">
                      {failed.length} {failed.length === 1 ? "carta no encontrada" : "cartas no encontradas"}
                    </span>
                    {showFailed ? <ChevronUp className="h-4 w-4 text-red-400" /> : <ChevronDown className="h-4 w-4 text-red-400" />}
                  </button>
                  {showFailed && (
                    <ul className="px-4 pb-3 flex flex-col gap-1">
                      {failed.map((r, i) => (
                        <li key={i} className="text-xs text-red-300 font-mono flex items-center gap-2">
                          <span className="text-red-500">×</span>
                          {r.count}x {r.name}
                          {r.error && <span className="text-red-500/60">({r.error})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Succeeded cards list */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-surface flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cartas a importar</span>
                </div>
                <ul className="max-h-52 overflow-y-auto divide-y divide-border">
                  {succeeded.map((r, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2">
                      {r.card?.image_uris?.small || r.card?.card_faces?.[0]?.image_uris?.small ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.card.image_uris?.small ?? r.card.card_faces?.[0]?.image_uris?.small}
                          alt={r.name}
                          className="h-8 w-6 object-cover rounded shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-8 w-6 rounded bg-surface shrink-0" />
                      )}
                      <span className="text-xs text-foreground flex-1 truncate">{r.card?.name ?? r.name}</span>
                      <span className="text-xs font-mono text-accent-gold shrink-0">×{r.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Replace toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setReplaceExisting(!replaceExisting)}
                  className={cn(
                    "relative w-9 h-5 rounded-full transition-colors",
                    replaceExisting ? "bg-accent-gold" : "bg-surface border border-border"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    replaceExisting ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {replaceExisting ? "Reemplazar mazo actual" : "Agregar al mazo actual"}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={phase === "preview" ? () => { setPhase("input"); setResults([]) } : onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {phase === "preview" ? "Volver" : "Cancelar"}
          </button>

          {phase === "input" && (
            <Button
              onClick={handleResolve}
              disabled={!text.trim()}
              className="bg-accent-gold text-white hover:bg-accent-gold/90 disabled:opacity-40 text-sm px-5 py-2"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar lista
            </Button>
          )}

          {phase === "preview" && (
            <Button
              onClick={handleConfirm}
              disabled={succeeded.length === 0}
              className="bg-accent-gold text-white hover:bg-accent-gold/90 disabled:opacity-40 text-sm px-5 py-2"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Cargar {totalCards} cartas al mazo
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
