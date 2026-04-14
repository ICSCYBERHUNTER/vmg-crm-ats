'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CompanyDocumentUploadForm } from './CompanyDocumentUploadForm'
import { CompanyDocumentList } from './CompanyDocumentList'
import {
  fetchCompanyDocuments,
  uploadCompanyDocument,
  deleteCompanyDocument,
  setCompanyDocumentAsPrimary,
  getCompanyDocumentDownloadUrl,
  getCompanyDocumentCount,
} from '@/lib/supabase/company-documents'
import type { CompanyDocument } from '@/types/database'

interface CompanyDocumentsProps {
  companyId: string
}

export function CompanyDocuments({ companyId }: CompanyDocumentsProps) {
  const [documents, setDocuments] = useState<CompanyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isFirstDocument, setIsFirstDocument] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchCompanyDocuments(companyId),
      getCompanyDocumentCount(companyId),
    ])
      .then(([docs, count]) => {
        setDocuments(docs)
        setIsFirstDocument(count === 0)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [companyId])

  async function handleUpload(
    file: File,
    fileType: CompanyDocument['file_type'],
    notes: string,
    isPrimary: boolean
  ) {
    try {
      const newDoc = await uploadCompanyDocument({
        companyId,
        file,
        fileType,
        notes: notes || undefined,
        isPrimary,
      })
      // If newly uploaded is primary, clear old primary flag in local state
      setDocuments((prev) => {
        const updated = isPrimary
          ? prev.map((d) => ({ ...d, is_primary: false }))
          : [...prev]
        return [newDoc, ...updated]
      })
      setIsFirstDocument(false)
      toast.success('Document uploaded.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
      throw err // re-throw so the form stays open
    }
  }

  async function handleSetPrimary(doc: CompanyDocument) {
    try {
      await setCompanyDocumentAsPrimary(doc.id)
      setDocuments((prev) =>
        prev.map((d) => ({ ...d, is_primary: d.id === doc.id }))
      )
      toast.success('Primary document updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update primary document.')
    }
  }

  async function handleDownload(doc: CompanyDocument) {
    try {
      const url = await getCompanyDocumentDownloadUrl(doc.storage_path)
      window.open(url, '_blank')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open document.')
    }
  }

  async function handleDelete(doc: CompanyDocument) {
    try {
      await deleteCompanyDocument(doc)
      const remaining = documents.filter((d) => d.id !== doc.id)
      setDocuments(remaining)
      setIsFirstDocument(remaining.length === 0)
      toast.success('Document deleted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete document.')
    }
  }

  if (error) {
    return (
      <p className="text-sm text-red-400">
        Failed to load documents. Try refreshing.
      </p>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="space-y-4">
      <CompanyDocumentUploadForm
        onUpload={handleUpload}
        isFirstDocument={isFirstDocument}
        onValidationError={(msg) => toast.error(msg)}
      />
      <CompanyDocumentList
        documents={documents}
        onSetPrimary={handleSetPrimary}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    </div>
  )
}
