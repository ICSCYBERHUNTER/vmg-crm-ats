'use client'

import { createClient } from '@/lib/supabase/client'
import { analyzeProspect, todayStr, isActiveDisposition, type OpenTask } from '@/lib/prospects'
import type { CompanyDisposition } from '@/types/database'

export interface QuickStats {
  totalCandidates: number
  clientCompanies: number
  openJobs: number
  activeProspects: number
}

export interface ProspectPipelineCounts {
  researching: number
  targeted: number
  contacted: number
  negotiating_fee: number
  needs_attention: number
}

export interface ActiveJobOpeningRow {
  id: string
  title: string
  company_name: string
  company_status: string | null
  priority: string | null
  status: string
  opened_at: string
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

  const { data: prospects, error } = await supabase
    .from('companies')
    .select(
      'id, prospect_stage, prospect_stage_entered_at, last_contacted_at, next_step, next_step_due_date, disposition',
    )
    .eq('status', 'prospect')

  if (error) throw error
  const rows = prospects ?? []
  const ids = rows.map((r) => r.id as string)

  // Soonest open follow-up per company — the "next step" (single source of truth).
  const taskMap = new Map<string, OpenTask>()
  if (ids.length > 0) {
    const { data: tasks } = await supabase
      .from('follow_ups')
      .select('entity_id, title, due_date')
      .eq('entity_type', 'company')
      .eq('is_completed', false)
      .in('entity_id', ids)
      .order('due_date', { ascending: true })
    for (const t of tasks ?? []) {
      const id = t.entity_id as string
      if (!taskMap.has(id)) taskMap.set(id, { title: t.title as string, due_date: t.due_date as string })
    }
  }

  const today = todayStr()
  const counts: ProspectPipelineCounts = {
    researching: 0,
    targeted: 0,
    contacted: 0,
    negotiating_fee: 0,
    needs_attention: 0,
  }

  for (const r of rows) {
    if (!isActiveDisposition(r.disposition as CompanyDisposition | null)) continue
    const stage = r.prospect_stage as string | null
    if (stage === 'researching' || stage === 'targeted' || stage === 'contacted' || stage === 'negotiating_fee') {
      counts[stage] += 1
    }
    const signals = analyzeProspect(
      {
        prospect_stage_entered_at: r.prospect_stage_entered_at as string | null,
        last_contacted_at: r.last_contacted_at as string | null,
        next_step: r.next_step as string | null,
        next_step_due_date: r.next_step_due_date as string | null,
      },
      today,
      taskMap.get(r.id as string),
    )
    if (signals.attention) counts.needs_attention += 1
  }

  return counts
}

export async function fetchActiveJobOpenings(): Promise<ActiveJobOpeningRow[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('job_openings')
    .select('id, title, status, priority, opened_at, companies(name, status)')
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
      ((row.companies as unknown as { name: string; status: string })?.name) ?? '—',
    company_status:
      ((row.companies as unknown as { name: string; status: string })?.status) ?? null,
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
