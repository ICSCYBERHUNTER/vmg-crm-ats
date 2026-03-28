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

export interface CandidateFilters {
  status?: string
  category?: string
  seniority?: string
  region?: string
  skills?: string
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

  const { data, count, error } = await query
  if (error) throw new Error(error.message)
  return { data: data ?? [], count: count ?? 0 }
}

