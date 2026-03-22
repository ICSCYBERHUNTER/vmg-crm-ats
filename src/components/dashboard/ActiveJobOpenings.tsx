'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { fetchActiveJobOpenings, type ActiveJobOpeningRow } from '@/lib/supabase/dashboard'
import type { Priority } from '@/types/database'

export function ActiveJobOpenings() {
  const [jobs, setJobs] = useState<ActiveJobOpeningRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchActiveJobOpenings()
      .then(setJobs)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="rounded-md border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
        Failed to load job openings. Try refreshing.
      </div>
    )
  }

  if (!jobs) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col">
      <CardContent className="flex-1 p-4">
        {jobs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No open job openings.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/40 px-1 rounded"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.company_name}</p>
                  </div>
                  {job.priority && (
                    <div className="shrink-0">
                      <PriorityBadge priority={job.priority as Priority} />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="border-t border-border px-4 py-3">
        <Link
          href="/jobs"
          className="text-sm text-primary hover:underline"
        >
          View all jobs →
        </Link>
      </CardFooter>
    </Card>
  )
}
