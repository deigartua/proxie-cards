import { updateSession } from "@/lib/supabase/proxy"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Every API route already creates its own Supabase client and checks auth
  // itself (see app/api/**), so it doesn't depend on this middleware at all —
  // excluding /api here cuts the middleware's blast radius roughly in half
  // without changing any behavior.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
