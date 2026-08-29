'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DeckbuilderWithId({ params }: { params: { id: string } }) {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the main deckbuilder with the id as a search param
    router.replace(`/deckbuilder?id=${encodeURIComponent(params.id)}`)
  }, [params.id, router])

  return null
}
