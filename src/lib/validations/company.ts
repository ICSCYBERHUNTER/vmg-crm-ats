import { z } from 'zod'

// These must match the CHECK constraints in the database schema.

export const COMPANY_STATUSES = ['prospect', 'client', 'former_client', 'inactive'] as const
export const PROSPECT_STAGES = ['researching', 'targeted', 'contacted', 'negotiating_fee', 'closed'] as const
export const COMPANY_TYPES = [
  'cybersecurity_vendor',
  'technology_vendor',
  'managed_security_provider',
  'var_reseller',
  'systems_integrator',
  'consulting_advisory',
  'asset_owner_end_user',
  'government_public_sector',
  'investor',
  'research_institution_lab',
  'other_needs_review',
] as const

export const PRIMARY_SEGMENTS = [
  'ot_ics_cps_security',
  'connected_product_security',
  'ai_security',
  'network_security',
  'sase_sse',
  'endpoint_security',
  'identity_access_management',
  'cloud_security',
  'data_security',
  'application_security',
  'security_operations',
  'threat_intelligence',
  'vulnerability_exposure_mgmt',
  'offensive_security_validation',
  'email_security',
  'grc_risk_compliance',
  'third_party_risk_mgmt',
  'security_awareness_training',
  'general_multi_domain',
] as const

export const INDUSTRY_VERTICALS = [
  'energy',
  'electric_utility',
  'oil_gas',
  'water_wastewater',
  'utilities',
  'manufacturing',
  'critical_manufacturing',
  'chemical',
  'pharmaceuticals',
  'healthcare_delivery',
  'transportation',
  'rail',
  'maritime',
  'aviation',
  'automotive',
  'aerospace_space',
  'defense',
  'data_centers',
  'smart_buildings',
  'mining_metals',
  'food_agriculture',
  'financial_services',
  'communications',
  'government',
  'industrial_automation',
] as const
export const COMPANY_SOURCES = ['referral', 'conference', 'outreach', 'inbound', 'candidate_intel'] as const
export const PRIORITIES = ['high', 'medium', 'low'] as const
export const DISPOSITIONS = ['active', 'on_hold', 'not_a_fit', 'future_target', 'no_terms_reached'] as const

// Optional selects and text fields follow the same pattern as candidate.ts:
// empty string = "not provided", converted to null in the submit handler.
export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  domain: z.string(),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  company_type: z.string(),
  industry: z.string(),
  is_ai_native: z.boolean(),
  primary_segment: z.string(),
  industry_verticals: z.array(z.string()),
  hq_city: z.string(),
  hq_state: z.string(),
  hq_country: z.string(),
  status: z.enum(COMPANY_STATUSES),
  prospect_stage: z.string(),
  priority: z.string(),
  why_target: z.string(),
  source: z.string(),
  disposition: z.string(),
  // Stored as string in the form; converted to number on submit.
  fee_agreement_pct: z.string().refine(
    (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100),
    { message: 'Must be a number between 0 and 100' }
  ),
  // Auto-set via transition logic; not a user-facing input.
  became_client_at: z.string(),
  what_they_do: z.string().optional().or(z.literal('')),
  target_customer_profile: z.string().optional().or(z.literal('')),
  company_size: z.string().optional().or(z.literal('')),
  key_products_services: z.string().optional().or(z.literal('')),
  target_buyer: z.string().optional().or(z.literal('')),
  growth_stage: z.string().optional().or(z.literal('')),
  hiring_signal: z.string().optional().or(z.literal('')),
  referred_by_type: z.enum(['contact', 'candidate']).nullable().optional(),
  referred_by_id: z.string().nullable().optional(),
  referred_by_text: z.string().nullable().optional(),
})

export type CompanyFormValues = z.infer<typeof companySchema>
