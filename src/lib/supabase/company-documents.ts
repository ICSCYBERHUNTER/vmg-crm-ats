// Browser-side Supabase functions for company documents.
// Used from "use client" components only.

import { createClient } from './client'
import type { CompanyDocument } from '@/types/database'

const BUCKET = 'company-documents'

export async function fetchCompanyDocuments(
  companyId: string
): Promise<CompanyDocument[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('company_documents')
    .select('*')
    .eq('company_id', companyId)
    .order('is_primary', { ascending: false })
    .order('uploaded_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as CompanyDocument[]
}

export async function uploadCompanyDocument(params: {
  companyId: string
  file: File
  fileType: 'fee_agreement' | 'nda' | 'other'
  notes?: string
  isPrimary: boolean
}): Promise<CompanyDocument> {
  const supabase = createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Not authenticated')

  const storagePath = `${params.companyId}/${Date.now()}_${params.file.name}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, params.file)

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data, error: insertError } = await supabase
    .from('company_documents')
    .insert({
      company_id: params.companyId,
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

  return data as CompanyDocument
}

export async function deleteCompanyDocument(
  document: CompanyDocument
): Promise<void> {
  const supabase = createClient()

  const { error: dbError } = await supabase
    .from('company_documents')
    .delete()
    .eq('id', document.id)

  if (dbError) throw new Error(dbError.message)

  // Delete from storage after DB row is gone (orphaned file acceptable over lost record)
  await supabase.storage.from(BUCKET).remove([document.storage_path])
}

export async function setCompanyDocumentAsPrimary(
  documentId: string
): Promise<CompanyDocument> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('company_documents')
    .update({ is_primary: true })
    .eq('id', documentId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CompanyDocument
}

export async function getCompanyDocumentDownloadUrl(
  storagePath: string
): Promise<string> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60)

  if (error) throw new Error(`Could not generate download URL: ${error.message}`)
  return data.signedUrl
}

export async function getCompanyDocumentCount(companyId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('company_documents')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if (error) throw new Error(error.message)
  return count ?? 0
}
