"use client"

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PrintListEntry } from "@/types/scryfall"

interface GeneratePdfButtonProps {
  entries: PrintListEntry[]
  totalCards: number
}

export function GeneratePdfButton({ entries, totalCards }: GeneratePdfButtonProps) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)

  const handleGenerate = async () => {
    if (entries.length === 0 || generating) return
    setGenerating(true)
    setProgress(null)

    try {
      const { generatePdf } = await import("@/lib/generate-pdf")
      await generatePdf({
        entries,
        onProgress: (loaded, total) => setProgress({ loaded, total }),
      })
    } catch (err) {
      console.error("[v0] PDF generation error:", err)
      alert("Hubo un error generando el PDF. Revisá la consola para más detalles.")
    } finally {
      setGenerating(false)
      setProgress(null)
    }
  }

  const percent =
    progress ? Math.round((progress.loaded / progress.total) * 100) : null

  return (
    <Button
      onClick={handleGenerate}
      disabled={entries.length === 0 || generating}
      className="w-full bg-accent-gold text-surface font-semibold hover:bg-accent-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
      size="lg"
    >
      {generating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {percent !== null
            ? `Descargando imágenes... ${percent}%`
            : "Preparando PDF..."}
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          Generar PDF
          {totalCards > 0 && (
            <span className="ml-2 rounded-full bg-surface/20 px-2 py-0.5 text-xs font-bold">
              {totalCards}
            </span>
          )}
        </>
      )}
    </Button>
  )
}
