'use client'

import { createClient } from '@/lib/supabase/client'
import { parseQuery } from './search-parser'
import type { SearchResult } from '@/types/database'

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const supabase = createClient()

  // Split user input into loose words + quoted phrases (see search-parser.ts).
  // Unquoted searches give the same behavior as before — looseWords is the
  // whole query and phrases is empty.
  const { looseWords, phrases } = parseQuery(query)

  const { data, error } = await supabase.rpc('global_search_v2', {
    search_query: looseWords,
    phrases,
  })

  if (error) {
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
