// Browser-side Supabase functions for use in "use client" components.
// Uses createBrowserClient (no next/headers), so it is safe to import
// from client components like CandidateForm and DeleteCandidateButton.
//
// Server Components should continue to use candidates.ts (server client).

import { createClient } from './client'
import type { Candidate, CandidateInsert, CandidateUpdate } from '@/types/database'

export async function createCandidate(data: CandidateInsert): Promise<Candidate> {
  const supabase = createClient()
  const { data: created, error } = await supabase
    .from('candidates')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}

export async function updateCandidate(id: string, data: CandidateUpdate): Promise<Candidate> {
  const supabase = createClient()
  const { data: updated, error } = await supabase
    .from('candidates')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return updated
}

export async function deleteCandidate(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Filtered list query (for server-side filtering from client components) ──

export interface CandidateFilters {
  status?: string
  category?: string
  locationState?: string
  salaryMin?: number
  salaryMax?: number
  skills?: string
  jobId?: string
}

export async function getCandidatesFiltered(
  filters: CandidateFilters
): Promise<Candidate[]> {
  const supabase = createClient()

  // When filtering by job, resolve which candidate IDs are active in that job
  let jobCandidateIds: string[] | undefined
  if (filters.jobId) {
    const { data: apps } = await supabase
      .from('candidate_applications')
      .select('candidate_id')
      .eq('job_opening_id', filters.jobId)
      .not('status', 'in', '(rejected,withdrawn)')

    jobCandidateIds = (apps ?? []).map((a: { candidate_id: string }) => a.candidate_id)
    if (jobCandidateIds.length === 0) return []
  }

  let query = supabase
    .from('candidates')
    .select('*')
    .order('created_at', { ascending: false })

  if (jobCandidateIds) {
    query = query.in('id', jobCandidateIds)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.locationState) {
    query = query.eq('location_state', filters.locationState)
  }
  if (filters.salaryMin !== undefined) {
    query = query.gte('desired_compensation', filters.salaryMin)
  }
  if (filters.salaryMax !== undefined) {
    query = query.lte('desired_compensation', filters.salaryMax)
  }
  if (filters.skills) {
    query = query.ilike('skills', `%${filters.skills}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Jobs dropdown for filter bar ───────────────────────────────────────────

export interface JobDropdownOption {
  id: string
  title: string
  company_name: string | null
}

export async function fetchOpenJobsForDropdown(): Promise<JobDropdownOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('job_openings')
    .select('id, title, companies!company_id ( name )')
    .in('status', ['open', 'on_hold'])
    .order('title', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const companies = row.companies as { name: string } | null
    return {
      id: row.id as string,
      title: row.title as string,
      company_name: companies?.name ?? null,
    }
  })
}
