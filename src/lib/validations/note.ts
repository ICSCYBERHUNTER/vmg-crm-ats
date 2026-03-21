import { z } from 'zod'

export const NOTE_TYPES = [
  'general',
  'phone_call',
  'email',
  'interview_feedback',
  'insight',
] as const

export const NOTE_TYPE_LABELS: Record<(typeof NOTE_TYPES)[number], string> = {
  general: 'General',
  phone_call: 'Phone Call',
  email: 'Email',
  interview_feedback: 'Interview Feedback',
  insight: 'Insight',
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
