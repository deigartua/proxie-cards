"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export interface Profile {
  id: string
  first_name: string
  last_name: string
  email: string
}

/**
 * Loads the `profiles` row for the given auth user and keeps it in sync.
 * Pass the `user` from useAuth() — when it changes (login/logout), the
 * profile is refetched automatically.
 */
export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", user.id)
      .maybeSingle()
    setProfile(data ?? null)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateProfile = async (updates: { first_name: string; last_name: string }) => {
    if (!user) return { error: new Error("No hay sesión activa.") }
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id)
    if (!error) {
      setProfile(prev => (prev ? { ...prev, ...updates } : prev))
    }
    return { error }
  }

  return { profile, loading, updateProfile, refresh }
}
