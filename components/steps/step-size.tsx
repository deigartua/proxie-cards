"use client"

import { Sparkles, FileText, Layers, PenLine, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PACK_SIZES,
  MATERIALS,
  formatARS,
  getPackPrice,
  type PackSize,
  type MaterialId,
} from "@/lib/materials"
import type { DeckMode } from "@/types/scryfall"

interface StepSizeProps {
  mode: DeckMode
  packSize: PackSize
  materialId: MaterialId
  onSelectMode: (mode: DeckMode) => void
  onSelectPack: (size: PackSize) => void
  onSelectMaterial: (id: MaterialId) => void
}

const MATERIAL_ICONS: Record<MaterialId, React.ReactNode> = {
  sat300: <Layers className="h-4 w-4" />,
}

// Single material available
const MATERIAL_ORDER: MaterialId[] = ["sat300"]

const PACK_LABELS: Partial<Record<PackSize, string>> = {
  60: "Recomendado",
}

export function StepSize({ mode, packSize, materialId, onSelectMode, onSelectPack, onSelectMaterial }: StepSizeProps) {
  // Sort materials cheapest→most expensive for display
  const sortedMaterials = MATERIAL_ORDER
    .map(id => MATERIALS.find(m => m.id === id))
    .filter(Boolean) as typeof MATERIALS

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

      {/* ── Mode selector ── */}
      <div>
        <h2 className="text-center text-2xl font-extrabold text-foreground tracking-tight mb-5">
          ¿Qué querés imprimir?
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelectMode("custom")}
            className={cn(
              "flex flex-col items-center gap-3 rounded-2xl border-2 px-4 py-6 text-center transition-all",
              mode === "custom"
                ? "border-accent-gold bg-accent-gold/10 shadow-lg shadow-accent-gold/10"
                : "border-border bg-surface hover:border-border/70 hover:bg-surface-raised",
            )}
          >
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border",
              mode === "custom"
                ? "bg-accent-gold/20 border-accent-gold/40 text-accent-gold"
                : "bg-surface-raised border-border text-muted-foreground",
            )}>
              <PenLine className="h-5 w-5" />
            </div>
            <div>
              <p className={cn("font-bold text-sm", mode === "custom" ? "text-accent-gold" : "text-foreground")}>
                Cartas personalizadas
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Armá tu mazo carta por carta</p>
            </div>
          </button>

          <button
            onClick={() => onSelectMode("precon")}
            className={cn(
              "flex flex-col items-center gap-3 rounded-2xl border-2 px-4 py-6 text-center transition-all",
              mode === "precon"
                ? "border-accent-gold bg-accent-gold/10 shadow-lg shadow-accent-gold/10"
                : "border-border bg-surface hover:border-border/70 hover:bg-surface-raised",
            )}
          >
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border",
              mode === "precon"
                ? "bg-accent-gold/20 border-accent-gold/40 text-accent-gold"
                : "bg-surface-raised border-border text-muted-foreground",
            )}>
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className={cn("font-bold text-sm", mode === "precon" ? "text-accent-gold" : "text-foreground")}>
                Mazo preconstruido
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Elegí un mazo oficial de Magic</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Pack sizes (only in custom mode) ── */}
      {mode === "custom" && (
        <div>
          <h2 className="text-center text-xl font-extrabold text-foreground tracking-tight mb-5">
            ¿Cuántas cartas querés imprimir?
          </h2>
          {/* pt-4 gives room for the absolute badge above the selected card */}
          <div className="grid grid-cols-3 gap-3 pt-4 pb-1">
            {PACK_SIZES.map((size) => {
              const price = getPackPrice(materialId, size)
              const isSelected = packSize === size
              const packBadge = PACK_LABELS[size]
              return (
                <button
                  key={size}
                  onClick={() => onSelectPack(size)}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-2xl border-2 px-3 py-6 transition-all overflow-visible",
                    isSelected
                      ? "border-accent-gold bg-accent-gold/10 shadow-lg shadow-accent-gold/10"
                      : "border-border bg-surface hover:border-border/70 hover:bg-surface-raised",
                  )}
                >
                  {packBadge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-accent-gold text-surface whitespace-nowrap shadow-sm">
                      {packBadge}
                    </span>
                  )}
                  <span className={cn(
                    "text-5xl font-black tabular-nums leading-none",
                    isSelected ? "text-accent-gold" : "text-foreground"
                  )}>
                    {size}
                  </span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    cartas
                  </span>
                  <span className={cn(
                    "mt-3 text-sm font-semibold tabular-nums",
                    isSelected ? "text-accent-gold" : "text-muted-foreground"
                  )}>
                    {formatARS(price)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Materials — horizontal 3-col grid (always visible) ── */}
      <div>
        <h3 className="text-center text-base font-bold text-foreground mb-3">
          Material de impresión
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {sortedMaterials.map((mat) => {
            const price = getPackPrice(mat.id, packSize)
            // Unit price (from 100-card tier) for precon mode display
            const unitPrice = mat.packPrices.find(p => p.size === 100)!.price / 100
            const isSelected = materialId === mat.id
            return (
              <button
                key={mat.id}
                onClick={() => onSelectMaterial(mat.id as MaterialId)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 px-3 py-5 text-center transition-all",
                  isSelected
                    ? "border-accent-gold bg-accent-gold/10 shadow-lg shadow-accent-gold/10"
                    : "border-border bg-surface hover:border-border/70 hover:bg-surface-raised",
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl border",
                  isSelected
                    ? "bg-accent-gold/20 border-accent-gold/40 text-accent-gold"
                    : "bg-surface-raised border-border text-muted-foreground",
                )}>
                  {MATERIAL_ICONS[mat.id as MaterialId]}
                </div>

                {/* Name */}
                <p className={cn("font-bold text-sm leading-tight", isSelected ? "text-accent-gold" : "text-foreground")}>
                  {mat.name}
                </p>

                {/* Subtitle */}
                <p className="text-[10px] text-muted-foreground leading-snug -mt-1.5">{mat.subtitle}</p>

                {/* Price */}
                {mode === "precon" ? (
                  <p className={cn("text-xs font-bold tabular-nums", isSelected ? "text-accent-gold" : "text-muted-foreground")}>
                    {formatARS(Math.round(unitPrice))}<span className="font-normal opacity-70">/carta</span>
                  </p>
                ) : (
                  <p className={cn("text-base font-extrabold tabular-nums", isSelected ? "text-accent-gold" : "text-muted-foreground")}>
                    {formatARS(price)}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
