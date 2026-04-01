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
  | 'sales'
  | 'sales_engineering'
  | 'channel'
  | 'marketing'
  | 'product'
  | 'customer_success'
  | 'operations'
  | 'engineering'
  | 'executive'
  | 'other'

export type SeniorityLevel =
  | 'individual_contributor'
  | 'manager'
  | 'director'
  | 'vp'
  | 'c_suite'

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
  seniority_level: SeniorityLevel | null
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
  is_star: boolean
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
  seniority_level?: SeniorityLevel | null
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
  | 'interview_prep'

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
export type ProspectPipelineStage = 'researching' | 'targeted' | 'contacted' | 'negotiating_fee' | 'closed'
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
  linkedin_url: string | null
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
  what_they_do: string | null
  target_customer_profile: string | null
  company_size: string | null
  key_products_services: string | null
  target_buyer: string | null
  growth_stage: string | null
  hiring_signal: string | null
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
  linkedin_url?: string | null
  what_they_do?: string | null
  target_customer_profile?: string | null
  company_size?: string | null
  key_products_services?: string | null
  target_buyer?: string | null
  growth_stage?: string | null
  hiring_signal?: string | null
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

// ─── Job Openings ─────────────────────────────────────────────────────────────

export type JobStatus = 'open' | 'on_hold' | 'filled' | 'cancelled'
export type LocationType = 'onsite' | 'remote' | 'hybrid'
export type JobSource = 'existing_client' | 'referral' | 'inbound' | 'outreach' | 'repeat_business'

export interface JobOpening {
  id: string
  company_id: string
  hiring_manager_id: string | null
  title: string
  category: CandidateCategory | null
  seniority_level: SeniorityLevel | null
  description: string | null
  requirements: string | null
  location_city: string | null
  location_state: string | null
  location_type: LocationType | null
  comp_range_low: number | null
  comp_range_high: number | null
  status: JobStatus
  priority: Priority | null
  source: JobSource | null
  next_step: string | null
  next_step_due_date: string | null
  travel_percentage: number | null
  fee_percentage_override: number | null
  opened_at: string
  filled_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // search_vector omitted — tsvector only used in SQL
  // Joined display fields
  company_name?: string
  company_status?: string
  hiring_manager_name?: string
  active_candidate_count?: number
}

export type JobOpeningInsert = {
  company_id: string
  title: string
  status: JobStatus
  category?: CandidateCategory | null
  seniority_level?: SeniorityLevel | null
  hiring_manager_id?: string | null
  description?: string | null
  requirements?: string | null
  location_city?: string | null
  location_state?: string | null
  location_type?: LocationType | null
  comp_range_low?: number | null
  comp_range_high?: number | null
  priority?: Priority | null
  source?: JobSource | null
  next_step?: string | null
  next_step_due_date?: string | null
  travel_percentage?: number | null
  fee_percentage_override?: number | null
  opened_at?: string
  filled_at?: string | null
  closed_at?: string | null
}

export type JobOpeningUpdate = Partial<JobOpeningInsert>

// ─── Pipeline Stages ──────────────────────────────────────────────────────────

export interface PipelineStage {
  id: string
  job_opening_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface PipelineStageInsert {
  job_opening_id: string
  name: string
  sort_order: number
}

// ─── Candidate Applications ──────────────────────────────────────────────────

export type ApplicationStatus = 'active' | 'rejected' | 'withdrawn' | 'placed'

export interface CandidateApplication {
  id: string
  candidate_id: string
  job_opening_id: string
  current_stage_id: string | null
  status: ApplicationStatus
  rejection_stage_id: string | null
  rejection_reason: string | null
  applied_at: string
  rejected_at: string | null
  placed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // Joined fields for display
  candidate_name?: string
  candidate_current_title?: string
  candidate_current_company?: string
  job_title?: string
  company_name?: string
  current_stage_name?: string
  rejection_stage_name?: string
}

export interface ApplicationStageHistory {
  id: string
  application_id: string
  from_stage_id: string | null
  to_stage_id: string | null
  moved_at: string
  moved_by: string | null
  notes: string | null
  // Joined fields
  from_stage_name?: string
  to_stage_name?: string
  moved_by_name?: string
}

// ─── Candidate Documents ─────────────────────────────────────────────────────

export interface CandidateDocument {
  id: string
  candidate_id: string
  file_name: string
  file_type: 'resume' | 'cv' | 'cover_letter' | 'portfolio' | 'other'
  storage_path: string
  file_size_bytes: number | null
  mime_type: string | null
  is_primary: boolean
  notes: string | null
  uploaded_by: string | null
  uploaded_at: string
}

// ─── Work History ───────────────────────────────────────────────────────────

export interface WorkHistory {
  id: string
  candidate_id: string
  company_name: string
  job_title: string
  location: string | null
  description: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  sort_order: number
  created_at: string
  updated_at: string
  // search_vector omitted — tsvector only used in SQL
}

// ─── Follow-Ups ─────────────────────────────────────────────────────────────

export interface FollowUp {
  id: string
  entity_type: string
  entity_id: string
  title: string
  description: string | null
  due_date: string
  is_completed: boolean
  completed_at: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string | null
}

// ─── Talent Pools ────────────────────────────────────────────────────────────

export interface TalentPool {
  id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TalentPoolMember {
  id: string
  pool_id: string
  candidate_id: string
  added_by: string | null
  added_at: string
}

export interface TalentPoolWithCount extends TalentPool {
  member_count: number
}

export interface TalentPoolMemberWithCandidate extends TalentPoolMember {
  candidate: {
    full_name: string
    current_title: string | null
    current_company: string | null
    category: CandidateCategory | null
    seniority_level: SeniorityLevel | null
    location_city: string | null
    location_state: string | null
    is_star: boolean
  }
}

// ─── Key Relationships ──────────────────────────────────────────────────────

export interface KeyRelationship {
  id: string
  entity_type: 'candidate' | 'company_contact'
  entity_id: string
  context_note: string | null
  added_by: string | null
  created_at: string
}

export interface KeyRelationshipWithDetails extends KeyRelationship {
  name: string
  title: string | null
  company: string | null
  company_id: string | null
  last_contacted_at: string | null
  days_since_contact: number | null
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  entity_type: string
  entity_id: string
  entity_name: string
  match_source: string
  snippet: string
  rank: number
  created_at: string
}
