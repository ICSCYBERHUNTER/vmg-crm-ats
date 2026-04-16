// Server-side helper to fetch referrer name and link for detail pages.
// Used by both company and candidate detail pages.

import { createClient } from './server'

interface ReferrerInfo {
  name: string | null
  href: string | null
}

export async function getReferrerInfo(
  type: 'contact' | 'candidate',
  id: string
): Promise<ReferrerInfo> {
  const supabase = await createClient()

  if (type === 'candidate') {
    const { data } = await supabase
      .from('candidates')
      .select('first_name, last_name')
      .eq('id', id)
      .single()

    if (!data) return { name: null, href: null }
    return {
      name: `${data.first_name} ${data.last_name}`,
      href: `/candidates/${id}`,
    }
  }

  // type === 'contact'
  const { data } = await supabase
    .from('company_contacts')
    .select('first_name, last_name, company_id')
    .eq('id', id)
    .single()

  if (!data) return { name: null, href: null }
  return {
    name: `${data.first_name} ${data.last_name}`,
    href: `/companies/${data.company_id}/contacts/${id}`,
  }
}
