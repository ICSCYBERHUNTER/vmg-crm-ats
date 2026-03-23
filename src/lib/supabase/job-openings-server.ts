// Server-side Supabase functions for job openings.
// Use these only in Server Components (pages, layouts).
// Client components must use job-openings.ts (browser client).

import { createClient } from './server'
import type { JobOpening } from '@/types/database'

const JOB_SELECT = `
  *,
  companies!company_id ( name, status ),
  company_contacts!hiring_manager_id ( first_name, last_name )
` as const

function mapRow(row: Record<string, unknown>): JobOpening {
  const companies = row.companies as { name: string; status: string } | null
  const contact = row.company_contacts as { first_name: string; last_name: string } | null

  const base = { ...row } as unknown as JobOpening
  base.company_name = companies?.name ?? undefined
  base.company_status = companies?.status ?? undefined
  base.hiring_manager_name = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : undefined
  const mutable = base as unknown as Record<string, unknown>
  delete mutable.companies
  delete mutable.company_contacts
  return base
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export async function getJobOpenings(): Promise<JobOpening[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('job_openings')
    .select(JOB_SELECT)
    .order('opened_at', { ascending: false })

  if (error) throw new Error(error.message)

  const mapped = ((data ?? []) as Record<string, unknown>[]).map(mapRow)
  mapped.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 3
    const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 3
    if (pa !== pb) return pa - pb
    return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
  })
  return mapped
}

export async function getJobOpeningById(id: string): Promise<JobOpening | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('job_openings')
    .select(JOB_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return mapRow(data as Record<string, unknown>)
}
