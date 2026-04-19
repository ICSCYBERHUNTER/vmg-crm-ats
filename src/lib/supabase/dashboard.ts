'use client'

import { createClient } from '@/lib/supabase/client'

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
  closed: number
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

  const [researching, targeted, contacted, negotiating, closed] = await Promise.all([
    supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'prospect')
      .eq('prospect_stage', 'researching'),
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
    researching: researching.count ?? 0,
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
