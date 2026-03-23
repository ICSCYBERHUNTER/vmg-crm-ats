'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { fetchJobOpenings } from '@/lib/supabase/job-openings'
import { JobStatusBadge } from '@/components/shared/JobStatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompRange } from '@/lib/utils/labels'
import type { JobOpening } from '@/types/database'

interface CompanyJobOpeningsProps {
  companyId: string
}

export function CompanyJobOpenings({ companyId }: CompanyJobOpeningsProps) {
  const [jobs, setJobs] = useState<JobOpening[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJobOpenings({ company_id: companyId })
      .then(setJobs)
      .catch(() => toast.error('Failed to load job openings'))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground">No job openings for this company yet.</p>
  }

  return (
    <div className="rounded-md border border-border">
      {jobs.map((job, index) => (
        <div
          key={job.id}
          className={`flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm ${
            index < jobs.length - 1 ? 'border-b border-border' : ''
          }`}
        >
          <Link
            href={`/jobs/${job.id}`}
            className="flex-1 font-medium text-primary hover:underline min-w-0 truncate"
          >
            {job.title}
          </Link>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <JobStatusBadge status={job.status} />
            {job.priority && <PriorityBadge priority={job.priority} />}
            <span className="text-muted-foreground">
              {formatCompRange(job.comp_range_low, job.comp_range_high)}
            </span>
            <span className="text-muted-foreground">
              {new Date(job.opened_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
