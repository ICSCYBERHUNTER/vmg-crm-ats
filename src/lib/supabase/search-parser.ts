// ============================================================================
// search-parser.ts
// ----------------------------------------------------------------------------
// Pure parser for the global search query input. No browser/server-specific
// code, so both the client-side globalSearch() wrapper (search.ts) and the
// server-side embed-failure fallback (/api/smart-search/route.ts) can import
// it without crossing the 'use client' boundary.
//
// Splits a user-typed query into:
//   - looseWords: the unquoted tokens. Feeds the prefix tsquery in
//                 global_search_v2 — keeps existing AND-of-prefix-words
//                 behavior, so unquoted searches are unchanged.
//   - phrases:    each "double-quoted" segment becomes one entry. The SQL
//                 function then runs phraseto_tsquery('english', …) per
//                 entry, requiring adjacent-and-in-order matching.
// ============================================================================

export interface ParsedSearchQuery {
  looseWords: string
  phrases: string[]
}

/**
 * Parse a raw user search string into loose words + quoted phrases.
 *
 * Behavior:
 *   - Normalizes smart/curly quotes (" " ' ') to ASCII before parsing,
 *     so phone/Mac users get the same behavior as keyboard users.
 *   - Skips empty quoted strings (e.g. `""`) so they don't add a blank
 *     phrase to the array.
 *   - An unclosed lone `"` is treated as a literal character and stripped
 *     from looseWords — never errors, never blocks the search.
 *   - Collapses repeated whitespace in looseWords after phrase removal.
 *
 * Examples:
 *   parseQuery('sales engineer')
 *     → { looseWords: 'sales engineer', phrases: [] }
 *
 *   parseQuery('"sales engineer"')
 *     → { looseWords: '',               phrases: ['sales engineer'] }
 *
 *   parseQuery('"sales engineer" Minnesota')
 *     → { looseWords: 'Minnesota',      phrases: ['sales engineer'] }
 *
 *   parseQuery('"customer identification program" pre-sales')
 *     → { looseWords: 'pre-sales',
 *         phrases:    ['customer identification program'] }
 *
 *   parseQuery('"unclosed phrase')
 *     → { looseWords: 'unclosed phrase', phrases: [] }   // lone " stripped
 *
 *   parseQuery('')
 *     → { looseWords: '', phrases: [] }
 */
export function parseQuery(input: string): ParsedSearchQuery {
  // Step 1: normalize smart quotes → ASCII
  const normalized = (input ?? '')
    .replace(/[“”]/g, '"')   // " " → "
    .replace(/[‘’]/g, "'")   // ' ' → '

  // Step 2: extract paired-quote segments into phrases array
  const phrases: string[] = []
  const phraseRegex = /"([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = phraseRegex.exec(normalized)) !== null) {
    const phrase = match[1].trim()
    if (phrase) phrases.push(phrase)
  }

  // Step 3: build looseWords by removing paired quotes (+ contents) and
  // stripping any lone unmatched " characters. Collapse whitespace.
  const looseWords = normalized
    .replace(/"([^"]+)"/g, ' ')        // remove paired quotes and contents
    .replace(/"/g, '')                  // strip any lone unmatched quotes
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim()

  return { looseWords, phrases }
}
