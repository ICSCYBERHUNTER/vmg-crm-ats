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

// ─── Companies ───────────────────────────────────────────────────────────────

export type CompanyStatus = 'prospect' | 'client' | 'former_client' | 'inactive'
export type ProspectPipelineStage = 'targeted' | 'contacted' | 'negotiating_fee' | 'closed'
export type CompanyType = 'vendor' | 'asset_owner' | 'consulting' | 'other'
export type CompanySource = 'referral' | 'conference' | 'outreach' | 'inbound' | 'candidate_intel'
export type Priority = 'high' | 'medium' | 'low'
export type CompanyDisposition = 'active' | 'on_hold' | 'not_a_fit' | 'future_target' | 'no_terms_reached'

export interface Company {
  id: string
  name: string
  domain: string | null
  company_type: CompanyType | null
  industry: string | null
  hq_city: string | null
  hq_state: string | null
  hq_country: string | null
  website_url: string | null
  status: CompanyStatus
  prospect_stage: ProspectPipelineStage | null
  prospect_stage_entered_at: string | null
  priority: Priority | null
  why_target: string | null
  source: CompanySource | null
  next_step: string | null
  next_step_due_date: string | null
  disposition: CompanyDisposition | null
  fee_agreement_pct: number | null
  became_client_at: string | null
  last_contacted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // search_vector omitted — tsvector only used in SQL
}

export type CompanyInsert = {
  name: string
  status: CompanyStatus
  domain?: string | null
  company_type?: CompanyType | null
  industry?: string | null
  hq_city?: string | null
  hq_state?: string | null
  hq_country?: string
  prospect_stage?: ProspectPipelineStage | null
  priority?: Priority | null
  why_target?: string | null
  source?: CompanySource | null
  next_step?: string | null
  next_step_due_date?: string | null
  disposition?: CompanyDisposition | null
  fee_agreement_pct?: number | null
  became_client_at?: string | null
}

export type CompanyUpdate = Partial<CompanyInsert>

// ─── Company Contacts ───────────────────────────────────────────────────────

export type ContactType = 'decision_maker' | 'hiring_manager' | 'hr' | 'champion' | 'gatekeeper' | 'other'

export type InfluenceLevel = 'high' | 'medium' | 'low'

export interface CompanyContact {
  id: string
  company_id: string
  first_name: string
  last_name: string
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  contact_type: ContactType
  is_primary: boolean
  reports_to_id: string | null
  linked_candidate_id: string | null
  influence_level: InfluenceLevel | null
  last_contacted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // search_vector omitted — tsvector only used in SQL
}

export interface CompanyContactWithReportsTo extends CompanyContact {
  reports_to: {
    id: string
    first_name: string
    last_name: string
    title: string | null
  } | null
}

export type CompanyContactInsert = {
  company_id: string
  first_name: string
  last_name: string
  contact_type?: ContactType
  is_primary?: boolean
  title?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  reports_to_id?: string | null
  influence_level?: InfluenceLevel | null
}

export type CompanyContactUpdate = Partial<Omit<CompanyContactInsert, 'company_id'>>
