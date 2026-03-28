// Server Component — fetches candidate by ID from Supabase.
// In Next.js 16, `params` is a Promise and must be awaited.

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { getCandidateById } from '@/lib/supabase/candidates'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DeleteCandidateButton } from '@/components/candidates/DeleteCandidateButton'
import { CandidateLinkingSection } from '@/components/candidates/CandidateLinkingSection'
import { ContactCard } from '@/components/candidates/ContactCard'
import { WorkHistorySection } from '@/components/candidates/WorkHistorySection'
import { CandidateCompactSections } from '@/components/candidates/CandidateCompactSections'
import { CandidateSubmitButton } from '@/components/candidates/CandidateSubmitButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { label, CATEGORY_LABELS, SENIORITY_LEVEL_LABELS } from '@/lib/utils/labels'
import type { Candidate } from '@/types/database'

// ─── Small helpers ────────────────────────────────────────────────────────────

function val(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  return String(v)
}

function formatMoney(v: number | null): string {
  if (v == null) return '—'
  return '$' + v.toLocaleString()
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-x-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  )
}

// ─── Detail sections ──────────────────────────────────────────────────────────

function ProfessionalCard({ c }: { c: Candidate }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base">Professional Info</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <Row label="Title" value={val(c.current_title)} />
        <Row label="Company" value={val(c.current_company)} />
        <Row label="Category" value={label(CATEGORY_LABELS, c.category)} />
        <Row label="Seniority Level" value={label(SENIORITY_LEVEL_LABELS, c.seniority_level)} />
        <Row label="Years of Experience" value={val(c.years_experience)} />
        <Row label="Skills" value={val(c.skills)} />
      </CardContent>
    </Card>
  )
}

function CompensationCard({ c }: { c: Candidate }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base">Compensation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-8">
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-sm font-medium mt-0.5">
              {formatMoney(c.current_compensation)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Desired</p>
            <p className="text-sm font-medium mt-0.5">
              {formatMoney(c.desired_compensation)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RecruitingCard({ c }: { c: Candidate }) {
  const lastContacted = c.last_contacted_at
    ? new Date(c.last_contacted_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'
  const added = new Date(c.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base">Recruiting</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Source</p>
            <p className="text-sm font-medium mt-0.5">{val(c.source)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Contacted</p>
            <p className="text-sm font-medium mt-0.5">{lastContacted}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Added</p>
            <p className="text-sm font-medium mt-0.5">{added}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const candidate = await getCandidateById(id).catch(() => null)

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-semibold">Candidate Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This candidate may have been deleted or the link is incorrect.
        </p>
        <Link href="/candidates" className="mt-6">
          <Button variant="outline">Back to Candidates</Button>
        </Link>
      </div>
    )
  }

  const fullName = `${candidate.first_name} ${candidate.last_name}`

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{fullName}</h1>
            <StatusBadge status={candidate.status} />
          </div>
          {candidate.current_title && (
            <p className="mt-1 text-sm text-muted-foreground">
              {candidate.current_title}
              {candidate.current_company
                ? ` at ${candidate.current_company}`
                : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!candidate.linked_contact_id && (
            <CandidateLinkingSection
              candidateId={id}
              candidateName={fullName}
              linkedContactId={null}
            />
          )}
          <CandidateSubmitButton candidateId={id} />
          <Link href={`/candidates/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <DeleteCandidateButton id={id} name={fullName} />
        </div>
      </div>

      {/* Linked Contact Indicator */}
      {candidate.linked_contact_id && (
        <CandidateLinkingSection
          candidateId={id}
          candidateName={fullName}
          linkedContactId={candidate.linked_contact_id}
        />
      )}

      {/* Contact Info (full width) */}
      <ContactCard candidate={candidate} />

      {/* Professional Info + Compensation/Recruiting (2-column grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ProfessionalCard c={candidate} />
        <div className="flex flex-col gap-3">
          <CompensationCard c={candidate} />
          <RecruitingCard c={candidate} />
        </div>
      </div>

      {/* Work History (full width, open by default) */}
      <WorkHistorySection candidateId={candidate.id} />

      {/* Documents, Notes, Job Applications (compact accordions) */}
      <CandidateCompactSections candidateId={candidate.id} />
    </div>
  )
}
