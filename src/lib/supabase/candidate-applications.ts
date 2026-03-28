'use client'

import { createClient } from './client'
import type { CandidateApplication } from '@/types/database'

// ─── Submit ──────────────────────────────────────────────────────────────────

export async function submitCandidateToJob(
  candidateId: string,
  jobOpeningId: string,
): Promise<CandidateApplication> {
  const supabase = createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch the first pipeline stage (lowest sort_order)
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

  // Insert the application
  const { data: application, error: insertError } = await supabase
    .from('candidate_applications')
    .insert({
      candidate_id: candidateId,
      job_opening_id: jobOpeningId,
      current_stage_id: firstStage.id,
      status: 'active',
      applied_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      throw new Error('This candidate has already been submitted to this job.')
    }
    throw new Error(insertError.message)
  }

  // Record initial stage history
  await supabase.from('application_stage_history').insert({
    application_id: application.id,
    from_stage_id: null,
    to_stage_id: firstStage.id,
    moved_by: user?.id ?? null,
    notes: 'Candidate submitted to pipeline',
  })

  return application as CandidateApplication
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function fetchApplicationsByJob(
  jobOpeningId: string,
): Promise<CandidateApplication[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('candidate_applications')
    .select(`
      *,
      candidates!candidate_id ( first_name, last_name, current_title, current_company ),
      pipeline_stages!current_stage_id ( name )
    `)
    .eq('job_opening_id', jobOpeningId)
    .order('applied_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const candidate = row.candidates as {
      first_name: string; last_name: string
      current_title: string | null; current_company: string | null
    } | null
    const stage = row.pipeline_stages as { name: string } | null

    const app = { ...row } as unknown as CandidateApplication
    app.candidate_name = candidate
      ? `${candidate.first_name} ${candidate.last_name}`.trim()
      : undefined
    app.candidate_current_title = candidate?.current_title ?? undefined
    app.candidate_current_company = candidate?.current_company ?? undefined
    app.current_stage_name = stage?.name ?? undefined

    // Clean up nested join objects
    const mutable = app as unknown as Record<string, unknown>
    delete mutable.candidates
    delete mutable.pipeline_stages
    return app
  })
}

export async function fetchApplicationsByCandidate(
  candidateId: string,
): Promise<CandidateApplication[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('candidate_applications')
    .select(`
      *,
      job_openings!job_opening_id ( title, company_id, companies!company_id ( name ) ),
      pipeline_stages!current_stage_id ( name )
    `)
    .eq('candidate_id', candidateId)
    .order('applied_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const job = row.job_openings as {
      title: string
      company_id: string
      companies: { name: string } | null
    } | null
    const stage = row.pipeline_stages as { name: string } | null

    const app = { ...row } as unknown as CandidateApplication
    app.job_title = job?.title ?? undefined
    app.company_name = job?.companies?.name ?? undefined
    app.current_stage_name = stage?.name ?? undefined

    const mutable = app as unknown as Record<string, unknown>
    delete mutable.job_openings
    delete mutable.pipeline_stages
    return app
  })
}

// ─── Status changes ──────────────────────────────────────────────────────────

