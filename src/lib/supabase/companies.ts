// Server-side Supabase functions for companies.
// Use these only in Server Components (pages, layouts).
// Client components (forms, delete buttons) must use companies-client.ts.

import { createClient } from './server'
import type { Company, CompanyInsert, CompanyUpdate } from '@/types/database'

export async function getCompanies(): Promise<Company[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data
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

export async function createCompany(data: CompanyInsert): Promise<Company> {
  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('companies')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}

export async function updateCompany(id: string, data: CompanyUpdate): Promise<Company> {
  const supabase = await createClient()
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
  const supabase = await createClient()
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
