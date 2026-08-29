"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Check, Clock, Copy, ExternalLink, Mail } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

function SuccessContent() {
  const searchParams = useSearchParams()
  const shortCode = searchParams.get("code")
  const email = searchParams.get("email")
  const status = searchParams.get("status")
  const [copied, setCopied] = useState(false)

  const isPending = status === "pending"
  const hasEmail = email && !email.startsWith("whatsapp:")

  function handleCopy() {
    if (!shortCode) return
    navigator.clipboard.writeText(shortCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">

        {/* Icon */}
        <div className={cn(
          "flex h-20 w-20 items-center justify-center rounded-full border-2",
          isPending
            ? "bg-amber-500/10 border-amber-500/25"
            : "bg-emerald-500/10 border-emerald-500/25"
        )}>
          {isPending
            ? <Clock className="h-10 w-10 text-amber-500" strokeWidth={2} />
            : <Check className="h-10 w-10 text-emerald-500" strokeWidth={2.5} />
          }
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1.5">
            {isPending ? "Pago pendiente" : "Pago confirmado"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isPending
              ? "Tu pago está siendo procesado. Vamos a preparar tu pedido en cuanto se confirme."
              : "Tu pago fue aprobado. Vamos a preparar tu pedido y te contactamos para coordinar la entrega."
            }
          </p>
        </div>

        {/* Code box */}
        {shortCode && (
          <div className="w-full rounded-2xl border-2 border-accent-gold/40 bg-accent-gold/5 p-6 flex flex-col items-center gap-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Copiá este código para ver el estado de tu pedido
            </p>

            {/* The code itself */}
            <p className="text-4xl font-black font-mono tracking-[0.2em] text-accent-gold select-all">
              {shortCode}
            </p>

            {/* Email notice */}
            {hasEmail && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>También te lo enviamos a <strong className="text-foreground">{email}</strong></span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-background text-xs font-semibold text-muted-foreground hover:border-accent-gold/50 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-accent-gold" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar código"}
              </button>
              <Link
                href={`/orders/${shortCode}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-accent-gold/40 bg-accent-gold/10 text-xs font-semibold text-accent-gold hover:bg-accent-gold/20 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver estado
              </Link>
            </div>
          </div>
        )}

        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-accent-gold transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}

export default function PedidoSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SuccessContent />
    </Suspense>
  )
}
