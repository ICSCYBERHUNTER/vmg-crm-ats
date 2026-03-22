// Browser-side Supabase RPC calls for candidate <-> contact linking.
// These call the database functions created in the linking migration.

import { createClient } from './client'

export async function createCandidateFromContact(
  contactId: string,
  createdBy: string
): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('create_candidate_from_contact', {
    p_contact_id: contactId,
    p_created_by: createdBy,
  })

  if (error) throw new Error(error.message)
  return data as string
}

export async function createContactFromCandidate(
  candidateId: string,
  companyId: string,
  createdBy: string
): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('create_contact_from_candidate', {
    p_candidate_id: candidateId,
    p_company_id: companyId,
    p_created_by: createdBy,
  })

  if (error) throw new Error(error.message)
  return data as string
}

export async function unlinkCandidateContact(
  candidateId: string,
  contactId: string
): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('unlink_candidate_contact', {
    p_candidate_id: candidateId,
    p_contact_id: contactId,
  })

  if (error) throw new Error(error.message)
  return data as boolean
}
