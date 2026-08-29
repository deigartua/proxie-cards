import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Public, cookie-free Supabase client for routes that only read public data
 * (no user session needed). Unlike lib/supabase/server.ts, this never calls
 * `cookies()`, so routes using it can still be statically rendered / cached
 * with `revalidate` instead of being forced into fully dynamic rendering.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
