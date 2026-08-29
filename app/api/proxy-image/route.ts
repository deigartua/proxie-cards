import { NextRequest, NextResponse } from "next/server"

const ALLOWED_HOSTS = ["cards.scryfall.io", "c1.scryfall.com", "svgs.scryfall.io"]

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")

  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return new NextResponse("Invalid URL", { status: 400 })
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new NextResponse("Host not allowed", { status: 403 })
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "MTG-Proxy-Builder/1.0",
      },
    })

    if (!upstream.ok) {
      return new NextResponse("Upstream error", { status: upstream.status })
    }

    const contentType = upstream.headers.get("content-type") ?? "image/png"
    const buffer = await upstream.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch {
    return new NextResponse("Failed to fetch image", { status: 502 })
  }
}
