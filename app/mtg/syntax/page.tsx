import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface SyntaxSection {
  title: string
  rows: { syntax: string; description: string; example: string }[]
}

const SECTIONS: SyntaxSection[] = [
  {
    title: "Nombre y texto",
    rows: [
      { syntax: "lightning bolt", description: "Busca por nombre", example: "lightning bolt" },
      { syntax: 'o:"texto"', description: "Texto de oráculo contiene", example: 'o:"draw a card"' },
      { syntax: 'o~', description: "Tilde reemplaza el nombre de la carta en oracle", example: 'o:"deals ~ damage"' },
    ],
  },
  {
    title: "Tipo de carta",
    rows: [
      { syntax: "t:tipo", description: "Tipo o subtipo de carta", example: "t:creature" },
      { syntax: "t:supertipo", description: "Supertipo", example: "t:legendary" },
      { syntax: "t:instant or t:sorcery", description: "Múltiples tipos", example: "t:instant or t:sorcery" },
    ],
  },
  {
    title: "Colores",
    rows: [
      { syntax: "c:color", description: "Carta contiene ese color", example: "c:u (azul)" },
      { syntax: "c=colores", description: "Exactamente esos colores", example: "c=wu (blanco+azul)" },
      { syntax: "c>=colores", description: "Al menos esos colores", example: "c>=rg" },
      { syntax: "ci:colores", description: "Identidad de color", example: "ci:boros" },
      { syntax: "c:m", description: "Multicolor", example: "c:m t:instant" },
      { syntax: "c:c", description: "Incoloro", example: "c:c" },
    ],
  },
  {
    title: "Costo de maná (CMC)",
    rows: [
      { syntax: "cmc=N", description: "CMC exacto", example: "cmc=3" },
      { syntax: "cmc<N / cmc>N", description: "Menor / mayor que", example: "cmc<2 t:creature" },
      { syntax: "mv=N", description: "Alias de CMC en Scryfall moderno", example: "mv>=5" },
    ],
  },
  {
    title: "Rareza",
    rows: [
      { syntax: "r:common", description: "Común", example: "r:c" },
      { syntax: "r:uncommon", description: "Poco común", example: "r:u" },
      { syntax: "r:rare", description: "Rara", example: "r:r" },
      { syntax: "r:mythic", description: "Mítica", example: "r:m" },
    ],
  },
  {
    title: "Poder y resistencia",
    rows: [
      { syntax: "pow=N", description: "Poder exacto", example: "pow=4" },
      { syntax: "tou>=N", description: "Resistencia mayor o igual", example: "tou>=5" },
      { syntax: "pow>tou", description: "Comparar poder vs resistencia", example: "pow>tou c:r" },
    ],
  },
  {
    title: "Set y formato",
    rows: [
      { syntax: "s:CODIGO", description: "Set específico (código de 3 letras)", example: "s:m20" },
      { syntax: "f:formato", description: "Legal en formato", example: "f:standard" },
      { syntax: "f:commander", description: "Legal en Commander", example: "f:commander c:g" },
      { syntax: "not:reprint", description: "Primera impresión", example: "not:reprint" },
    ],
  },
  {
    title: "Precio y disponibilidad",
    rows: [
      { syntax: "usd<N", description: "Precio en USD menor que", example: "usd<0.5" },
      { syntax: "is:foil", description: "Disponible en foil", example: "is:foil" },
    ],
  },
  {
    title: "Operadores lógicos",
    rows: [
      { syntax: "A B", description: "AND implícito (ambas condiciones)", example: "t:creature c:w" },
      { syntax: "A or B", description: "OR", example: "t:instant or t:sorcery" },
      { syntax: "-filtro", description: "NOT (excluye)", example: "t:creature -c:b" },
      { syntax: "(A or B) C", description: "Agrupación con paréntesis", example: "(t:instant or t:sorcery) c:u" },
    ],
  },
]

export default function SyntaxPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10">

        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a Proxie.cards
          </Link>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Referencia de sintaxis de búsqueda
          </h1>
          <p className="mt-2 text-muted-foreground text-sm max-w-xl">
            El buscador de Proxie.cards utiliza la sintaxis de{" "}
            <a
              href="https://scryfall.com/docs/syntax"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-gold hover:underline"
            >
              Scryfall
            </a>
            . Podés combinar cualquiera de estos filtros en el campo de búsqueda.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3 border-b border-border pb-1">
                {section.title}
              </h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-raised">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-1/3">Sintaxis</th>
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-1/3">Descripción</th>
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-1/3">Ejemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {section.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-surface-raised/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <code className="text-accent-gold font-mono text-xs bg-accent-gold/10 px-1.5 py-0.5 rounded">
                            {row.syntax}
                          </code>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.description}</td>
                        <td className="px-4 py-2.5">
                          <code className="text-foreground/80 font-mono text-xs">{row.example}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground/50">
          Sintaxis basada en{" "}
          <a href="https://scryfall.com/docs/syntax" target="_blank" rel="noopener noreferrer" className="text-accent-gold/70 hover:underline">
            Scryfall Syntax Reference
          </a>
          . Proxie.cards no es oficial de Wizards of the Coast.
        </p>
      </div>
    </div>
  )
}
