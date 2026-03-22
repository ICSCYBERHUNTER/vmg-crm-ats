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

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—'
  return map[value] ?? value
}
