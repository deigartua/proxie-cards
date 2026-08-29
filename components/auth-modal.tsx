"use client"

import { useState } from "react"
import { X, Loader2, User as UserIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

interface AuthModalProps {
  onClose: () => void
  /** Which tab to show first. Defaults to "login". */
  defaultTab?: "login" | "signup"
  /** Optional short message shown above the tabs to explain why the modal opened. */
  reason?: string
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos."
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user already registered")) {
    return "Ya existe una cuenta con ese email. Iniciá sesión en su lugar."
  }
  if (m.includes("password") && m.includes("least")) return "La contraseña debe tener al menos 6 caracteres."
  if (m.includes("valid email") || m.includes("invalid email")) return "Ingresá un email válido."
  return message
}

export function AuthModal({ onClose, defaultTab = "login", reason }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const [tab, setTab] = useState<"login" | "signup">(defaultTab)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Login fields
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Signup fields
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const switchTab = (next: "login" | "signup") => {
    setTab(next)
    setError(null)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword) {
      setError("Completá email y contraseña.")
      return
    }
    setLoading(true)
    setError(null)
    const { error: signInError } = await signIn(loginEmail.trim(), loginPassword)
    setLoading(false)
    if (signInError) {
      setError(friendlyAuthError(signInError.message))
      return
    }
    onClose()
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !signupEmail.trim() || !signupPassword) {
      setError("Completá todos los campos.")
      return
    }
    if (signupPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (signupPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    setError(null)
    const { error: signUpError } = await signUp(signupEmail.trim(), signupPassword, firstName.trim(), lastName.trim())
    setLoading(false)
    if (signUpError) {
      setError(friendlyAuthError(signUpError.message))
      return
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-accent-blue/15 flex items-center justify-center shrink-0">
              <UserIcon className="h-3.5 w-3.5 text-accent-blue" />
            </span>
            <h2 className="text-sm font-bold text-foreground tracking-tight">Mi cuenta</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
          {reason && (
            <p className="text-xs text-muted-foreground leading-relaxed -mt-1">{reason}</p>
          )}

          {/* Segmented control */}
          <div className="shrink-0 flex items-center gap-1 rounded-xl bg-surface-raised border border-border p-1">
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={cn(
                "flex-1 h-8 rounded-lg text-[12px] font-semibold transition-colors",
                tab === "login" ? "bg-accent-gold text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => switchTab("signup")}
              className={cn(
                "flex-1 h-8 rounded-lg text-[12px] font-semibold transition-colors",
                tab === "signup" ? "bg-accent-gold text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Crear cuenta
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-email" className="text-[11px] font-semibold text-muted-foreground">
                  Email
                </label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-password" className="text-[11px] font-semibold text-muted-foreground">
                  Contraseña
                </label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-xl bg-accent-blue text-white hover:bg-accent-blue/90"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Iniciar sesión"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="signup-first-name" className="text-[11px] font-semibold text-muted-foreground">
                    Nombre
                  </label>
                  <Input
                    id="signup-first-name"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Juan"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="signup-last-name" className="text-[11px] font-semibold text-muted-foreground">
                    Apellido
                  </label>
                  <Input
                    id="signup-last-name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Pérez"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-email" className="text-[11px] font-semibold text-muted-foreground">
                  Email
                </label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-password" className="text-[11px] font-semibold text-muted-foreground">
                  Contraseña
                </label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={signupPassword}
                  onChange={e => setSignupPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-confirm-password" className="text-[11px] font-semibold text-muted-foreground">
                  Confirmar contraseña
                </label>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-xl bg-accent-blue text-white hover:bg-accent-blue/90"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Crear cuenta"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
