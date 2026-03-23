// Server Component — fetches job opening by ID from Supabase.
// params is a Promise in Next.js 16 and must be awaited.

import Link from 'next/link'
import { Pencil, AlertTriangle } from 'lucide-react'
import { getJobOpeningById } from '@/lib/supabase/job-openings-server'
import { getCompanyById } from '@/lib/supabase/companies'
import { JobStatusBadge } from '@/components/shared/JobStatusBadge'
import { LocationTypeBadge } from '@/components/shared/LocationTypeBadge'
import { JobSourceBadge } from '@/components/shared/JobSourceBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { DeleteJobOpeningButton } from '@/components/jobs/DeleteJobOpeningButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PipelineStageBuilder } from '@/components/jobs/PipelineStageBuilder'
import { JobPipelineSection } from '@/components/jobs/JobPipelineSection'
import { NotesSection } from '@/components/notes/NotesSection'
import { InterviewPrepSection } from '@/components/companies/InterviewPrepSection'
import type { JobOpening } from '@/types/database'
import { formatCompRange } from '@/lib/utils/labels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function val(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  return String(v)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString())
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-x-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  )
}

// ─── Section components ───────────────────────────────────────────────────────

function JobDetailsCard({ job }: { job: JobOpening }) {
  if (!job.description && !job.requirements) return null
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Job Details</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {job.description && (
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-sm whitespace-pre-wrap">{job.description}</p>
          </div>
        )}
        {job.requirements && (
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-1">Requirements</p>
            <p className="text-sm whitespace-pre-wrap">{job.requirements}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LogisticsCard({ job, companyFeePct, isProspect }: { job: JobOpening; companyFeePct: number | null; isProspect: boolean }) {
  const locationParts = [job.location_city, job.location_state].filter(Boolean).join(', ')

  // Fee calculation
  const effectiveFee = job.fee_percentage_override ?? companyFeePct
  let feeDisplay: React.ReactNode = '—'
  if (effectiveFee == null && isProspect) {
    feeDisplay = <span className="text-amber-600">Pending fee agreement</span>
  } else if (effectiveFee != null) {
    let text = `${effectiveFee}%`
    if (job.comp_range_low != null && job.comp_range_high != null) {
      const midpoint = (job.comp_range_low + job.comp_range_high) / 2
      const estimated = midpoint * effectiveFee / 100
      text += ` (Est. fee: ${formatCurrency(estimated)})`
    }
    if (job.fee_percentage_override != null) {
      text += ' — override'
    }
    feeDisplay = text
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Logistics</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row
          label="Location"
          value={
            <span className="flex items-center gap-1.5 flex-wrap">
              {locationParts && <span>{locationParts}</span>}
              {job.location_type && <LocationTypeBadge locationType={job.location_type} />}
              {!locationParts && !job.location_type && '—'}
            </span>
          }
        />
        {job.travel_percentage != null && (
          <Row label="Travel" value={`${job.travel_percentage}% travel`} />
        )}
        <Row label="Compensation" value={formatCompRange(job.comp_range_low, job.comp_range_high)} />
        <Row label="Fee" value={feeDisplay} />
      </CardContent>
    </Card>
  )
}

function TrackingCard({ job }: { job: JobOpening }) {
  const dueDateOverdue =
    isOverdue(job.next_step_due_date) &&
    (job.status === 'open' || job.status === 'on_hold')

  const dueDateText = job.next_step_due_date
    ? new Date(job.next_step_due_date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tracking</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {job.source && (
          <Row label="Source" value={<JobSourceBadge source={job.source} />} />
        )}
        <Row
          label="Next Step"
          value={job.next_step ? (
            <span className="flex flex-wrap items-center gap-2">
              <span>{job.next_step}</span>
              {dueDateText && (
                <span className={dueDateOverdue ? 'text-red-400 font-medium' : 'text-muted-foreground'}>
                  — due {dueDateText}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">None set</span>
          )}
        />
        {!job.next_step && dueDateText && (
          <Row
            label="Next Step Due"
            value={
              <span className={dueDateOverdue ? 'font-medium text-red-400' : ''}>
                {dueDateText}
              </span>
            }
          />
        )}
        <Row
          label="Hiring Manager"
          value={
            job.hiring_manager_id ? (
              <Link
                href={`/companies/${job.company_id}/contacts/${job.hiring_manager_id}`}
                className="text-primary hover:underline"
              >
                {job.hiring_manager_name ?? 'View Contact'}
              </Link>
            ) : (
              <span className="text-muted-foreground">Not assigned</span>
            )
          }
        />
        <Row label="Opened" value={formatDate(job.opened_at)} />
        {job.status === 'filled' && job.filled_at && (
          <Row label="Filled" value={formatDate(job.filled_at)} />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const job = await getJobOpeningById(id).catch(() => null)

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-semibold">Job Opening Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This job opening may have been deleted or the link is incorrect.
        </p>
        <Link href="/jobs" className="mt-6">
          <Button variant="outline">Back to Job Openings</Button>
        </Link>
      </div>
    )
  }

  // Fetch company for fee_agreement_pct — best-effort, don't fail the page
  const company = await getCompanyById(job.company_id).catch(() => null)
  const isProspect = company?.status === 'prospect'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{job.title}</h1>
            <JobStatusBadge status={job.status} />
            {job.priority && <PriorityBadge priority={job.priority} />}
          </div>
          {job.company_id && (
            <Link
              href={`/companies/${job.company_id}`}
              className="mt-1 inline-block text-sm text-primary hover:underline"
            >
              {job.company_name ?? 'View Company'}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/jobs/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <DeleteJobOpeningButton id={id} title={job.title} />
        </div>
      </div>

      {/* Prospect warning banner */}
      {isProspect && company && (
        <div className="flex items-center gap-3 rounded-md border border-amber-400/60 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm font-medium text-amber-800">
            No Fee Agreement — {company.name} is still a Prospect
          </p>
        </div>
      )}

      {/* Kanban Board + Candidates List (with refresh coordination) */}
      <JobPipelineSection jobOpeningId={job.id} />

      {/* Pipeline Stage Builder */}
      <PipelineStageBuilder jobOpeningId={job.id} />

      <TrackingCard job={job} />
      <LogisticsCard job={job} companyFeePct={company?.fee_agreement_pct ?? null} isProspect={isProspect} />
      <JobDetailsCard job={job} />

      {company && (
        <InterviewPrepSection
          companyId={job.company_id}
          companyName={company.name}
        />
      )}
      <NotesSection entityType="job_opening" entityId={job.id} />
    </div>
  )
}
