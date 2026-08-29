import { redirect } from "next/navigation"

/**
 * /builder is kept for backward compatibility.
 * All traffic is now routed to /mazo.
 */
export default function BuilderRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  // We can't await searchParams here synchronously for a redirect,
  // so just redirect to /mazo and let it pick up the query param on the client.
  redirect("/deckbuilder")
}
