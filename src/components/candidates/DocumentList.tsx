'use client'

import { useState } from 'react'
import { Star, Download, Trash2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { CandidateDocument } from '@/types/database'

const FILE_TYPE_LABELS: Record<CandidateDocument['file_type'], string> = {
  resume: 'Resume',
  cv: 'CV',
  cover_letter: 'Cover Letter',
  portfolio: 'Portfolio',
  other: 'Other',
}

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  documents: CandidateDocument[]
  onSetPrimary: (doc: CandidateDocument) => Promise<void>
  onDownload: (doc: CandidateDocument) => Promise<void>
  onDelete: (doc: CandidateDocument) => Promise<void>
}

export function DocumentList({ documents, onSetPrimary, onDownload, onDelete }: Props) {
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CandidateDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (documents.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No documents uploaded yet.
      </p>
    )
  }

  async function handleSetPrimary(doc: CandidateDocument) {
    if (doc.is_primary) return
    setSettingPrimary(doc.id)
    try {
      await onSetPrimary(doc)
    } finally {
      setSettingPrimary(null)
    }
  }

  async function handleDownload(doc: CandidateDocument) {
    setDownloading(doc.id)
    try {
      await onDownload(doc)
    } finally {
      setDownloading(null)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await onDelete(deleteTarget)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="divide-y divide-border rounded-lg border border-border">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-start gap-3 px-4 py-3">
            {/* Type badge */}
            <Badge variant="outline" className="mt-0.5 shrink-0 text-xs">
              {FILE_TYPE_LABELS[doc.file_type]}
            </Badge>

            {/* Name + notes */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => handleDownload(doc)}
                className="truncate text-sm font-medium hover:underline text-left w-full"
                title={doc.file_name}
              >
                {doc.file_name}
              </button>
              {doc.notes && (
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={doc.notes}
                >
                  {doc.notes}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatRelativeDate(doc.uploaded_at)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1">
              {/* Primary star */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={doc.is_primary ? 'Primary document' : 'Set as primary'}
                onClick={() => handleSetPrimary(doc)}
                disabled={doc.is_primary || settingPrimary === doc.id}
              >
                {settingPrimary === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Star
                    className="h-4 w-4"
                    fill={doc.is_primary ? '#fbbf24' : 'none'}
                    stroke={doc.is_primary ? '#fbbf24' : 'currentColor'}
                  />
                )}
              </Button>

              {/* Download */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Download"
                onClick={() => handleDownload(doc)}
                disabled={downloading === doc.id}
              >
                {downloading === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                title="Delete"
                onClick={() => setDeleteTarget(doc)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.file_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The file will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
