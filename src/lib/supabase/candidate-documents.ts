// Browser-side Supabase functions for candidate documents.
// Used from "use client" components only.

import { createClient } from './client'
import type { CandidateDocument } from '@/types/database'

const BUCKET = 'candidate-documents'

export async function fetchCandidateDocuments(
  candidateId: string
): Promise<CandidateDocument[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('candidate_documents')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('is_primary', { ascending: false })
    .order('uploaded_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as CandidateDocument[]
}

export async function uploadCandidateDocument(params: {
  candidateId: string
  file: File
  fileType: 'resume' | 'cv' | 'cover_letter' | 'portfolio' | 'other'
  notes?: string
  isPrimary: boolean
}): Promise<CandidateDocument> {
  const supabase = createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Not authenticated')

  const storagePath = `${params.candidateId}/${Date.now()}_${params.file.name}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, params.file)

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data, error: insertError } = await supabase
    .from('candidate_documents')
    .insert({
      candidate_id: params.candidateId,
      file_name: params.file.name,
      file_type: params.fileType,
      storage_path: storagePath,
      file_size_bytes: params.file.size,
      mime_type: params.file.type,
      is_primary: params.isPrimary,
      notes: params.notes ?? null,
      uploaded_by: userData.user.id,
    })
    .select()
    .single()

  if (insertError) {
    // Clean up orphaned storage file before throwing
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw new Error(`Failed to save document record: ${insertError.message}`)
  }

  return data as CandidateDocument
}

export async function deleteCandidateDocument(
  document: CandidateDocument
): Promise<void> {
  const supabase = createClient()

  const { error: dbError } = await supabase
    .from('candidate_documents')
    .delete()
    .eq('id', document.id)

  if (dbError) throw new Error(dbError.message)

  // Delete from storage after DB row is gone (orphaned file acceptable over lost record)
  await supabase.storage.from(BUCKET).remove([document.storage_path])
}

export async function setDocumentAsPrimary(
  documentId: string
): Promise<CandidateDocument> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('candidate_documents')
    .update({ is_primary: true })
    .eq('id', documentId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CandidateDocument
}

export async function getDocumentDownloadUrl(
  storagePath: string
): Promise<string> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60)

  if (error) throw new Error(`Could not generate download URL: ${error.message}`)
  return data.signedUrl
}

export async function getDocumentCount(candidateId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('candidate_documents')
    .select('*', { count: 'exact', head: true })
    .eq('candidate_id', candidateId)

  if (error) throw new Error(error.message)
  return count ?? 0
}
