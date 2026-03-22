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
