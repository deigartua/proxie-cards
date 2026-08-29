"use client"

import { MATERIALS, getPackPrice, formatARS, type PackSize, PACK_SIZES } from "@/lib/materials"
import { cn } from "@/lib/utils"
import { Check, Sparkles } from "lucide-react"

interface StepMaterialProps {
  cards: number
  selected: string | null
  onSelect: (id: string) => void
}

const BADGE_STYLE: Record<string, string> = {
  Recomendado: "bg-accent-gold/20 text-accent-gold border border-accent-gold/30",
  Premium:     "bg-purple-500/20 text-purple-300 border border-purple-500/30",
}

const MATERIAL_ICON: Record<string, string> = {
  "standard-mate":     "M",
  "standard-brillante":"B",
  "foil-230":          "F",
}

export function StepMaterial({ cards, selected, onSelect }: StepMaterialProps) {
  // cards is always a valid PackSize (15, 60 or 100) since step 1 now only offers those
  const packSize = PACK_SIZES.includes(cards as PackSize) ? (cards as PackSize) : PACK_SIZES[0]
  const selectedMaterial = MATERIALS.find((m) => m.id === selected)
  const selectedPrice = selected ? getPackPrice(selected, packSize) : 0

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto gap-6 py-4 px-4">
      <div className="text-center space-y-1.5">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          Elegí el material
        </h2>
        <p className="text-sm text-muted-foreground">
          Para{" "}
          <span className="font-semibold text-foreground">{cards} cartas</span>
          {" "}— el precio varía según el acabado elegido
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MATERIALS.map((mat) => {
          const isSelected = selected === mat.id
          const price = getPackPrice(mat.id, packSize)
          const icon = MATERIAL_ICON[mat.id] ?? "?"

          return (
            <button
              key={mat.id}
              onClick={() => onSelect(mat.id)}
              className={cn(
                "relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
                isSelected
                  ? "border-accent-gold bg-accent-gold/5 shadow-lg shadow-accent-gold/10"
                  : "border-border bg-surface hover:border-border/70 hover:bg-surface-raised",
              )}
            >
              {/* Header: icon + name */}
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black border",
                  isSelected
                    ? "bg-accent-gold/20 border-accent-gold/40 text-accent-gold"
                    : "bg-surface-raised border-border text-muted-foreground",
                )}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm leading-tight">{mat.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mat.subtitle}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">{mat.description}</p>

              {/* Specs */}
              <ul className="space-y-1">
                {mat.specs.map((s) => (
                  <li key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("h-1 w-1 rounded-full shrink-0", isSelected ? "bg-accent-gold" : "bg-muted-foreground/50")} />
                    {s}
                  </li>
                ))}
              </ul>

              {/* Pricing */}
              <div className={cn("mt-auto pt-3 border-t flex items-baseline justify-between", isSelected ? "border-accent-gold/20" : "border-border")}>
                <span className="text-xs text-muted-foreground">Pack {packSize}</span>
                <span className={cn("text-base font-extrabold tabular-nums", isSelected ? "text-accent-gold" : "text-foreground")}>
                  {formatARS(price)}
                </span>
              </div>

              {/* Selected check */}
              {isSelected && (
                <div className="absolute top-3 left-3 h-5 w-5 rounded-full bg-accent-gold flex items-center justify-center shadow-md">
                  <Check className="h-3 w-3 text-surface" strokeWidth={3} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Summary strip */}
      {selectedMaterial && (
        <div className="rounded-xl border border-accent-gold/30 bg-accent-gold/5 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {selectedMaterial.name} · {selectedMaterial.subtitle}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pack {packSize} · {cards} cartas
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold text-accent-gold tabular-nums">
              {formatARS(selectedPrice)}
            </p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
        </div>
      )}
    </div>
  )
}
