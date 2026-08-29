"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Package } from "lucide-react"
import { Navbar } from "@/components/navbar"

export default function OrdersPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!clean) { setError("Ingresá tu código de orden"); return }
    setError("")
    router.push(`/orders/${clean}`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gold/10 text-accent-gold">
              <Package className="h-7 w-7" />
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-foreground text-center mb-2 tracking-tight font-sans">
            Seguir mi pedido
          </h1>
          <p className="text-center text-muted-foreground text-sm mb-8 leading-relaxed">
            Ingresá el código que recibiste al confirmar tu pedido para ver su estado.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className={`flex gap-2 p-1.5 rounded-xl border bg-surface transition-all ${
              error
                ? "border-destructive"
                : "border-border focus-within:border-accent-gold/60"
            }`}>
              <div className="flex items-center pl-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError("") }}
                placeholder="0000-0000"
                className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none py-2 tracking-widest min-w-0"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-accent-gold text-background text-sm font-bold hover:brightness-105 transition-all shrink-0"
              >
                Buscar
              </button>
            </div>
            {error && <p className="text-xs text-destructive pl-2">{error}</p>}
          </form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            ¿No tenés un código?{" "}
            <a href="/deckbuilder" className="text-accent-gold hover:underline font-medium">
              Hacé tu pedido acá
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
