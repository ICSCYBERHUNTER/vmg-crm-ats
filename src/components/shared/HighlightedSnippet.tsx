'use client'

import { parseSnippet } from '@/lib/utils/search'

interface HighlightedSnippetProps {
  snippet: string
}

export function HighlightedSnippet({ snippet }: HighlightedSnippetProps) {
  const segments = parseSnippet(snippet)

  return (
    <p className="text-sm text-muted-foreground">
      {segments.map((segment, i) =>
        segment.highlighted ? (
          <mark
            key={i}
            className="rounded-sm bg-primary/20 px-0.5 text-foreground"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </p>
  )
}
