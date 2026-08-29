import { NextResponse } from "next/server"
import { createPublicClient } from "@/lib/supabase/public"
import { FALLBACK_TIERS } from "@/lib/pricing"

// Public endpoint — returns active price tiers sorted by min_cards
// Cache for 60 s so admin changes propagate quickly.
// Uses the cookie-free public client (not lib/supabase/server's cookies()-based
// client) so this route can actually be statically rendered/cached — calling
// cookies() forces a route into fully dynamic rendering, which was throwing
// "Dynamic server usage" and taking the whole site down with it.
export const revalidate = 60

export async function GET() {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from("price_tiers")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (error || !data || data.length === 0) {
      console.warn("[api/pricing] Falling back to hardcoded tiers:", error?.message)
      return NextResponse.json({ tiers: FALLBACK_TIERS })
    }

    return NextResponse.json({ tiers: data })
  } catch (err) {
    console.error("[api/pricing] Unexpected error:", err)
    return NextResponse.json({ tiers: FALLBACK_TIERS })
  }
}
