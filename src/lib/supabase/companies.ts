// Server-side Supabase functions for companies.
// Use these only in Server Components (pages, layouts).
// Client components (forms, delete buttons) must use companies-client.ts.

import { createClient } from './server'
import type { Company } from '@/types/database'
import type { OpenTask } from '@/lib/prospects'

export async function getCompanies(
  page = 1,
  pageSize = 25,
): Promise<{ data: Company[]; count: number }> {
  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: false })
    .order('name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) throw new Error(error.message)
  return { data: data ?? [], count: count ?? 0 }
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // row not found
    throw new Error(error.message)
  }
  return data
}

// Active prospects only, for the Prospects worklist page (/prospects).
// Ordered by when they entered their current stage (oldest first) as a sensible
// default; the page re-sorts by computed urgency.
export async function getProspects(): Promise<Company[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('status', 'prospect')
    .order('prospect_stage_entered_at', { ascending: true, nullsFirst: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

// Soonest open (incomplete) follow-up per company, keyed by company id.
// Used by the Prospects worklist so a prospect's "next step" comes from the
// follow-ups / Tasks system (the single source of truth) rather than the legacy
// companies.next_step field.
export async function getSoonestOpenTaskByCompany(
  companyIds: string[],
): Promise<Map<string, OpenTask>> {
  const map = new Map<string, OpenTask>()
  if (companyIds.length === 0) return map

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('follow_ups')
    .select('entity_id, title, due_date')
    .eq('entity_type', 'company')
    .eq('is_completed', false)
    .in('entity_id', companyIds)
    .order('due_date', { ascending: true })

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const id = row.entity_id as string
    // Rows are ordered by due_date asc, so the first seen per company is soonest.
    if (!map.has(id)) {
      map.set(id, { title: row.title as string, due_date: row.due_date as string })
    }
  }
  return map
}
