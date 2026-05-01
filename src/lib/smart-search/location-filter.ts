// Smart Search location filter
//
// Detects explicit location intent in a query (e.g. "lives in Illinois") and
// returns a set of canonical two-letter state abbreviations to hard-filter
// candidate results against.
//
// Only activates when the query contains clear location-intent phrasing.
// Returns null when no location intent is detected — callers pass through unchanged.
//
// Reuses the US_REGIONS taxonomy from src/lib/utils/labels.ts so region names
// (Midwest, Southeast, TOLA, etc.) stay in sync with the Candidates page filter.

import { US_REGIONS } from '@/lib/utils/labels'

export type LocationFilter = {
  states: Set<string> // canonical two-letter uppercase abbreviations, e.g. "IL"
}

// ── State name → abbreviation map ────────────────────────────────────────────
// Covers all 50 states + DC. Keys are lowercase for case-insensitive matching.

const STATE_NAME_TO_ABBR: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'district of columbia': 'DC', 'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI',
  'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME',
  'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE',
  'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX',
  'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
  'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
}

// Valid two-letter state abbreviations (uppercase)
const ALL_ABBRS = new Set(Object.values(STATE_NAME_TO_ABBR))

// ── Normalization ─────────────────────────────────────────────────────────────
// Converts whatever is stored in location_state to a canonical abbreviation.
// Handles: "Illinois", "IL", "il", "Ca", "california", etc.
// Returns null if the value can't be recognized.

export function normalizeLocationState(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Try as abbreviation first (2-letter, case-insensitive)
  const upper = trimmed.toUpperCase()
  if (upper.length === 2 && ALL_ABBRS.has(upper)) return upper

  // Try as full name (case-insensitive)
  const lower = trimmed.toLowerCase()
  return STATE_NAME_TO_ABBR[lower] ?? null
}

// ── Intent detection ──────────────────────────────────────────────────────────
// Query must contain one of these phrases to trigger location filtering.
// Without this gate a query like "OT security Ohio-based startup" would
// incorrectly filter candidates instead of companies.

const LOCATION_INTENT_PATTERNS: RegExp[] = [
  /\blives?\s+in\b/i,
  /\bliving\s+in\b/i,
  /\blocated\s+in\b/i,
  /\bbased\s+in\b/i,
  /\bresides?\s+in\b/i,
  /\bfrom\b/i,
  /\bcandidates?\s+in\b/i,
  /\bpeople\s+in\b/i,
  /\btalent\s+in\b/i,
]

// ── Bare "in <location>" detection ────────────────────────────────────────────
// Matches "in Texas", "in TX", "in the Midwest", etc. without requiring an
// explicit intent phrase. Only fires when "in" is directly followed by a
// recognized state name, state abbreviation, or region name — so bare "in"
// with an unknown word is never treated as location intent.

const ABBR_LIST = 'AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY'

function hasBareInLocation(query: string): boolean {
  const lower = query.toLowerCase()

  // Check "in <full state name>"
  for (const name of Object.keys(STATE_NAME_TO_ABBR)) {
    // Use word boundary on both sides of the state name
    const pattern = new RegExp(`\\bin\\s+(?:the\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(lower)) return true
  }

  // Check "in <state abbreviation>" — uppercase only, word-boundary safe
  const abbrPattern = new RegExp(`\\bin\\s+(?:the\\s+)?(${ABBR_LIST})\\b`)
  if (abbrPattern.test(query)) return true

  // Check "in <region name>"
  for (const regionName of Object.keys(US_REGIONS)) {
    const escaped = regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\bin\\s+(?:the\\s+)?${escaped}\\b`, 'i')
    if (pattern.test(query)) return true
  }

  return false
}

// ── Region alias normalization ────────────────────────────────────────────────
// Matches region names case-insensitively and expands to the same abbreviation
// sets used by the Candidates page region filter (US_REGIONS from labels.ts).

function expandRegion(query: string, states: Set<string>): void {
  for (const [regionName, abbrs] of Object.entries(US_REGIONS)) {
    // Build a word-boundary-aware pattern for the region name.
    // "Pacific Northwest" needs to match as a phrase, not just "Northwest".
    const escaped = regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i')
    if (pattern.test(query)) {
      for (const abbr of abbrs) states.add(abbr)
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function parseLocationFilter(query: string): LocationFilter | null {
  // Must have explicit location-intent phrasing OR bare "in <known location>"
  const hasIntent =
    LOCATION_INTENT_PATTERNS.some((p) => p.test(query)) ||
    hasBareInLocation(query)
  if (!hasIntent) return null

  const states = new Set<string>()

  // Expand any matching region names (Midwest, TOLA, etc.)
  expandRegion(query, states)

  // Match full state names — try multi-word names first to avoid
  // "New York" being partially matched as just "York"
  const lower = query.toLowerCase()
  const byLength = Object.keys(STATE_NAME_TO_ABBR).sort((a, b) => b.length - a.length)
  for (const name of byLength) {
    if (lower.includes(name)) {
      states.add(STATE_NAME_TO_ABBR[name])
    }
  }

  // Match two-letter abbreviations: uppercase, word-boundary only
  // Exclude common false positives (IN as preposition handled by word boundaries,
  // but ME/OR/OK/HI can appear in normal English — accepted tradeoff given
  // the intent-phrasing gate above already filters out ambiguous queries)
  const abbrPattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/g
  const abbrMatches = query.match(abbrPattern)
  if (abbrMatches) {
    for (const m of abbrMatches) states.add(m)
  }

  if (states.size === 0) return null
  return { states }
}
