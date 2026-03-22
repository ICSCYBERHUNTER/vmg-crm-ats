'use client'

import { createClient } from './client'
import type { PipelineStage } from '@/types/database'

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function fetchPipelineStages(jobOpeningId: string): Promise<PipelineStage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('job_opening_id', jobOpeningId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as PipelineStage[]
}

// ─── Write ─────────────────────────────────────────────────────────────────────

export async function createPipelineStage(
  jobOpeningId: string,
  name: string,
  sortOrder: number,
): Promise<PipelineStage> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({ job_opening_id: jobOpeningId, name, sort_order: sortOrder })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PipelineStage
}

export async function updatePipelineStageName(
  stageId: string,
  name: string,
): Promise<PipelineStage> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .update({ name })
    .eq('id', stageId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PipelineStage
}

export async function deletePipelineStage(stageId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', stageId)

  if (error) throw new Error(error.message)
}

// ─── Candidate check ───────────────────────────────────────────────────────────

export async function checkStageHasCandidates(stageId: string): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('candidate_applications')
    .select('*', { count: 'exact', head: true })
    .eq('current_stage_id', stageId)
    .eq('status', 'active')

  if (error) throw new Error(error.message)
  return count ?? 0
}

// ─── Reorder ───────────────────────────────────────────────────────────────────

export async function reorderPipelineStages(
  _jobOpeningId: string,
  stages: { id: string; sort_order: number }[],
): Promise<void> {
  const supabase = createClient()
  for (const stage of stages) {
    const { error } = await supabase
      .from('pipeline_stages')
      .update({ sort_order: stage.sort_order })
      .eq('id', stage.id)

    if (error) throw new Error(error.message)
  }
}
