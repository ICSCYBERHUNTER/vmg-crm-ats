// Browser-side Supabase functions for company_contacts.
// Uses createBrowserClient — safe to import from "use client" components.
// Server Components should use contacts.ts (server client).

import { createClient } from './client'
import type {
  CompanyContactInsert,
  CompanyContactUpdate,
  CompanyContactWithReportsTo,
} from '@/types/database'

const CONTACT_SELECT = '*, reports_to:reports_to_id(id, first_name, last_name, title)'

export async function fetchContactsByCompany(companyId: string): Promise<CompanyContactWithReportsTo[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('company_contacts')
    .select(CONTACT_SELECT)
    .eq('company_id', companyId)
    .order('is_primary', { ascending: false })
    .order('last_name', { ascending: true })

  if (error) throw new Error(error.message)
  return data as CompanyContactWithReportsTo[]
}

export async function createContact(
  companyId: string,
  data: Omit<CompanyContactInsert, 'company_id'>
): Promise<CompanyContactWithReportsTo> {
  const supabase = createClient()

  // If marking as primary, clear primary on other contacts at this company first
  if (data.is_primary) {
    await supabase
      .from('company_contacts')
      .update({ is_primary: false })
      .eq('company_id', companyId)
      .eq('is_primary', true)
  }

  const { data: created, error } = await supabase
    .from('company_contacts')
    .insert({ ...data, company_id: companyId })
    .select(CONTACT_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return created as CompanyContactWithReportsTo
}

export async function updateContact(
  id: string,
  companyId: string,
  data: CompanyContactUpdate
): Promise<CompanyContactWithReportsTo> {
  const supabase = createClient()

  // If marking as primary, clear primary on other contacts at this company first
  if (data.is_primary) {
    await supabase
      .from('company_contacts')
      .update({ is_primary: false })
      .eq('company_id', companyId)
      .eq('is_primary', true)
      .neq('id', id)
  }

  const { data: updated, error } = await supabase
    .from('company_contacts')
    .update(data)
    .eq('id', id)
    .select(CONTACT_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return updated as CompanyContactWithReportsTo
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('company_contacts')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
