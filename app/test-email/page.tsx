"use client"

import { useState } from "react"
import { Mail, Loader2, Check, AlertCircle } from "lucide-react"

export default function TestEmailPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [detail, setDetail] = useState<string | null>(null)

  const handleSendTest = async () => {
    if (!email.trim()) {
      setStatus("error")
      setMessage("Ingresa un email válido")
      return
    }

    setLoading(true)
    setStatus("idle")
    setMessage("")
    setDetail(null)

    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(data.error || "Error al enviar el email")
        // Mostrar el detalle del error de Resend si existe
        if (data.resend_error) {
          setDetail(JSON.stringify(data.resend_error, null, 2))
        }
        return
      }

      setStatus("success")
      setMessage(`Email enviado a ${email}. Codigo de prueba: ${data.code}`)
      setEmail("")
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-8 space-y-6">
          <div className="text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-gold/10 border border-accent-gold/30 mx-auto mb-3">
              <Mail className="h-6 w-6 text-accent-gold" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1">Probar envío de emails</h1>
            <p className="text-xs text-muted-foreground">Envía un email de prueba con código de seguimiento</p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Email de prueba
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-gold/40 disabled:opacity-50"
            />
            <p className="text-[11px] text-muted-foreground">
              Ingresa tu email real para recibir un email de prueba con el código de seguimiento
            </p>
          </div>

          {status !== "idle" && (
            <div
              className={`flex flex-col gap-2 rounded-lg p-3 text-xs ${
                status === "success"
                  ? "bg-green-500/10 border border-green-500/30 text-green-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
            >
              <div className="flex items-start gap-2">
                {status === "success" ? (
                  <Check className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{message}</span>
              </div>
              {detail && (
                <pre className="mt-1 p-2 bg-black/30 rounded text-[10px] overflow-auto whitespace-pre-wrap break-all">
                  {detail}
                </pre>
              )}
            </div>
          )}

          <button
            onClick={handleSendTest}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent-gold text-background font-bold text-sm hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Enviar email de prueba
              </>
            )}
          </button>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Instrucciones</p>
            <ul className="text-[11px] text-amber-700 space-y-1 list-disc list-inside">
              <li>Ingresa tu email real</li>
              <li>Haz clic en "Enviar email de prueba"</li>
              <li>Recibirás un email con un código ####-#### de ejemplo</li>
              <li>Verifica que el email tenga el formato y diseño esperado</li>
            </ul>
          </div>

          <div className="text-center text-[11px] text-muted-foreground">
            <p>Solo disponible en modo development.</p>
            <p>
              <a href="/" className="text-accent-gold hover:underline">
                Volver al inicio
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
