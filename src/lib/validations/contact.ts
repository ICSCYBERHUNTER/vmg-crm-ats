import { z } from 'zod'

export const CONTACT_TYPES = ['decision_maker', 'hiring_manager', 'hr', 'champion', 'gatekeeper', 'other'] as const
export const INFLUENCE_LEVELS = ['high', 'medium', 'low'] as const

export const contactSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  title: z.string(),
  email: z.string().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: 'Invalid email address' }
  ),
  phone: z.string(),
  linkedin_url: z.string(),
  contact_type: z.enum(CONTACT_TYPES),
  is_primary: z.boolean(),
  reports_to_id: z.string(),
  influence_level: z.string(),
})

export type ContactFormValues = z.infer<typeof contactSchema>
