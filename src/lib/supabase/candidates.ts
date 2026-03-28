import { createClient } from './server'
import type { Candidate, CandidateInsert, CandidateUpdate } from '@/types/database'

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

export async function createCandidate(data: CandidateInsert): Promise<Candidate> {
  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('candidates')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}

export async function updateCandidate(id: string, data: CandidateUpdate): Promise<Candidate> {
  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('candidates')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return updated
}

export async function deleteCandidate(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function getCandidatesCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })

  if (error) throw new Error(error.message)
  return count ?? 0
}
