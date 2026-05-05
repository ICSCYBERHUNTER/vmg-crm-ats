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
    return <div className="h-14 w-72 md:w-96 hidden md:block" />
  }

  return (
    <div className="hidden md:block max-w-sm text-center px-8 py-6 rounded-lg border border-[#2a2a32] bg-[#111113]">
      <p className="font-serif text-[36px] leading-none text-[#b91c1c] mb-0">&ldquo;</p>
      <p className="font-serif italic text-[#f0f0f2] text-base leading-[1.7] mb-3">{quote.text}</p>
      {quote.author && (
        <p className="text-[13px] text-[#8a8a95]">— {quote.author}</p>
      )}
    </div>
  )
}
