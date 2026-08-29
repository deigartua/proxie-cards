"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Step {
  id: number
  label: string
  sublabel: string
}

const STEPS: Step[] = [
  { id: 1, label: "Pack",   sublabel: "" },
  { id: 2, label: "Mazo",   sublabel: "" },
  { id: 3, label: "Pedido", sublabel: "" },
]

interface StepIndicatorProps {
  currentStep: number
  /** Allow jumping back to a completed step */
  onStepClick?: (step: number) => void
}

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="Pasos del pedido" className="w-full">
      <ol className="flex items-center justify-center gap-0">
        {STEPS.map((step, idx) => {
          const isCompleted = step.id < currentStep
          const isActive    = step.id === currentStep
          const isLast      = idx === STEPS.length - 1
          const clickable   = isCompleted && onStepClick

          return (
            <li key={step.id} className="flex items-center">
              {/* Step node */}
              <button
                onClick={() => clickable && onStepClick(step.id)}
                disabled={!clickable}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-1.5 outline-none",
                  clickable ? "cursor-pointer" : "cursor-default"
                )}
              >
                {/* Circle */}
                <span
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
                    isCompleted && "border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[var(--background)]",
                    isActive    && "border-[var(--accent-gold)] bg-[var(--surface-raised)] text-[var(--accent-gold)] shadow-[0_0_12px_2px_oklch(0.76_0.16_72_/_0.35)]",
                    !isCompleted && !isActive && "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <span>{step.id}</span>
                  )}

                  {/* Active pulse ring */}
                  {isActive && (
                    <span className="absolute inset-0 rounded-full border-2 border-[var(--accent-gold)] opacity-40 animate-ping" />
                  )}
                </span>

                {/* Labels */}
                <span className="flex flex-col items-center gap-0.5">
                  <span
                    className={cn(
                      "text-xs font-semibold tracking-wide uppercase transition-colors",
                      isActive    && "text-[var(--accent-gold)]",
                      isCompleted && "text-[var(--foreground)]",
                      !isActive && !isCompleted && "text-[var(--muted-foreground)]"
                    )}
                  >
                    {step.label}
                  </span>

                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className="mx-3 flex-1 flex items-center" style={{ width: "clamp(32px, 6vw, 80px)" }}>
                  <div className="h-px w-full bg-[var(--border)] relative overflow-hidden rounded-full">
                    <div
                      className="absolute inset-y-0 left-0 bg-[var(--accent-gold)] transition-all duration-500"
                      style={{ width: isCompleted ? "100%" : "0%" }}
                    />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
