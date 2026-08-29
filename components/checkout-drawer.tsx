"use client"

import { useEffect } from "react"
import { X, ArrowLeft } from "lucide-react"
import { StepCheckout } from "@/components/steps/step-checkout"
import type { MaterialId, PackSize } from "@/lib/materials"
import type { PrintListEntry, DeckMode } from "@/types/scryfall"

interface CheckoutDrawerProps {
  open: boolean
  mode: DeckMode
  materialId: MaterialId
  packSize: PackSize
  entries: PrintListEntry[]
  totalCards: number
  onClose: () => void
}

export function CheckoutDrawer({
  open,
  mode,
  materialId,
  packSize,
  entries,
  totalCards,
  onClose,
}: CheckoutDrawerProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Finalizar pedido"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="relative z-10 flex flex-col w-full max-w-2xl bg-background border-l border-border shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-border bg-background">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Volver al mazo"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al mazo
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-all"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <StepCheckout
            mode={mode}
            packSize={packSize}
            materialId={materialId}
            entries={entries}
            totalCards={totalCards}
          />
        </div>
      </div>
    </div>
  )
}
