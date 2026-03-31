// Browser-side Supabase functions for talent pools.
// Uses createBrowserClient (no next/headers).

import { createClient } from './client'
import type {
  TalentPool,
  TalentPoolWithCount,
  TalentPoolMemberWithCandidate,
} from '@/types/database'

// ─── Pool CRUD ───────────────────────────────────────────────────────────────

export async function getTalentPools(): Promise<TalentPoolWithCount[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('talent_pools')
    .select('*, talent_pool_members(count)')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((pool) => ({
    ...pool,
    member_count: pool.talent_pool_members?.[0]?.count ?? 0,
  }))
}

export async function getTalentPool(id: string): Promise<TalentPool | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('talent_pools')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data
}

export async function createTalentPool(input: {
  name: string
  description?: string | null
}): Promise<TalentPool> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('talent_pools')
    .insert({
      name: input.name,
      description: input.description ?? null,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateTalentPool(
  id: string,
  input: { name?: string; description?: string | null }
): Promise<TalentPool> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('talent_pools')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteTalentPool(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('talent_pools')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Pool Members ────────────────────────────────────────────────────────────

export async function getTalentPoolMembers(
  poolId: string
): Promise<TalentPoolMemberWithCandidate[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('talent_pool_members')
    .select(`
      id,
      pool_id,
      candidate_id,
      added_by,
      added_at,
      candidates (
        first_name,
        last_name,
        current_title,
        current_company,
        category,
        seniority_level,
        location_city,
        location_state,
        is_star
      )
    `)
    .eq('pool_id', poolId)

  if (error) throw new Error(error.message)

  // Map the joined data and sort by full name
  const members = (data ?? []).map((row) => {
    const c = row.candidates as unknown as Record<string, unknown> | null
    return {
      id: row.id,
      pool_id: row.pool_id,
      candidate_id: row.candidate_id,
      added_by: row.added_by,
      added_at: row.added_at,
      candidate: {
        full_name: c ? `${c.first_name} ${c.last_name}` : 'Unknown',
        current_title: (c?.current_title as string) ?? null,
        current_company: (c?.current_company as string) ?? null,
        category: (c?.category as string) ?? null,
        seniority_level: (c?.seniority_level as string) ?? null,
        location_city: (c?.location_city as string) ?? null,
        location_state: (c?.location_state as string) ?? null,
        is_star: (c?.is_star as boolean) ?? false,
      },
    }
  }) as TalentPoolMemberWithCandidate[]

  members.sort((a, b) =>
    a.candidate.full_name.localeCompare(b.candidate.full_name)
  )

  return members
}

export async function addCandidateToPool(
  poolId: string,
  candidateId: string
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('talent_pool_members')
    .insert({
      pool_id: poolId,
      candidate_id: candidateId,
      added_by: user?.id ?? null,
    })

  // Ignore unique constraint violation (candidate already in pool)
  if (error && error.code !== '23505') {
    throw new Error(error.message)
  }
}

export async function removeCandidateFromPool(
  poolId: string,
  candidateId: string
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('talent_pool_members')
    .delete()
    .eq('pool_id', poolId)
    .eq('candidate_id', candidateId)

  if (error) throw new Error(error.message)
}

// ─── Job Openings (for bulk submit) ──────────────────────────────────────────

export interface OpenJobOpening {
  id: string
  title: string
  company_name: string | null
}

export async function getOpenJobOpenings(): Promise<OpenJobOpening[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('job_openings')
    .select('id, title, companies!company_id(name)')
    .eq('status', 'open')

  if (error) throw new Error(error.message)

  const results = (data ?? []).map((row) => {
    const company = row.companies as unknown as { name: string } | null
    return {
      id: row.id,
      title: row.title,
      company_name: company?.name ?? null,
    }
  })

  // Sort by company name, then title
  results.sort((a, b) => {
    const companyA = a.company_name ?? ''
    const companyB = b.company_name ?? ''
    if (companyA !== companyB) return companyA.localeCompare(companyB)
    return a.title.localeCompare(b.title)
  })

  return results
}

export interface BulkSubmitResult {
  added: number
  skipped: number
  skippedNames: string[]
}

export async function bulkSubmitToJob(
  jobOpeningId: string,
  candidates: Array<{ id: string; name: string }>
): Promise<BulkSubmitResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get the first pipeline stage once (shared for all candidates)
  const { data: firstStage, error: stageError } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('job_opening_id', jobOpeningId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single()

  if (stageError || !firstStage) {
    throw new Error('This job has no pipeline stages. Add stages before submitting candidates.')
  }

  // Fetch existing applications for these candidates in one query
  const candidateIds = candidates.map((c) => c.id)
  const { data: existing, error: existingError } = await supabase
    .from('candidate_applications')
    .select('candidate_id')
    .eq('job_opening_id', jobOpeningId)
    .in('candidate_id', candidateIds)

  if (existingError) throw new Error(existingError.message)

  const alreadyApplied = new Set((existing ?? []).map((r) => r.candidate_id))

  let added = 0
  const skippedNames: string[] = []

  // Process candidates sequentially to avoid race conditions
  for (const candidate of candidates) {
    if (alreadyApplied.has(candidate.id)) {
      skippedNames.push(candidate.name)
      continue
    }

    const { data: application, error: insertError } = await supabase
      .from('candidate_applications')
      .insert({
        candidate_id: candidate.id,
        job_opening_id: jobOpeningId,
        current_stage_id: firstStage.id,
        status: 'active',
        applied_at: new Date().toISOString(),
        created_by: user?.id ?? null,
      })
      .select('id')
      .single()

    if (insertError) {
      // Unique constraint — another process already inserted; treat as skipped
      if (insertError.code === '23505') {
        skippedNames.push(candidate.name)
        continue
      }
      throw new Error(insertError.message)
    }

    await supabase.from('application_stage_history').insert({
      application_id: application.id,
      from_stage_id: null,
      to_stage_id: firstStage.id,
      moved_by: user?.id ?? null,
      notes: 'Candidate submitted to pipeline',
    })

    added++
  }

  return { added, skipped: skippedNames.length, skippedNames }
}

// ─── Candidate Pool Memberships ──────────────────────────────────────────────

export interface CandidatePoolMembership {
  pool_id: string
  pool_name: string
}

export async function getCandidatePoolMemberships(
  candidateId: string
): Promise<CandidatePoolMembership[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('talent_pool_members')
    .select('pool_id, talent_pools(name)')
    .eq('candidate_id', candidateId)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    pool_id: row.pool_id,
    pool_name: (row.talent_pools as unknown as { name: string } | null)?.name ?? '',
  }))
}

// ─── Candidate Search (for adding to pool) ───────────────────────────────────

export interface PoolCandidateSearchResult {
  id: string
  full_name: string
  current_title: string | null
  current_company: string | null
}

export async function searchCandidatesForPool(
  poolId: string,
  searchTerm: string
): Promise<PoolCandidateSearchResult[]> {
  const supabase = createClient()

  // Get IDs of candidates already in this pool
  const { data: existing, error: existingError } = await supabase
    .from('talent_pool_members')
    .select('candidate_id')
    .eq('pool_id', poolId)

  if (existingError) throw new Error(existingError.message)

  const excludeIds = (existing ?? []).map((r) => r.candidate_id)

  // Search candidates by name, excluding those already in the pool
  const words = searchTerm.split(' ').filter((w) => w.length > 0)

  let query = supabase
    .from('candidates')
    .select('id, first_name, last_name, current_title, current_company')
    .limit(10)

  for (const word of words) {
    query = query.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`)
  }

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).map((c) => ({
    id: c.id,
    full_name: `${c.first_name} ${c.last_name}`,
    current_title: c.current_title,
    current_company: c.current_company,
  }))
}