export async function rejectApplication(
  applicationId: string,
  rejectionStageId: string,
  rejectionReason: string,
): Promise<CandidateApplication> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('candidate_applications')
    .update({
      status: 'rejected',
      rejection_stage_id: rejectionStageId,
      rejection_reason: rejectionReason,
      rejected_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CandidateApplication
}

export async function withdrawApplication(
  applicationId: string,
): Promise<CandidateApplication> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('candidate_applications')
    .update({ status: 'withdrawn' })
    .eq('id', applicationId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CandidateApplication
}

export async function reactivateApplication(
  applicationId: string,
): Promise<CandidateApplication> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('candidate_applications')
    .update({
      status: 'active',
      rejection_stage_id: null,
      rejection_reason: null,
      rejected_at: null,
    })
    .eq('id', applicationId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CandidateApplication
}

// ─── Remove (delete application entirely) ───────────────────────────────────

export async function removeApplication(applicationId: string): Promise<void> {
  const supabase = createClient()

  // Delete stage history first (FK constraint)
  const { error: historyError } = await supabase
    .from('application_stage_history')
    .delete()
    .eq('application_id', applicationId)

  if (historyError) throw new Error(historyError.message)

  // Delete the application row
  const { error: appError } = await supabase
    .from('candidate_applications')
    .delete()
    .eq('id', applicationId)

  if (appError) throw new Error(appError.message)
}

// ─── Kanban board helpers ───────────────────────────────────────────────────

export async function fetchActiveApplicationsByJob(
  jobOpeningId: string,
): Promise<CandidateApplication[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('candidate_applications')
    .select(`
      id, candidate_id, current_stage_id, applied_at,
      candidates!candidate_id ( first_name, last_name, current_title, current_company )
    `)
    .eq('job_opening_id', jobOpeningId)
    .eq('status', 'active')
    .order('applied_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const candidate = row.candidates as {
      first_name: string; last_name: string
      current_title: string | null; current_company: string | null
    } | null

    const app = { ...row } as unknown as CandidateApplication
    app.candidate_name = candidate
      ? `${candidate.first_name} ${candidate.last_name}`.trim()
      : undefined
    app.candidate_current_title = candidate?.current_title ?? undefined
    app.candidate_current_company = candidate?.current_company ?? undefined

    const mutable = app as unknown as Record<string, unknown>
    delete mutable.candidates
    return app
  })
}

export async function moveApplicationToStage(
  applicationId: string,
  fromStageId: string,
  toStageId: string,
): Promise<{ error: Error | null }> {
  const supabase = createClient()

  // Update current stage
  const { error: updateError } = await supabase
    .from('candidate_applications')
    .update({ current_stage_id: toStageId })
    .eq('id', applicationId)

  if (updateError) return { error: new Error(updateError.message) }

  // Record stage history (supplementary — don't fail the move if this errors)
  const { data: { user } } = await supabase.auth.getUser()

  await supabase.from('application_stage_history').insert({
    application_id: applicationId,
    from_stage_id: fromStageId,
    to_stage_id: toStageId,
    moved_by: user?.id ?? null,
    moved_at: new Date().toISOString(),
  })

  return { error: null }
}

// ─── Search helpers for dialogs ──────────────────────────────────────────────

export async function fetchCandidatesNotInJob(
  jobOpeningId: string,
  searchQuery?: string,
): Promise<{ id: string; first_name: string; last_name: string; current_title: string | null; current_company: string | null }[]> {
  const supabase = createClient()

  // Get candidate IDs already submitted to this job
  const { data: existing } = await supabase
    .from('candidate_applications')
    .select('candidate_id')
    .eq('job_opening_id', jobOpeningId)

  const excludeIds = (existing ?? []).map(r => r.candidate_id)

  let query = supabase
    .from('candidates')
    .select('id, first_name, last_name, current_title, current_company')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .limit(20)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  if (searchQuery && searchQuery.trim()) {
    const q = `%${searchQuery.trim()}%`
    query = query.or(`first_name.ilike.${q},last_name.ilike.${q},current_title.ilike.${q}`)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchOpenJobsForCandidate(
  candidateId: string,
  searchQuery?: string,
): Promise<{ id: string; title: string; company_name: string | null; status: string }[]> {
  const supabase = createClient()

  // Get job IDs already applied to
  const { data: existing } = await supabase
    .from('candidate_applications')
    .select('job_opening_id')
    .eq('candidate_id', candidateId)

  const excludeIds = (existing ?? []).map(r => r.job_opening_id)

  let query = supabase
    .from('job_openings')
    .select('id, title, status, companies!company_id ( name )')
    .eq('status', 'open')
    .order('title', { ascending: true })
    .limit(20)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  if (searchQuery && searchQuery.trim()) {
    const q = `%${searchQuery.trim()}%`
    query = query.or(`title.ilike.${q}`)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const companies = row.companies as { name: string } | null
    return {
      id: row.id as string,
      title: row.title as string,
      company_name: companies?.name ?? null,
      status: row.status as string,
    }
  })
}
