import { z } from 'zod'

// These must match the CHECK constraints in the database schema.

export const JOB_STATUSES = ['open', 'on_hold', 'filled', 'cancelled'] as const
export const LOCATION_TYPES = ['onsite', 'remote', 'hybrid'] as const
export const JOB_SOURCES = ['existing_client', 'referral', 'inbound', 'outreach', 'repeat_business'] as const
export const JOB_PRIORITIES = ['high', 'medium', 'low'] as const

export const JOB_CATEGORIES = [
  'sales', 'sales_engineering', 'channel', 'marketing', 'product',
  'customer_success', 'operations', 'engineering', 'executive', 'other',
] as const

export const JOB_SENIORITY_LEVELS = [
  'individual_contributor', 'manager', 'director', 'vp', 'c_suite',
] as const

export const jobOpeningSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200, 'Max 200 characters'),
    company_id: z.string().min(1, 'Company is required'),
    category: z.string(),
    seniority_level: z.string(),
    hiring_manager_id: z.string(),
    status: z.enum(JOB_STATUSES),
    priority: z.string(),
    description: z.string().max(5000, 'Max 5000 characters'),
    requirements: z.string().max(5000, 'Max 5000 characters'),
    location_type: z.string(),
    location_city: z.string(),
    location_state: z.string(),
    travel_percentage: z.string().refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100),
      { message: 'Must be between 0 and 100' }
    ),
    comp_range_low: z.string().refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) > 0),
      { message: 'Must be a positive number' }
    ),
    comp_range_high: z.string().refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) > 0),
      { message: 'Must be a positive number' }
    ),
    fee_percentage_override: z.string().refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 100),
      { message: 'Must be between 0 and 100' }
    ),
    source: z.string(),
    next_step: z.string().max(500, 'Max 500 characters'),
    next_step_due_date: z.string(),
  })
  .refine(
    (data) => {
      if (data.comp_range_low && data.comp_range_high) {
        return Number(data.comp_range_high) >= Number(data.comp_range_low)
      }
      return true
    },
    {
      message: 'Comp high must be greater than or equal to comp low',
      path: ['comp_range_high'],
    }
  )

export type JobOpeningFormValues = z.infer<typeof jobOpeningSchema>
