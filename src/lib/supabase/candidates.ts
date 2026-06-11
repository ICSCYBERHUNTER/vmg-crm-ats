import { createClient } from './server'
import type { Candidate } from '@/types/database'

export async function getCandidates(
  page = 1,
  pageSize = 25,
): Promise<{ data: Candidate[]; count: number }> {
  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) throw new Error(error.message)
  return { data: data ?? [], count: count ?? 0 }
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // row not found
    throw new Error(error.message)
  }
  return data
}

