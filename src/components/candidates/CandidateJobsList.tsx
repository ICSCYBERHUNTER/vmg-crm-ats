'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { fetchApplicationsByCandidate } from '@/lib/supabase/candidate-applications'
import { ApplicationStatusBadge } from '@/components/shared/ApplicationStatusBadge'
import { SubmitToJobDialog } from './SubmitToJobDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { CandidateApplication } from '@/types/database'

interface CandidateJobsListProps {
  candidateId: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function CandidateJobsList({ candidateId }: CandidateJobsListProps) {
  const [applications, setApplications] = useState<CandidateApplication[]>([])
  const [loading, setLoading] = useState(true)

  const loadApplications = useCallback(async () => {
    try {
      const data = await fetchApplicationsByCandidate(candidateId)
      setApplications(data)
    } catch {
      toast.error('Failed to load job applications')
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => { loadApplications() }, [loadApplications])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Job Applications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Job Applications ({applications.length})</CardTitle>
        <SubmitToJobDialog candidateId={candidateId} onSubmitted={loadApplications} />
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This candidate hasn&apos;t been submitted to any jobs yet.
          </p>
        ) : (
          <div className="rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Job Title</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Company</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">Applied</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Link
                        href={`/jobs/${app.job_opening_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {app.job_title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                      {app.company_name ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {app.status === 'active'
                        ? (app.current_stage_name ?? '—')
                        : app.status === 'rejected'
                          ? 'Rejected'
                          : 'Withdrawn'}
                    </td>
                    <td className="px-3 py-2">
                      <ApplicationStatusBadge status={app.status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                      {formatDate(app.applied_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
