// Display-friendly labels for database enum values.
// Import and use these wherever you render an enum value to the user.

export const COMPANY_TYPE_LABELS: Record<string, string> = {
  vendor: 'Vendor',
  asset_owner: 'Asset Owner',
  consulting: 'Consulting',
  other: 'Other',
}

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  client: 'Client',
  former_client: 'Former Client',
  inactive: 'Inactive',
}

export const PROSPECT_STAGE_LABELS: Record<string, string> = {
  researching: 'Researching',
  targeted: 'Targeted',
  contacted: 'Contacted',
  negotiating_fee: 'Negotiating Fee',
  closed: 'Closed',
}

export const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const COMPANY_SOURCE_LABELS: Record<string, string> = {
  referral: 'Referral',
  conference: 'Conference',
  outreach: 'Outreach',
  inbound: 'Inbound',
  candidate_intel: 'Candidate Intel',
}

export const DISPOSITION_LABELS: Record<string, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  not_a_fit: 'Not a Fit',
  future_target: 'Future Target',
  no_terms_reached: 'No Terms Reached',
}

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  decision_maker: 'Decision Maker',
  hiring_manager: 'Hiring Manager',
  hr: 'HR',
  champion: 'Champion',
  gatekeeper: 'Gatekeeper',
  other: 'Other',
}

export const INFLUENCE_LEVEL_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  on_hold: 'On Hold',
  filled: 'Filled',
  cancelled: 'Cancelled',
}

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  onsite: 'Onsite',
  remote: 'Remote',
  hybrid: 'Hybrid',
}

export const JOB_SOURCE_LABELS: Record<string, string> = {
  existing_client: 'Existing Client',
  repeat_business: 'Repeat Business',
  referral: 'Referral',
  inbound: 'Inbound',
  outreach: 'Outreach',
}

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  placed: 'Placed',
}

export const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Sales',
  sales_engineering: 'Sales Engineering',
  channel: 'Channel',
  marketing: 'Marketing',
  product: 'Product',
  customer_success: 'Customer Success',
  operations: 'Operations',
  engineering: 'Engineering',
  other: 'Other',
}

export const SENIORITY_LEVEL_LABELS: Record<string, string> = {
  individual_contributor: 'Individual Contributor',
  manager: 'Manager',
  director: 'Director',
  vp: 'VP',
  c_suite: 'C-Suite',
}

export const ACTIVITY_TYPES = [
  'phone_call',
  'email',
  'conference',
  'linkedin_message',
  'text_message',
] as const

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  phone_call: 'Phone Call',
  email: 'Email',
  conference: 'Conference',
  linkedin_message: 'LinkedIn Message',
  text_message: 'Text Message',
}

export const US_REGIONS: Record<string, string[]> = {
  "Northeast": ["CT", "ME", "MA", "NH", "RI", "VT"],
  "Mid-Atlantic": ["DE", "DC", "MD", "NJ", "NY", "PA", "VA"],
  "Southeast": ["AL", "FL", "GA", "KY", "MS", "NC", "SC", "TN", "WV"],
  "Midwest": ["IL", "IN", "IA", "MI", "MN", "MO", "OH", "WI"],
  "Plains": ["KS", "NE", "ND", "SD"],
  "TOLA": ["AR", "LA", "OK", "TX"],
  "Southwest": ["AZ", "NM"],
  "West": ["CA", "CO", "HI", "ID", "MT", "NV", "UT", "WY"],
  "Pacific Northwest": ["AK", "OR", "WA"],
}

// Full name for each 2-letter state abbreviation
export const STATE_NAMES: Record<string, string> = {
  AK: "Alaska", AL: "Alabama", AR: "Arkansas", AZ: "Arizona",
  CA: "California", CO: "Colorado", CT: "Connecticut",
  DC: "District of Columbia", DE: "Delaware", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", IA: "Iowa", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", MA: "Massachusetts", MD: "Maryland", ME: "Maine",
  MI: "Michigan", MN: "Minnesota", MO: "Missouri", MS: "Mississippi",
  MT: "Montana", NC: "North Carolina", ND: "North Dakota", NE: "Nebraska",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NV: "Nevada",
  NY: "New York", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VA: "Virginia", VT: "Vermont", WA: "Washington", WI: "Wisconsin",
  WV: "West Virginia", WY: "Wyoming",
}

// Sorted list of [abbr, fullName] pairs for dropdowns
export const ALL_STATES: [string, string][] = Object.entries(STATE_NAMES).sort(
  ([, a], [, b]) => a.localeCompare(b)
)

/**
 * Expands a state abbreviation into all DB-stored variants so .in() catches
 * rows regardless of how location_state was originally entered.
 * e.g. "GA" → ["GA", "Ga", "ga", "Georgia"]
 */
export function expandStateValues(abbr: string): string[] {
  const fullName = STATE_NAMES[abbr.toUpperCase()]
  const upper = abbr.toUpperCase()
  const lower = abbr.toLowerCase()
  const title = upper.charAt(0) + lower.charAt(1)
  const variants: string[] = [upper, title, lower]
  if (fullName) variants.push(fullName)
  return variants
}

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—'
  return map[value] ?? value
}

export function formatCompensation(amount: number): string {
  return `$${Math.round(amount / 1000)}k`
}

export function formatCompRange(low: number | null, high: number | null): string {
  if (low != null && high != null) return `${formatCompensation(low)} – ${formatCompensation(high)}`
  if (low != null) return formatCompensation(low)
  if (high != null) return formatCompensation(high)
  return '—'
}
