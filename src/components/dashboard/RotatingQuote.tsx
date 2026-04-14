'use client'

import { useEffect, useState } from 'react'
import { QUOTES, type Quote } from '@/lib/quotes'

export function RotatingQuote() {
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)])
  }, [])

  // Return placeholder with same approximate width to prevent layout shift
  if (!quote) {
    return <div className="h-14 w-72 md:w-96" />
  }

  return (
    <div className="max-w-md text-right leading-snug pt-1 hidden md:block">
      <p className="text-sm italic text-muted-foreground">{quote.text}</p>
      {quote.author && (
        <p className="text-xs text-muted-foreground/60 mt-1">— {quote.author}</p>
      )}
    </div>
  )
}
