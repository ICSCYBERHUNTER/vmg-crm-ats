'use client'

import { useEffect, useState } from 'react'
import { FileText, MessageSquare, Briefcase } from 'lucide-react'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { CandidateDocuments } from './CandidateDocuments'
import { NotesSection } from '@/components/notes/NotesSection'
import { CandidateJobsList } from './CandidateJobsList'
import { createClient } from '@/lib/supabase/client'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function noteTypeLabel(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreviewData {
  docCount: number
  docPreview: string
  noteCount: number
  notePreview: string
  jobCount: number
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CandidateCompactSections({
  candidateId,
}: {
  candidateId: string
}) {
  const [preview, setPreview] = useState<PreviewData>({
    docCount: 0,
    docPreview: '',
    noteCount: 0,
    notePreview: '',
    jobCount: 0,
  })

  useEffect(() => {
    const supabase = createClient()

    Promise.all([
      supabase
        .from('candidate_documents')
        .select('file_name, is_primary', { count: 'exact' })
        .eq('candidate_id', candidateId)
        .order('is_primary', { ascending: false })
        .limit(1),
      supabase
        .from('notes')
        .select('note_type, created_at', { count: 'exact' })
        .eq('entity_type', 'candidate')
        .eq('entity_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('candidate_applications')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidateId),
    ]).then(([docRes, noteRes, jobRes]) => {
      const primaryDoc = docRes.data?.[0]
      const latestNote = noteRes.data?.[0] as
        | { note_type: string; created_at: string }
        | undefined

      setPreview({
        docCount: docRes.count ?? 0,
        docPreview: primaryDoc?.is_primary ? primaryDoc.file_name : '',
        noteCount: noteRes.count ?? 0,
        notePreview: latestNote
          ? `${noteTypeLabel(latestNote.note_type)} · ${timeAgo(latestNote.created_at)}`
          : '',
        jobCount: jobRes.count ?? 0,
      })
    })
  }, [candidateId])

  return (
    <>
      <CollapsibleSection
        compact
        title="Documents"
        icon={<FileText className="h-4 w-4" />}
        count={preview.docCount}
        previewText={preview.docPreview || undefined}
      >
        <CandidateDocuments candidateId={candidateId} />
      </CollapsibleSection>

      <CollapsibleSection
        compact
        title="Notes"
        icon={<MessageSquare className="h-4 w-4" />}
        count={preview.noteCount}
        previewText={preview.notePreview || undefined}
      >
        <NotesSection entityType="candidate" entityId={candidateId} />
      </CollapsibleSection>

      <CollapsibleSection
        compact
        title="Job Applications"
        icon={<Briefcase className="h-4 w-4" />}
        count={preview.jobCount}
      >
        <CandidateJobsList candidateId={candidateId} />
      </CollapsibleSection>
    </>
  )
}
