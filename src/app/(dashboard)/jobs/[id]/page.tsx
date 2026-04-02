// Server Component — fetches job opening by ID from Supabase.
// params is a Promise in Next.js 16 and must be awaited.

import Link from 'next/link'
import { Pencil, AlertTriangle, SlidersHorizontal, Activity as ActivityIcon } from 'lucide-react'
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
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { JobPipelineSection } from '@/components/jobs/JobPipelineSection'
import { ActivitySection } from '@/components/activities/ActivitySection'
import { NotesSection } from '@/components/notes/NotesSection'
import { InterviewPrepSection } from '@/components/companies/InterviewPrepSection'
import { FollowUpTasks } from '@/components/shared/FollowUpTasks'
import type { JobOpening } from '@/types/database'
import { formatCompRange } from '@/lib/utils/labels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function InfoRow({ label, value, index }: { label: string; value: React.ReactNode; index: number }) {
  return (
    <div>
      {index > 0 && <div className="border-t border-border pt-4 mb-4" />}
      <div className="grid gap-x-3 text-sm" style={{ gridTemplateColumns: '140px 1fr' }}>
        <span className="font-medium text-blue-400" style={{ paddingTop: '1px' }}>{label}</span>
        <span className="break-words leading-relaxed">{value}</span>
      </div>
    </div>
  )
}

function TextBlockRow({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <div>
      {index > 0 && <div className="border-t border-border pt-4 mb-4" />}
      <div className="text-sm space-y-1">
        <p className="font-medium text-blue-400">{label}</p>
        <p className="whitespace-pre-wrap leading-relaxed">{value}</p>
      </div>
    </div>
  )
}

// ─── Section components ───────────────────────────────────────────────────────

function TasksCard({ job }: { job: JobOpening }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Tasks</h3>
      <FollowUpTasks entityType="job_opening" entityId={job.id} />
    </div>
  )
}

function JobDetailsCard({
  job,
  companyFeePct,
}: {
  job: JobOpening
  companyFeePct: number | null
}) {
  // Don't render the card if there's nothing to show
  const hasSource = !!job.source
  const hasHiringManager = !!job.hiring_manager_id
  const hasDescription = !!job.description
  const hasRequirements = !!job.requirements
  if (!hasSource && !hasHiringManager && !hasDescription && !hasRequirements) return null

  const inlineRows: { label: string; value: React.ReactNode }[] = []
  if (hasSource) {
    inlineRows.push({ label: 'Source', value: <JobSourceBadge source={job.source!} /> })
  }
  inlineRows.push({
    label: 'Hiring Manager',
    value: hasHiringManager ? (
      <Link
        href={`/companies/${job.company_id}/contacts/${job.hiring_manager_id}`}
        className="text-primary hover:underline"
      >
        {job.hiring_manager_name ?? 'View Contact'}
      </Link>
    ) : (
      <span className="text-muted-foreground">Not assigned</span>
    ),
  })
  inlineRows.push({ label: 'Opened', value: formatDate(job.opened_at) })
  if (job.status === 'filled' && job.filled_at) {
    inlineRows.push({ label: 'Filled', value: formatDate(job.filled_at) })
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Job Details</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {inlineRows.map((row, i) => (
          <InfoRow key={row.label} label={row.label} value={row.value} index={i} />
        ))}
        {hasDescription && (
          <TextBlockRow
            label="Description"
            value={job.description!}
            index={inlineRows.length > 0 ? 1 : 0}
          />
        )}
        {hasRequirements && (
          <TextBlockRow
            label="Requirements"
            value={job.requirements!}
            index={inlineRows.length > 0 || hasDescription ? 1 : 0}
          />
        )}
      </CardContent>
    </Card>
  )
}

function LogisticsCard({
  job,
  companyFeePct,
  isProspect,
}: {
  job: JobOpening
  companyFeePct: number | null
  isProspect: boolean
}) {
  const locationParts = [job.location_city, job.location_state].filter(Boolean).join(', ')
  const hasLocation = !!(locationParts || job.location_type)
  const hasTravel = job.travel_percentage != null
  const hasComp = job.comp_range_low != null || job.comp_range_high != null
  const effectiveFee = job.fee_percentage_override ?? companyFeePct
  const hasFee = effectiveFee != null || isProspect

  if (!hasLocation && !hasTravel && !hasComp && !hasFee) return null

  const rows: { label: string; value: React.ReactNode }[] = []

  if (hasLocation) {
    rows.push({
      label: 'Location',
      value: (
        <span className="flex items-center gap-1.5 flex-wrap">
          {locationParts && <span>{locationParts}</span>}
          {job.location_type && <LocationTypeBadge locationType={job.location_type} />}
        </span>
      ),
    })
  }

  if (hasTravel) {
    rows.push({ label: 'Travel', value: `${job.travel_percentage}% travel` })
  }

  if (hasComp) {
    rows.push({ label: 'Compensation', value: formatCompRange(job.comp_range_low, job.comp_range_high) })
  }

  if (hasFee) {
    let feeDisplay: React.ReactNode = '—'
    if (effectiveFee == null && isProspect) {
      feeDisplay = <span className="text-amber-600">Pending fee agreement</span>
    } else if (effectiveFee != null) {
      let text = `${effectiveFee}%`
      if (job.comp_range_low != null && job.comp_range_high != null) {
        const midpoint = (job.comp_range_low + job.comp_range_high) / 2
        const estimated = (midpoint * effectiveFee) / 100
        text += ` (Est. fee: ${formatCurrency(estimated)})`
      }
      if (job.fee_percentage_override != null) text += ' — override'
      feeDisplay = text
    }
    rows.push({ label: 'Fee', value: feeDisplay })
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Logistics</CardTitle></CardHeader>
      <CardContent className="space-y-0">
        {rows.map((row, i) => (
          <InfoRow key={row.label} label={row.label} value={row.value} index={i} />
        ))}
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

  const company = await getCompanyById(job.company_id).catch(() => null)
  const isProspect = company?.status === 'prospect'

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header */}
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

      {/* 2. Tasks */}
      <TasksCard job={job} />

      {/* 3. Activity */}
      <CollapsibleSection
        title="Activity"
        icon={<ActivityIcon className="h-4 w-4" />}
        defaultOpen={false}
      >
        <ActivitySection entityType="job_opening" entityId={job.id} />
      </CollapsibleSection>

      {/* 4. Kanban Board + Notes + Candidates */}
      <JobPipelineSection
        jobOpeningId={job.id}
        middleSlot={<NotesSection entityType="job_opening" entityId={job.id} />}
      />

      {/* 6. Job Details */}
      <JobDetailsCard
        job={job}
        companyFeePct={company?.fee_agreement_pct ?? null}
      />

      {/* 7. Interview Prep Tips */}
      {company && (
        <InterviewPrepSection
          companyId={job.company_id}
          companyName={company.name}
        />
      )}

      {/* 8. Pipeline Editor (collapsible, collapsed by default) */}
      <CollapsibleSection
        title="Pipeline Stages"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        defaultOpen={false}
      >
        <PipelineStageBuilder jobOpeningId={job.id} />
      </CollapsibleSection>

      {/* 9. Logistics */}
      <LogisticsCard
        job={job}
        companyFeePct={company?.fee_agreement_pct ?? null}
        isProspect={isProspect}
      />
    </div>
  )
}
