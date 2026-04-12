// Normalizes LinkedIn profile URLs to a canonical format: https://www.linkedin.com/in/{lowercase-slug}
export function normalizeLinkedInUrl(input: string | null | undefined): string | null {
  // Handle null, undefined, or empty input
  if (!input) {
    return null
  }

  // Trim whitespace
  const trimmed = input.trim()
  if (trimmed === '') {
    return null
  }

  // Strip query parameters (everything after ?)
  const withoutQuery = trimmed.split('?')[0]

  // Strip URL fragments (everything after #)
  const withoutFragment = withoutQuery.split('#')[0]

  // Extract slug from /in/ path using regex
  const match = withoutFragment.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/i)
  if (!match || !match[1]) {
    return null
  }

  // Lowercase the slug and validate it's not empty
  const slug = match[1].toLowerCase()
  if (slug === '') {
    return null
  }

  return `https://www.linkedin.com/in/${slug}`
}
