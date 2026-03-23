'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DocumentUploadForm } from './DocumentUploadForm'
import { DocumentList } from './DocumentList'
import {
  fetchCandidateDocuments,
  uploadCandidateDocument,
  deleteCandidateDocument,
  setDocumentAsPrimary,
  getDocumentDownloadUrl,
  getDocumentCount,
} from '@/lib/supabase/candidate-documents'
import type { CandidateDocument } from '@/types/database'

interface CandidateDocumentsProps {
  candidateId: string
}

export function CandidateDocuments({ candidateId }: CandidateDocumentsProps) {
  const [documents, setDocuments] = useState<CandidateDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isFirstDocument, setIsFirstDocument] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchCandidateDocuments(candidateId),
      getDocumentCount(candidateId),
    ])
      .then(([docs, count]) => {
        setDocuments(docs)
        setIsFirstDocument(count === 0)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [candidateId])

  async function handleUpload(
    file: File,
    fileType: CandidateDocument['file_type'],
    notes: string,
    isPrimary: boolean
  ) {
    try {
      const newDoc = await uploadCandidateDocument({
        candidateId,
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

  async function handleSetPrimary(doc: CandidateDocument) {
    try {
      await setDocumentAsPrimary(doc.id)
      setDocuments((prev) =>
        prev.map((d) => ({ ...d, is_primary: d.id === doc.id }))
      )
      toast.success('Primary document updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update primary document.')
    }
  }

  async function handleDownload(doc: CandidateDocument) {
    try {
      const url = await getDocumentDownloadUrl(doc.storage_path)
      window.open(url, '_blank')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open document.')
    }
  }

  async function handleDelete(doc: CandidateDocument) {
    try {
      await deleteCandidateDocument(doc)
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
      <DocumentUploadForm
        onUpload={handleUpload}
        isFirstDocument={isFirstDocument}
        onValidationError={(msg) => toast.error(msg)}
      />
      <DocumentList
        documents={documents}
        onSetPrimary={handleSetPrimary}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    </div>
  )
}
