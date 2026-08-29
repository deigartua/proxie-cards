"use client"

import { AlertTriangle, X } from "lucide-react"

export interface RuleWarningDialogProps {
  /** Human-readable explanation of why the card breaks the active format's rules. */
  reason: string
  onClose: () => void
  /**
   * When provided, renders a two-button confirm flow ("Cancelar" / "Agregar
   * igual") — used when the warning interrupts an add action. When omitted,
   * renders a single dismiss button — used for the info-only warning button
   * on a card already in the deck.
   */
  onConfirm?: () => void
  confirmLabel?: string
  /** Heading text. Defaults to the format-rules-violation wording. */
  title?: string
}

/**
 * Shared non-blocking rule-violation popup. Format rules are guidance, not
 * enforcement — this dialog explains why a card doesn't fit the active
 * format, then either lets the user dismiss it or proceed anyway.
 */
export function RuleWarningDialog({ reason, onClose, onConfirm, confirmLabel = "Agregar igual", title = "No es una carta permitida" }: RuleWarningDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Advertencia de reglas del formato"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-amber-500/30 bg-card shadow-2xl shadow-black/70 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="p-5 flex flex-col gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">{reason}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            {onConfirm ? "Cancelar" : "Entendido"}
          </button>
          {onConfirm && (
            <button
              onClick={() => { onConfirm(); onClose() }}
              className="flex-1 h-10 rounded-xl bg-amber-500 text-background text-sm font-bold hover:bg-amber-400 transition-colors"
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
