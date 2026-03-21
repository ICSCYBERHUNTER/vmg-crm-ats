// Browser-side Supabase functions for use in "use client" components.
// Uses createBrowserClient (no next/headers), so it is safe to import
// from client components like CandidateForm and DeleteCandidateButton.
//
// Server Components should continue to use candidates.ts (server client).

import { createClient } from './client'
import type { Candidate, CandidateInsert, CandidateUpdate } from '@/types/database'

export async function createCandidate(data: CandidateInsert): Promise<Candidate> {
  const supabase = createClient()
  const { data: created, error } = await supabase
    .from('candidates')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}

export async function updateCandidate(id: string, data: CandidateUpdate): Promise<Candidate> {
  const supabase = createClient()
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
  const supabase = createClient()
  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
