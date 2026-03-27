import { z } from 'zod'

// These must match the CHECK constraints in the database schema.

export const COMPANY_STATUSES = ['prospect', 'client', 'former_client', 'inactive'] as const
export const PROSPECT_STAGES = ['researching', 'targeted', 'contacted', 'negotiating_fee', 'closed'] as const
export const COMPANY_TYPES = ['vendor', 'asset_owner', 'consulting', 'other'] as const
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
  hq_city: z.string(),
  hq_state: z.string(),
  hq_country: z.string(),
  status: z.enum(COMPANY_STATUSES),
  prospect_stage: z.string(),
  priority: z.string(),
  why_target: z.string(),
  source: z.string(),
  next_step: z.string(),
  next_step_due_date: z.string(),
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
})

export type CompanyFormValues = z.infer<typeof companySchema>
