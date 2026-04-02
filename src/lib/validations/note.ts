import { z } from 'zod'

export const NOTE_TYPES = [
  'general',
  'insight',
  'interview_feedback',
  'interview_prep',
  'account_thesis',
] as const

// Labels for the dropdown (current note types only)
export const NOTE_TYPE_LABELS: Record<(typeof NOTE_TYPES)[number], string> = {
  general: 'General',
  insight: 'Insight',
  interview_feedback: 'Interview Feedback',
  interview_prep: 'Interview Prep',
  account_thesis: 'Account Thesis',
}

// All labels including legacy types (for displaying existing notes)
export const ALL_NOTE_TYPE_LABELS: Record<string, string> = {
  ...NOTE_TYPE_LABELS,
  phone_call: 'Phone Call',
  email: 'Email',
}

export const noteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Note content is required')
    .max(10000, 'Note must be under 10,000 characters'),
  note_type: z.enum(NOTE_TYPES),
  is_private: z.boolean(),
})

export type NoteFormValues = z.infer<typeof noteSchema>
