'use client'

import { createClient } from '@/lib/supabase/client'

export interface QuickStats {
  totalCandidates: number
  clientCompanies: number
  openJobs: number
  activeProspects: number
}

export interface ProspectPipelineCounts {
  targeted: number
  contacted: number
  negotiating_fee: number
  closed: number
}

export interface ActiveJobOpeningRow {
  id: string
  title: string
  company_name: string
  priority: string | null
  status: string
  opened_at: string
}

export interface OverdueItem {
  id: string
  next_step: string
  next_step_due_date: string
  source_type: 'job' | 'company'
  source_label: string
  days_overdue: number
}

export interface PipelineSnapshotStage {
  stage_name: string
  candidate_count: number
}

export async function fetchQuickStats(): Promise<QuickStats> {
  const supabase = createClient()
  const today = new Date().toISOString()
  void today // suppress lint

  const [candidatesResult, clientsResult, openJobsResult, prospectsResult] =
    await Promise.all([
      supabase.from('candidates').select('*', { count: 'exact', head: true }),
      supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'client'),
      supabase
        .from('job_openings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'prospect'),
    ])

  return {
    totalCandidates: candidatesResult.count ?? 0,
    clientCompanies: clientsResult.count ?? 0,
    openJobs: openJobsResult.count ?? 0,
    activeProspects: prospectsResult.count ?? 0,
  }
}

export async function fetchProspectPipeline(): Promise<ProspectPipelineCounts> {
  const supabase = createClient()

  const [targeted, contacted, negotiating, closed] = await Promise.all([
    supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'prospect')
      .eq('prospect_stage', 'targeted'),
    supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'prospect')
      .eq('prospect_stage', 'contacted'),
    supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'prospect')
      .eq('prospect_stage', 'negotiating_fee'),
    supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'prospect')
      .eq('prospect_stage', 'closed'),
  ])

  return {
    targeted: targeted.count ?? 0,
    contacted: contacted.count ?? 0,
    negotiating_fee: negotiating.count ?? 0,
    closed: closed.count ?? 0,
  }
}

export async function fetchActiveJobOpenings(): Promise<ActiveJobOpeningRow[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('job_openings')
    .select('id, title, status, priority, opened_at, companies(name)')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(10)

  if (error) throw error

  const priorityOrder: Record<string, number> = {
    high: 1,
    medium: 2,
    low: 3,
  }

  const rows: ActiveJobOpeningRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    company_name:
      (row.companies as { name: string } | null)?.name ?? '—',
    priority: row.priority as string | null,
    status: row.status as string,
    opened_at: row.opened_at as string,
  }))

  rows.sort((a, b) => {
    const pa = priorityOrder[a.priority ?? ''] ?? 4
    const pb = priorityOrder[b.priority ?? ''] ?? 4
    if (pa !== pb) return pa - pb
    return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
  })

  return rows
}

export async function fetchOverdueNextSteps(): Promise<OverdueItem[]> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [jobsResult, companiesResult] = await Promise.all([
    supabase
      .from('job_openings')
      .select('id, title, next_step, next_step_due_date, companies(name)')
      .not('next_step', 'is', null)
      .not('next_step_due_date', 'is', null)
      .lt('next_step_due_date', today)
      .in('status', ['open', 'on_hold']),
    supabase
      .from('companies')
      .select('id, name, next_step, next_step_due_date')
      .not('next_step', 'is', null)
      .not('next_step_due_date', 'is', null)
      .lt('next_step_due_date', today)
      .eq('status', 'prospect'),
  ])

  const todayDate = new Date(today)

  const jobItems: OverdueItem[] = (jobsResult.data ?? []).map((row) => {
    const dueDate = new Date(row.next_step_due_date as string)
    const daysOverdue = Math.floor(
      (todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    const companyName =
      (row.companies as { name: string } | null)?.name ?? ''
    return {
      id: row.id as string,
      next_step: row.next_step as string,
      next_step_due_date: row.next_step_due_date as string,
      source_type: 'job',
      source_label: companyName
        ? `${row.title as string} @ ${companyName}`
        : (row.title as string),
      days_overdue: daysOverdue,
    }
  })

  const companyItems: OverdueItem[] = (companiesResult.data ?? []).map(
    (row) => {
      const dueDate = new Date(row.next_step_due_date as string)
      const daysOverdue = Math.floor(
        (todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        id: row.id as string,
        next_step: row.next_step as string,
        next_step_due_date: row.next_step_due_date as string,
        source_type: 'company',
        source_label: `${row.name as string} (prospect)`,
        days_overdue: daysOverdue,
      }
    }
  )

  return [...jobItems, ...companyItems].sort(
    (a, b) => b.days_overdue - a.days_overdue
  )
}

export async function fetchPipelineSnapshot(): Promise<PipelineSnapshotStage[]> {
  const supabase = createClient()

  // Get all pipeline stages for open jobs
  const { data: stages, error: stagesError } = await supabase
    .from('pipeline_stages')
    .select('id, name, sort_order, job_opening_id, job_openings!inner(status)')
    .eq('job_openings.status', 'open')

  if (stagesError) throw stagesError
  if (!stages || stages.length === 0) return []

  // Get active applications for those stages
  const stageIds = stages.map((s) => s.id as string)
  const { data: applications, error: appsError } = await supabase
    .from('candidate_applications')
    .select('current_stage_id')
    .in('current_stage_id', stageIds)
    .eq('status', 'active')

  if (appsError) throw appsError

  // Count apps per stage_id
  const countByStageId: Record<string, number> = {}
  for (const app of applications ?? []) {
    const sid = app.current_stage_id as string
    countByStageId[sid] = (countByStageId[sid] ?? 0) + 1
  }

  // Group by stage name (case-insensitive), sum counts, track avg sort_order
  const nameMap: Record<
    string,
    { total: number; sortOrderSum: number; stageCount: number }
  > = {}

  for (const stage of stages) {
    const key = (stage.name as string).toLowerCase()
    const count = countByStageId[stage.id as string] ?? 0
    if (!nameMap[key]) {
      nameMap[key] = {
        total: 0,
        sortOrderSum: 0,
        stageCount: 0,
      }
    }
    nameMap[key].total += count
    nameMap[key].sortOrderSum += stage.sort_order as number
    nameMap[key].stageCount += 1
  }

  // Build result, skip stages with 0 candidates
  const result: PipelineSnapshotStage[] = Object.entries(nameMap)
    .filter(([, v]) => v.total > 0)
    .map(([key, v]) => {
      // Find the original cased name from stages
      const original = stages.find(
        (s) => (s.name as string).toLowerCase() === key
      )
      return {
        stage_name: (original?.name as string) ?? key,
        candidate_count: v.total,
        _avgSortOrder: v.sortOrderSum / v.stageCount,
      }
    })
    .sort(
      (a, b) =>
        (a as unknown as { _avgSortOrder: number })._avgSortOrder -
        (b as unknown as { _avgSortOrder: number })._avgSortOrder
    )
    .map(({ stage_name, candidate_count }) => ({ stage_name, candidate_count }))

  return result
}
