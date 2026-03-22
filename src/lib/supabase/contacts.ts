// Server-side Supabase functions for company_contacts.
// Use these only in Server Components (pages, layouts).
// Client components must use contacts-client.ts.

import { createClient } from './server'
import type { CompanyContactWithReportsTo } from '@/types/database'

const CONTACT_SELECT = '*, reports_to:reports_to_id(id, first_name, last_name, title)'

export async function getContactsByCompany(companyId: string): Promise<CompanyContactWithReportsTo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_contacts')
    .select(CONTACT_SELECT)
    .eq('company_id', companyId)
    .order('is_primary', { ascending: false })
    .order('last_name', { ascending: true })

  if (error) throw new Error(error.message)
  return data as CompanyContactWithReportsTo[]
}

export async function getContactById(id: string): Promise<CompanyContactWithReportsTo | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_contacts')
    .select(CONTACT_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data as CompanyContactWithReportsTo
}
