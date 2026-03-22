// Strips any URL down to a bare domain (e.g., "https://www.dragos.com/about" → "dragos.com").
// Used before saving the domain field on companies.

export function stripDomain(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  try {
    // If input doesn't start with a protocol, prepend one so URL() can parse it.
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const { hostname } = new URL(withProtocol)
    // Strip leading www.
    return hostname.replace(/^www\./i, '')
  } catch {
    // If URL parsing fails (malformed input), return the trimmed input as-is.
    return trimmed
  }
}
