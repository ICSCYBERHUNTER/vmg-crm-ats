'use client'

import { useEffect, useState } from 'react'
import { FileText, Briefcase } from 'lucide-react'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { CandidateDocuments } from './CandidateDocuments'
import { CandidateJobsList } from './CandidateJobsList'
import { createClient } from '@/lib/supabase/client'

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreviewData {
  docCount: number
  docPreview: string
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
        .from('candidate_applications')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidateId),
    ]).then(([docRes, jobRes]) => {
      const primaryDoc = docRes.data?.[0]

      setPreview({
        docCount: docRes.count ?? 0,
        docPreview: primaryDoc?.is_primary ? primaryDoc.file_name : '',
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
        title="Job Applications"
        icon={<Briefcase className="h-4 w-4" />}
        count={preview.jobCount}
      >
        <CandidateJobsList candidateId={candidateId} />
      </CollapsibleSection>
    </>
  )
}
