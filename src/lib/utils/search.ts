
// ─── Snippet parsing ─────────────────────────────────────────────────────────

interface SnippetSegment {
  text: string
  highlighted: boolean
}

export function parseSnippet(snippet: string): SnippetSegment[] {
  if (!snippet) return [{ text: '', highlighted: false }]

  // Normalize <b>...</b> to **...** so we handle both formats
  const normalized = snippet.replace(/<b>/g, '**').replace(/<\/b>/g, '**')

  const segments: SnippetSegment[] = []
  const parts = normalized.split('**')

  parts.forEach((part, index) => {
    if (part === '') return
    segments.push({
      text: part,
      highlighted: index % 2 === 1,
    })
  })

  return segments.length > 0 ? segments : [{ text: snippet, highlighted: false }]
}

