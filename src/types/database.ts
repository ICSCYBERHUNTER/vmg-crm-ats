// TypeScript types matching the database schema exactly.
// Column names, nullability, and enum values must match docs/SCHEMA.md.

export type UserRole = 'admin' | 'recruiter'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}

// ─── Candidates ─────────────────────────────────────────────────────────────

export type CandidateCategory =
  | 'Regional Sales Director'
  | 'Account Executive'
  | 'Solutions Engineer'
  | 'Sales Engineer'
  | 'SE Manager'
  | 'VP of Sales'
  | 'VP Engineering'
  | 'VP of Sales Engineering'
  | 'CMO'
  | 'CPO'
  | 'Head of Product Marketing'
  | 'Head of Marketing'
  | 'Product Marketing Manager'
  | 'Product Manager'
  | 'Backend Engineer'
  | 'OT Security Engineer'
  | 'OT Security Engineering Manager'
  | 'Other'

export type CandidateStatus = 'active' | 'passive' | 'placed' | 'do_not_contact'

export type CandidateSource =
  | 'LinkedIn'
  | 'Referral'
  | 'Job Board'
  | 'Conference'
  | 'Cold Outreach'
  | 'Inbound'
  | 'Other'

export type WillingToRelocate = 'yes' | 'no' | 'flexible' | 'unknown'

export interface Candidate {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  linkedin_url: string | null
  location_city: string | null
  location_state: string | null
  location_country: string
  current_title: string | null
  current_company: string | null
  category: CandidateCategory | null
  years_experience: number | null
  skills: string | null
  current_compensation: number | null
  desired_compensation: number | null
  willing_to_relocate: WillingToRelocate
  relocation_preferences: string | null
  status: CandidateStatus
  source: CandidateSource | null
  linked_contact_id: string | null
  last_contacted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // search_vector omitted — tsvector is only used in SQL, never read directly in TS
}

// ─── Candidate insert/update payloads ────────────────────────────────────────
// Used by the Supabase functions in lib/supabase/candidates.ts

export type CandidateInsert = {
  first_name: string
  last_name: string
  status: CandidateStatus
  willing_to_relocate?: WillingToRelocate
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  location_city?: string | null
  location_state?: string | null
  location_country?: string
  current_title?: string | null
  current_company?: string | null
  category?: CandidateCategory | null
  years_experience?: number | null
  skills?: string | null
  current_compensation?: number | null
  desired_compensation?: number | null
  relocation_preferences?: string | null
  source?: CandidateSource | null
}

export type CandidateUpdate = Partial<CandidateInsert>

// ─── Notes ──────────────────────────────────────────────────────────────────

export type NoteEntityType = 'candidate' | 'company' | 'contact' | 'job_opening'

export type NoteType =
  | 'phone_call'
  | 'email'
  | 'interview_feedback'
  | 'insight'
  | 'general'

export interface Note {
  id: string
  entity_type: NoteEntityType
  entity_id: string
  content: string
  note_type: NoteType
  linked_job_id: string | null
  is_private: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  // search_vector omitted — tsvector is only used in SQL
}

// ─── Notes with joined profile (for display) ────────────────────────────────

export interface NoteWithAuthor extends Note {
  profiles: Pick<Profile, 'full_name'> | null
}
