// Server Component — fetches candidate by ID from Supabase.
// In Next.js 16, `params` is a Promise and must be awaited.

import Link from 'next/link'
import { Briefcase, FileText, MessageSquare, Pencil } from 'lucide-react'
import { getCandidateById } from '@/lib/supabase/candidates'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { DeleteCandidateButton } from '@/components/candidates/DeleteCandidateButton'
import { CandidateLinkingSection } from '@/components/candidates/CandidateLinkingSection'
import { CandidateJobsList } from '@/components/candidates/CandidateJobsList'
import { CandidateDocuments } from '@/components/candidates/CandidateDocuments'
import { WorkHistorySection } from '@/components/candidates/WorkHistorySection'
import { NotesSection } from '@/components/notes/NotesSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="grid grid-cols-[160px_1fr] gap-x-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  )
}

// ─── Detail sections ──────────────────────────────────────────────────────────

function ContactCard({ c }: { c: Candidate }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row label="Email" value={val(c.email)} />
        <Row label="Phone" value={val(c.phone)} />
        <Row label="LinkedIn" value={val(c.linkedin_url)} />
      </CardContent>
    </Card>
  )
}

function ProfessionalCard({ c }: { c: Candidate }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Professional Info</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row label="Title" value={val(c.current_title)} />
        <Row label="Company" value={val(c.current_company)} />
        <Row label="Category" value={val(c.category)} />
        <Row label="Years of Experience" value={val(c.years_experience)} />
        <Row label="Skills" value={val(c.skills)} />
      </CardContent>
    </Card>
  )
}

function CompensationCard({ c }: { c: Candidate }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Compensation</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row label="Current" value={formatMoney(c.current_compensation)} />
        <Row label="Desired" value={formatMoney(c.desired_compensation)} />
      </CardContent>
    </Card>
  )
}

function LocationCard({ c }: { c: Candidate }) {
  const city = [c.location_city, c.location_state].filter(Boolean).join(', ')
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row label="City / State" value={city || '—'} />
        <Row label="Country" value={val(c.location_country)} />
        <Row label="Willing to Relocate" value={val(c.willing_to_relocate)} />
        <Row label="Relocation Preferences" value={val(c.relocation_preferences)} />
      </CardContent>
    </Card>
  )
}

function RecruitingCard({ c }: { c: Candidate }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recruiting</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row label="Source" value={val(c.source)} />
        <Row
          label="Last Contacted"
          value={
            c.last_contacted_at
              ? new Date(c.last_contacted_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })
              : '—'
          }
        />
        <Row
          label="Added"
          value={new Date(c.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        />
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
    <div className="flex flex-col gap-6">
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
              {candidate.current_company ? ` at ${candidate.current_company}` : ''}
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

      {/* Detail cards */}
      <ContactCard c={candidate} />
      <ProfessionalCard c={candidate} />
      <CompensationCard c={candidate} />
      <LocationCard c={candidate} />
      <RecruitingCard c={candidate} />

      {/* Work History */}
      <WorkHistorySection candidateId={candidate.id} />

      {/* Documents */}
      <CollapsibleSection
        title="Documents"
        icon={<FileText className="h-4 w-4" />}
      >
        <CandidateDocuments candidateId={candidate.id} />
      </CollapsibleSection>

      {/* Notes */}
      <CollapsibleSection
        title="Notes"
        icon={<MessageSquare className="h-4 w-4" />}
      >
        <NotesSection entityType="candidate" entityId={candidate.id} />
      </CollapsibleSection>

      {/* Job Applications */}
      <CollapsibleSection
        title="Job Applications"
        icon={<Briefcase className="h-4 w-4" />}
      >
        <CandidateJobsList candidateId={candidate.id} />
      </CollapsibleSection>
    </div>
  )
}
