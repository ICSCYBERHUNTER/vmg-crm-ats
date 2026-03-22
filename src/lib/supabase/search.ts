'use client'

import { createClient } from '@/lib/supabase/client'
import type { SearchResult } from '@/types/database'

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('global_search', {
    search_query: query,
  })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Search failed:', error.message)
    return []
  }

  return (data as SearchResult[]) ?? []
}

export async function fetchContactCompanyId(
  contactId: string
): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('company_contacts')
    .select('company_id')
    .eq('id', contactId)
    .single()

  if (error) {
    return null
  }

  return data?.company_id ?? null
}
