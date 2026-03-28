// Browser-side Supabase functions for use in "use client" components.
// Uses createBrowserClient (no next/headers), so it is safe to import
// from client components like CompanyForm and DeleteCompanyButton.
//
// Server Components should use companies.ts (server client).

import { createClient } from './client'
import type { Company, CompanyInsert, CompanyUpdate } from '@/types/database'

export async function fetchCompanies(): Promise<Company[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function createCompany(data: CompanyInsert): Promise<Company> {
  const supabase = createClient()
  const { data: created, error } = await supabase
    .from('companies')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}

export async function updateCompany(id: string, data: CompanyUpdate): Promise<Company> {
  const supabase = createClient()
  const { data: updated, error } = await supabase
    .from('companies')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return updated
}

export async function deleteCompany(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Filtered list query (for server-side filtering from client components) ──

export interface CompanyFilters {
  status?: string
  priority?: string
  prospectStage?: string
  page?: number
  pageSize?: number
}

export async function getCompaniesFiltered(
  filters: CompanyFilters
): Promise<{ data: Company[]; count: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 25

  let query = supabase
    .from('companies')
    .select('*', { count: 'exact', head: false })
    .order('name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority)
  }
  if (filters.prospectStage) {
    query = query.eq('prospect_stage', filters.prospectStage)
  }

  const { data, count, error } = await query
  if (error) throw new Error(error.message)
  return { data: data ?? [], count: count ?? 0 }
}
