import { normalizeLinkedInUrl } from './normalize'

const test = (description: string, condition: boolean) => {
  if (!condition) {
    console.error(`❌ FAILED: ${description}`)
    process.exitCode = 1
  } else {
    console.log(`✓ ${description}`)
  }
}

// Null/empty handling
test('null input returns null', normalizeLinkedInUrl(null) === null)
test('undefined input returns null', normalizeLinkedInUrl(undefined) === null)
test('empty string returns null', normalizeLinkedInUrl('') === null)
test('whitespace-only string returns null', normalizeLinkedInUrl('   ') === null)

// Already canonical
test(
  'already canonical URL',
  normalizeLinkedInUrl('https://www.linkedin.com/in/mark-smith') === 'https://www.linkedin.com/in/mark-smith'
)

// Trailing slash
test(
  'trailing slash is removed',
  normalizeLinkedInUrl('https://www.linkedin.com/in/mark-smith/') === 'https://www.linkedin.com/in/mark-smith'
)

// Mixed case slug
test(
  'mixed case slug is lowercased',
  normalizeLinkedInUrl('https://www.linkedin.com/in/MarkSmith') === 'https://www.linkedin.com/in/marksmith'
)

// No www
test(
  'no www prefix adds it',
  normalizeLinkedInUrl('https://linkedin.com/in/mark-smith') === 'https://www.linkedin.com/in/mark-smith'
)

// http instead of https
test(
  'http protocol becomes https',
  normalizeLinkedInUrl('http://www.linkedin.com/in/mark-smith') === 'https://www.linkedin.com/in/mark-smith'
)

// No protocol
test(
  'no protocol (linkedin.com) adds https://www',
  normalizeLinkedInUrl('linkedin.com/in/mark-smith') === 'https://www.linkedin.com/in/mark-smith'
)

test(
  'no protocol (www.linkedin.com) adds https',
  normalizeLinkedInUrl('www.linkedin.com/in/mark-smith') === 'https://www.linkedin.com/in/mark-smith'
)

// Query params (typical browser copy-paste from LinkedIn)
test(
  'query parameters are stripped',
  normalizeLinkedInUrl('https://www.linkedin.com/in/mark-smith/?miniProfileUrn=urn%3Ali%3Afsd_profile%3AACoAA') ===
    'https://www.linkedin.com/in/mark-smith'
)

// URL fragment
test(
  'URL fragment is stripped',
  normalizeLinkedInUrl('https://www.linkedin.com/in/mark-smith#experience') ===
    'https://www.linkedin.com/in/mark-smith'
)

// Slug with digits and hyphens
test(
  'slug with digits and hyphens is preserved',
  normalizeLinkedInUrl('https://www.linkedin.com/in/taylor-muse1/') === 'https://www.linkedin.com/in/taylor-muse1'
)

// Country subdomain
test(
  'country subdomain (uk) normalizes to www',
  normalizeLinkedInUrl('https://uk.linkedin.com/in/mark-smith') === 'https://www.linkedin.com/in/mark-smith'
)

test(
  'country subdomain (de) normalizes to www',
  normalizeLinkedInUrl('https://de.linkedin.com/in/mark-smith') === 'https://www.linkedin.com/in/mark-smith'
)

// Whitespace around input
test(
  'leading and trailing whitespace is trimmed',
  normalizeLinkedInUrl('  https://www.linkedin.com/in/mark-smith  ') ===
    'https://www.linkedin.com/in/mark-smith'
)

// Invalid: no /in/ path (the old broken pattern)
test(
  'URL without /in/ path returns null',
  normalizeLinkedInUrl('https://www.linkedin.com/taylor-muse') === null
)

test(
  'URL without /in/ path (no protocol) returns null',
  normalizeLinkedInUrl('linkedin.com/taylor-muse') === null
)

// Invalid: not a LinkedIn URL
test(
  'non-LinkedIn URL returns null',
  normalizeLinkedInUrl('https://www.google.com') === null
)

test(
  'plain text returns null',
  normalizeLinkedInUrl('not a url at all') === null
)

// Invalid: empty slug
test(
  'empty slug after /in/ returns null',
  normalizeLinkedInUrl('https://www.linkedin.com/in/') === null
)

test(
  'double slash after /in/ returns null',
  normalizeLinkedInUrl('https://www.linkedin.com/in//') === null
)

console.log('\nAll tests completed!')
