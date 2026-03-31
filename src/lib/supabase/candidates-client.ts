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

import { US_REGIONS } from '@/lib/utils/labels'

export async function toggleStar(candidateId: string, isStar: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('candidates')
    .update({ is_star: isStar })
    .eq('id', candidateId)

  if (error) throw new Error(error.message)
}

export async function getStarredCandidateIds(): Promise<Set<string>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('candidates')
    .select('id')
    .eq('is_star', true)

  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((r) => r.id))
}

export interface CandidateFilters {
  status?: string
  category?: string
  seniority?: string
  region?: string
  skills?: string
  starredOnly?: boolean
  page?: number
  pageSize?: number
}

export async function getCandidatesFiltered(
  filters: CandidateFilters
): Promise<{ data: Candidate[]; count: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 25

  let query = supabase
    .from('candidates')
    .select('*', { count: 'exact', head: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.seniority) {
    query = query.eq('seniority_level', filters.seniority)
  }
  if (filters.region) {
    const states = US_REGIONS[filters.region]
    if (states) {
      query = query.in('location_state', states)
    }
  }
  if (filters.skills) {
    query = query.ilike('skills', `%${filters.skills}%`)
  }
  if (filters.starredOnly) {
    query = query.eq('is_star', true)
  }

  const { data, count, error } = await query
  if (error) throw new Error(error.message)
  return { data: data ?? [], count: count ?? 0 }
}

// ─── Unlinked Candidate Search (for linking as company contact) ───────────────

export interface UnlinkedCandidateResult {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  linkedin_url: string | null
  current_title: string | null
  current_company: string | null
}

export async function searchUnlinkedCandidates(
  searchTerm: string
): Promise<UnlinkedCandidateResult[]> {
  const supabase = createClient()
  const words = searchTerm.split(' ').filter((w) => w.length > 0)

  let query = supabase
    .from('candidates')
    .select('id, first_name, last_name, email, phone, linkedin_url, current_title, current_company')
    .is('linked_contact_id', null)
    .limit(10)

  for (const word of words) {
    query = query.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((c) => ({
    id: c.id,
    full_name: `${c.first_name} ${c.last_name}`,
    email: c.email,
    phone: c.phone,
    linkedin_url: c.linkedin_url,
    current_title: c.current_title,
    current_company: c.current_company,
  }))
}
