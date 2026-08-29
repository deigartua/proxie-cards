"use client"

import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ShoppingBag, ChevronRight } from "lucide-react"
import { usePrintStore } from "@/providers/print-store-provider"
import { getPriceForCount, formatARS, PACK_SIZES } from "@/lib/materials"
import { cn } from "@/lib/utils"

/**
 * A slim persistent cart bar pinned to the bottom of every page
 * EXCEPT /builder, where the full CartPanel is already visible.
 */
export function GlobalCartBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { totalCards, entries } = usePrintStore()

  // Hide on the builder page — the full CartPanel is there already
  if (pathname?.startsWith("/builder")) return null

  // Don't render anything if cart is empty
  if (totalCards === 0) return null

  const total = getPriceForCount("300gr-mate", totalCards)
  const MIN = 15
  const nextTier = PACK_SIZES.find((s) => s > totalCards) ?? null
  const progressPct = nextTier
    ? Math.min((totalCards / nextTier) * 100, 100)
    : 100
  const missingForMin = Math.max(0, MIN - totalCards)

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-50",
        "bg-background border-t border-border shadow-xl shadow-black/[0.06]",
      )}
      role="complementary"
      aria-label="Carrito de compras"
    >
      {/* Progress bar — thin line at very top of the bar */}
      <div className="h-0.5 w-full bg-border overflow-hidden">
        <div
          className="h-full bg-accent-gold transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <button
        onClick={() => router.push("/builder")}
        className="w-full flex items-center gap-4 px-4 py-2.5 hover:bg-surface/60 transition-colors"
      >
        {/* Left: icon + count */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <ShoppingBag className="h-4.5 w-4.5 text-foreground" />
            <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full bg-accent-gold text-background text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
              {totalCards}
            </span>
          </div>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {totalCards} {totalCards === 1 ? "carta" : "cartas"}
          </span>
        </div>

        {/* Center: progress label */}
        <div className="flex-1 text-center">
          {missingForMin > 0 ? (
            <span className="text-xs text-muted-foreground">
              Faltan{" "}
              <span className="font-bold text-accent-gold">{missingForMin}</span>{" "}
              para el Pack 15
            </span>
          ) : nextTier ? (
            <span className="text-xs text-muted-foreground">
              Faltan{" "}
              <span className="font-bold text-accent-gold">{nextTier - totalCards}</span>{" "}
              para Pack {nextTier}
            </span>
          ) : (
            <span className="text-xs text-accent-gold font-semibold">Pack completo</span>
          )}
        </div>

        {/* Right: total + CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {totalCards >= MIN && (
            <span className="text-sm font-extrabold text-foreground tabular-nums">
              {formatARS(total)}
            </span>
          )}
          <div className="flex items-center gap-1 rounded-full bg-foreground text-background text-xs font-bold px-3 py-1.5">
            Abrir mazo
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </button>
    </div>
  )
}
