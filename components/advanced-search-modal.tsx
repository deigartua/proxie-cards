"use client"

import { useState } from "react"
import { X, Search, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AdvancedSearchModalProps {
  onSearch: (query: string) => void
  onClose: () => void
}

const COLOR_OPTIONS = [
  { code: "W", label: "Blanco",   bg: "bg-yellow-50  border-yellow-300  text-yellow-900" },
  { code: "U", label: "Azul",     bg: "bg-blue-100   border-blue-400    text-blue-900" },
  { code: "B", label: "Negro",    bg: "bg-neutral-700 border-neutral-500 text-neutral-100" },
  { code: "R", label: "Rojo",     bg: "bg-red-100    border-red-400     text-red-900" },
  { code: "G", label: "Verde",    bg: "bg-green-100  border-green-400   text-green-900" },
  { code: "C", label: "Incolor",  bg: "bg-neutral-200 border-neutral-400 text-neutral-800" },
]

const TYPE_SUPERTYPES = ["Legendary", "Basic", "Snow", "World", "Tribal"]
const TYPE_MAIN = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Land", "Battle"]
const RARITY_OPTIONS = [
  { code: "c", label: "Común" },
  { code: "u", label: "Infrecuente" },
  { code: "r", label: "Rara" },
  { code: "m", label: "Mítica" },
  { code: "s", label: "Special" },
]
const FORMAT_OPTIONS = ["standard", "pioneer", "modern", "legacy", "vintage", "commander", "pauper", "explorer", "historic", "alchemy", "brawl", "penny"]
const STAT_OPTIONS = ["mv", "power", "toughness", "loyalty", "defense"]
const STAT_OPS = ["=", "<", "<=", ">", ">=", "!="]
const GAME_OPTIONS = [
  { code: "paper", label: "Paper" },
  { code: "arena", label: "Arena" },
  { code: "mtgo", label: "MTGO" },
]
const LANGUAGE_OPTIONS = [
  { code: "", label: "Cualquier idioma" },
  { code: "en", label: "Inglés" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Francés" },
  { code: "de", label: "Alemán" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Portugués" },
  { code: "ja", label: "Japonés" },
  { code: "ko", label: "Coreano" },
  { code: "ru", label: "Ruso" },
  { code: "zhs", label: "Chino simplif." },
]

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-accent-gold/80 mb-1.5">
      {children}
    </p>
  )
}

function Divider() {
  return <div className="border-t border-border/50" />
}

export function AdvancedSearchModal({ onSearch, onClose }: AdvancedSearchModalProps) {
  // ── Name / text fields ────────────────────────────────────────────────────
  const [nameText, setNameText]         = useState("")
  const [oracleText, setOracleText]     = useState("")
  const [typeText, setTypeText]         = useState("")
  const [artistText, setArtistText]     = useState("")
  const [flavorText, setFlavorText]     = useState("")
  const [loreText, setLoreText]         = useState("")
  const [manaCostText, setManaCostText] = useState("")
  const [setCode, setSetCode]           = useState("")

  // ── Colors ────────────────────────────────────────────────────────────────
  const [selectedColors, setSelectedColors]           = useState<string[]>([])
  const [colorMode, setColorMode]                     = useState<":" | "=" | ">=">(":")
  const [selectedCmdColors, setSelectedCmdColors]     = useState<string[]>([])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [statField, setStatField]   = useState("mv")
  const [statOp, setStatOp]         = useState("=")
  const [statVal, setStatVal]       = useState("")

  // ── Rarity / format / game ────────────────────────────────────────────────
  const [selectedRarity, setSelectedRarity]   = useState<string[]>([])
  const [formatLegal, setFormatLegal]         = useState("")
  const [selectedGames, setSelectedGames]     = useState<string[]>([])
  const [language, setLanguage]               = useState("")

  // ── Helpers ───────────────────────────────────────────────────────────────
  function toggleArr(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function buildQuery(): string {
    const parts: string[] = []

    if (nameText.trim())     parts.push(nameText.trim())
    if (oracleText.trim())   parts.push(`o:"${oracleText.trim()}"`)
    if (typeText.trim())     parts.push(`t:${typeText.trim().replace(/\s+/g, " t:")}`)
    if (manaCostText.trim()) parts.push(`mana:${manaCostText.trim()}`)
    if (artistText.trim())   parts.push(`a:"${artistText.trim()}"`)
    if (flavorText.trim())   parts.push(`ft:"${flavorText.trim()}"`)
    if (loreText.trim())     parts.push(`lore:"${loreText.trim()}"`)
    if (setCode.trim())      parts.push(`s:${setCode.trim()}`)

    if (selectedColors.length > 0) {
      parts.push(`c${colorMode}${selectedColors.join("")}`)
    }
    if (selectedCmdColors.length > 0) {
      parts.push(`commander:${selectedCmdColors.join("")}`)
    }

    if (statVal.trim()) {
      const field = statField === "mv" ? "cmc" : statField
      parts.push(`${field}${statOp}${statVal.trim()}`)
    }

    if (selectedRarity.length > 0) {
      if (selectedRarity.length === 1) {
        parts.push(`r:${selectedRarity[0]}`)
      } else {
        parts.push(`(${selectedRarity.map(r => `r:${r}`).join(" or ")})`)
      }
    }
    if (formatLegal) parts.push(`f:${formatLegal}`)
    if (selectedGames.length > 0) {
      parts.push(selectedGames.map(g => `game:${g}`).join(" "))
    }
    if (language) parts.push(`lang:${language}`)

    return parts.join(" ")
  }

  function handleApply() {
    const q = buildQuery()
    if (q) { onSearch(q); onClose() }
  }

  function clearAll() {
    setNameText(""); setOracleText(""); setTypeText(""); setArtistText("")
    setFlavorText(""); setLoreText(""); setManaCostText(""); setSetCode("")
    setSelectedColors([]); setSelectedCmdColors([])
    setStatVal(""); setStatField("mv"); setStatOp("=")
    setSelectedRarity([]); setFormatLegal(""); setSelectedGames([])
    setLanguage("")
  }

  const inputClass = "w-full rounded-lg border border-input bg-surface-raised px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/50 transition-shadow"
  const selectClass = "rounded-lg border border-input bg-surface-raised px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-gold/50"

  function ColorRow({
    selected, onToggle,
  }: { selected: string[]; onToggle: (c: string) => void }) {
    return (
      <div className="flex gap-2 flex-wrap">
        {COLOR_OPTIONS.map(c => (
          <button
            key={c.code}
            type="button"
            onClick={() => onToggle(c.code)}
            title={c.label}
            className={cn(
              "h-8 w-8 rounded-full border-2 text-xs font-black transition-all flex items-center justify-center",
              c.bg,
              selected.includes(c.code)
                ? "scale-110 ring-2 ring-accent-gold ring-offset-1 ring-offset-surface"
                : "opacity-50 hover:opacity-80"
            )}
          >
            {c.code}
          </button>
        ))}
      </div>
    )
  }

  function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "px-2.5 py-0.5 rounded-full text-xs border transition-colors",
          active
            ? "bg-accent-gold/20 border-accent-gold/60 text-accent-gold"
            : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
        )}
      >
        {children}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-foreground tracking-tight">Búsqueda avanzada</h2>
          <div className="flex items-center gap-3">
            <a
              href="/mtg/syntax"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent-gold hover:text-accent-gold/80 transition-colors"
            >
              Sintaxis completa <ExternalLink className="h-3 w-3" />
            </a>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* ── Name ── */}
          <div>
            <SectionLabel>Nombre de la carta</SectionLabel>
            <input type="text" placeholder='ej: "Lightning Bolt"' value={nameText}
              onChange={e => setNameText(e.target.value)} className={inputClass} />
          </div>

          <Divider />

          {/* ── Oracle text ── */}
          <div>
            <SectionLabel>Texto del oráculo</SectionLabel>
            <input type="text" placeholder='ej: "deals damage to any target"'
              value={oracleText} onChange={e => setOracleText(e.target.value)} className={inputClass} />
            <p className="text-[10px] text-muted-foreground/60 mt-1">Usá ~ como comodín para el nombre de la carta. El orden de las palabras no importa.</p>
          </div>

          <Divider />

          {/* ── Type line ── */}
          <div>
            <SectionLabel>Tipo</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {TYPE_SUPERTYPES.map(t => (
                <PillButton key={t} active={typeText.toLowerCase().includes(t.toLowerCase())}
                  onClick={() => setTypeText(prev =>
                    prev.toLowerCase().includes(t.toLowerCase())
                      ? prev.replace(new RegExp(t, "i"), "").trim()
                      : prev ? `${prev} ${t}` : t
                  )}>
                  {t}
                </PillButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {TYPE_MAIN.map(t => (
                <PillButton key={t} active={typeText.toLowerCase().includes(t.toLowerCase())}
                  onClick={() => setTypeText(prev =>
                    prev.toLowerCase().includes(t.toLowerCase())
                      ? prev.replace(new RegExp(t, "i"), "").trim()
                      : prev ? `${prev} ${t}` : t
                  )}>
                  {t}
                </PillButton>
              ))}
            </div>
            <input type="text" placeholder="o escribí un tipo personalizado"
              value={typeText} onChange={e => setTypeText(e.target.value)} className={inputClass} />
          </div>

          <Divider />

          {/* ── Colors ── */}
          <div>
            <SectionLabel>Colores</SectionLabel>
            <ColorRow selected={selectedColors} onToggle={c => toggleArr(selectedColors, c, setSelectedColors)} />
            <div className="flex gap-2 mt-2.5 flex-wrap">
              {([":", "=", ">="] as const).map(mode => (
                <PillButton key={mode} active={colorMode === mode} onClick={() => setColorMode(mode)}>
                  {mode === ":" ? "Incluye estos colores" : mode === "=" ? "Exactamente estos" : "Al menos estos"}
                </PillButton>
              ))}
            </div>
            {selectedColors.length > 0 && (
              <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                {colorMode === ":" && '"Incluye" devuelve cartas de estos colores más cualquier otro.'}
                {colorMode === "=" && '"Exactamente" devuelve solo cartas de exactamente estos colores.'}
                {colorMode === ">=" && '"Al menos" devuelve cartas que contengan todos estos colores.'}
              </p>
            )}
          </div>

          <Divider />

          {/* ── Commander color identity ── */}
          <div>
            <SectionLabel>Identidad de color (Commander)</SectionLabel>
            <ColorRow selected={selectedCmdColors} onToggle={c => toggleArr(selectedCmdColors, c, setSelectedCmdColors)} />
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">
              Solo devuelve cartas que entran en un mazo commander con esta identidad de color.
            </p>
          </div>

          <Divider />

          {/* ── Mana cost ── */}
          <div>
            <SectionLabel>Costo de maná</SectionLabel>
            <input type="text" placeholder='ej: {W}{W}, {2}{U}, {X}{G}'
              value={manaCostText} onChange={e => setManaCostText(e.target.value)} className={inputClass} />
            <p className="text-[10px] text-muted-foreground/60 mt-1">Busca el costo de maná exacto de la carta.</p>
          </div>

          <Divider />

          {/* ── Stats ── */}
          <div>
            <SectionLabel>Estadísticas</SectionLabel>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={statField} onChange={e => setStatField(e.target.value)} className={selectClass}>
                <option value="mv">Valor de maná</option>
                <option value="power">Fuerza</option>
                <option value="toughness">Resistencia</option>
                <option value="loyalty">Lealtad</option>
                <option value="defense">Defensa</option>
              </select>
              <select value={statOp} onChange={e => setStatOp(e.target.value)} className={selectClass}>
                {STAT_OPS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <input type="number" min={0} placeholder="ej: 3"
                value={statVal} onChange={e => setStatVal(e.target.value)}
                className={cn(inputClass, "w-24")} />
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Las cartas sin esa estadística no serán incluidas.</p>
          </div>

          <Divider />

          {/* ── Rarity ── */}
          <div>
            <SectionLabel>Rareza</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {RARITY_OPTIONS.map(r => (
                <PillButton key={r.code} active={selectedRarity.includes(r.code)}
                  onClick={() => toggleArr(selectedRarity, r.code, setSelectedRarity)}>
                  {r.label}
                </PillButton>
              ))}
            </div>
          </div>

          <Divider />

          {/* ── Format ── */}
          <div>
            <SectionLabel>Formato</SectionLabel>
            <div className="flex items-center gap-2">
              <select value={formatLegal} onChange={e => setFormatLegal(e.target.value)} className={cn(selectClass, "flex-1")}>
                <option value="">Cualquier formato</option>
                <option value="" disabled>─ Legal en ─</option>
                {FORMAT_OPTIONS.map(f => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <Divider />

          {/* ── Games ── */}
          <div>
            <SectionLabel>Disponible en</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {GAME_OPTIONS.map(g => (
                <PillButton key={g.code} active={selectedGames.includes(g.code)}
                  onClick={() => toggleArr(selectedGames, g.code, setSelectedGames)}>
                  {g.label}
                </PillButton>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Filtra cartas que aparecen en Paper, Arena o Magic Online.</p>
          </div>

          <Divider />

          {/* ── Set ── */}
          <div>
            <SectionLabel>Set / Edición</SectionLabel>
            <input type="text" placeholder="Código de set, ej: m20, khm, bro, dsk"
              value={setCode} onChange={e => setSetCode(e.target.value)} className={inputClass} />
            <p className="text-[10px] text-muted-foreground/60 mt-1">Podés buscar el código de set en Scryfall.</p>
          </div>

          <Divider />

          {/* ── Artist ── */}
          <div>
            <SectionLabel>Artista</SectionLabel>
            <input type="text" placeholder='ej: "Magali Villeneuve"'
              value={artistText} onChange={e => setArtistText(e.target.value)} className={inputClass} />
          </div>

          <Divider />

          {/* ── Flavor text ── */}
          <div>
            <SectionLabel>Texto de ambientación</SectionLabel>
            <input type="text" placeholder='ej: "the spark"'
              value={flavorText} onChange={e => setFlavorText(e.target.value)} className={inputClass} />
            <p className="text-[10px] text-muted-foreground/60 mt-1">El orden de las palabras no importa.</p>
          </div>

          <Divider />

          {/* ── Lore Finder ── */}
          <div>
            <SectionLabel>Lore Finder — buscar en toda la carta</SectionLabel>
            <input type="text" placeholder='ej: "Jhoira", "Phyrexia"'
              value={loreText} onChange={e => setLoreText(e.target.value)} className={inputClass} />
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Busca en nombre, texto, tipo y flavor text. Ideal para encontrar cartas que mencionan un personaje o lugar.
            </p>
          </div>

          <Divider />

          {/* ── Language ── */}
          <div>
            <SectionLabel>Idioma</SectionLabel>
            <select value={language} onChange={e => setLanguage(e.target.value)} className={cn(selectClass, "w-full")}>
              {LANGUAGE_OPTIONS.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Custom syntax hint */}
          <div className="rounded-xl border border-accent-gold/20 bg-accent-gold/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Para búsquedas aún más personalizadas (watermarks, frame effects, prices, reprints, etc.) podés usar{" "}
              <a
                href="https://scryfall.com/advanced"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-gold hover:underline inline-flex items-center gap-0.5"
              >
                la búsqueda avanzada de Scryfall <ExternalLink className="h-3 w-3" />
              </a>{" "}
              o consultar la{" "}
              <a
                href="/mtg/syntax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-gold hover:underline"
              >
                referencia de sintaxis
              </a>
              {" "}y pegar la query directamente en la barra de búsqueda.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border flex justify-between items-center gap-3">
          <button type="button" onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Limpiar todo
          </button>
          <Button
            onClick={handleApply}
            disabled={!buildQuery()}
            className="bg-accent-gold text-surface font-semibold hover:bg-accent-gold/90 disabled:opacity-40"
          >
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Buscar
          </Button>
        </div>
      </div>
    </div>
  )
}
