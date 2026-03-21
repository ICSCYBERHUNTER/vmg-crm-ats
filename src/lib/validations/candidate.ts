import { z } from 'zod'

// These must exactly match the CHECK constraints in the database schema.
// See docs/SCHEMA.md for the full list.

export const CANDIDATE_CATEGORIES = [
  'Regional Sales Director',
  'Account Executive',
  'Solutions Engineer',
  'Sales Engineer',
  'SE Manager',
  'VP of Sales',
  'VP Engineering',
  'VP of Sales Engineering',
  'CMO',
  'CPO',
  'Head of Product Marketing',
  'Head of Marketing',
  'Product Marketing Manager',
  'Product Manager',
  'Backend Engineer',
  'OT Security Engineer',
  'OT Security Engineering Manager',
  'Other',
] as const

export const CANDIDATE_SOURCES = [
  'LinkedIn',
  'Referral',
  'Job Board',
  'Conference',
  'Cold Outreach',
  'Inbound',
  'Other',
] as const

// All form fields are strings here. Number fields (years_experience,
// compensation) are validated as strings and converted to numbers in the
// form's submit handler before being sent to Supabase.
export const candidateSchema = z.object({
  // Required
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  status: z.enum(['active', 'passive', 'placed', 'do_not_contact'], {
    message: 'Status is required',
  }),
  willing_to_relocate: z.enum(['yes', 'no', 'flexible', 'unknown']),

  // Optional text (empty string = not provided)
  email: z
    .string()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Invalid email format',
    }),
  phone: z.string(),
  linkedin_url: z.string(),
  current_title: z.string(),
  current_company: z.string(),
  skills: z.string(),
  location_city: z.string(),
  location_state: z.string(),
  location_country: z.string(),
  relocation_preferences: z.string(),

  // Optional selects — empty string means "none selected"
  category: z.string(),
  source: z.string(),

  // Numbers stored as strings in the form; validated if non-empty
  years_experience: z.string().refine(
    (val) =>
      !val ||
      (!isNaN(Number(val)) && Number(val) >= 0 && Number.isInteger(Number(val))),
    { message: 'Must be a whole number (e.g. 5)' }
  ),
  current_compensation: z.string().refine(
    (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
    { message: 'Must be a positive number' }
  ),
  desired_compensation: z.string().refine(
    (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
    { message: 'Must be a positive number' }
  ),
})

export type CandidateFormValues = z.infer<typeof candidateSchema>
