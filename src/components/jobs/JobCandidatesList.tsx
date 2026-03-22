'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  fetchApplicationsByJob,
  withdrawApplication,
  reactivateApplication,
} from '@/lib/supabase/candidate-applications'
import { fetchPipelineStages } from '@/lib/supabase/pipeline-stages'
import { ApplicationStatusBadge } from '@/components/shared/ApplicationStatusBadge'
import { AddCandidateDialog } from './AddCandidateDialog'
import { RejectCandidateDialog } from './RejectCandidateDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import type { CandidateApplication, PipelineStage } from '@/types/database'

interface JobCandidatesListProps {
  jobOpeningId: string
  refreshKey?: number
  onApplicationChange?: () => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function JobCandidatesList({ jobOpeningId, refreshKey, onApplicationChange }: JobCandidatesListProps) {
  const [applications, setApplications] = useState<CandidateApplication[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)

  // Rejection dialog state
  const [rejectTarget, setRejectTarget] = useState<CandidateApplication | null>(null)

  // Confirm dialog state (withdraw / reactivate)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'withdraw' | 'reactivate'
    application: CandidateApplication
  } | null>(null)

  const loadApplications = useCallback(async () => {
    try {
      const data = await fetchApplicationsByJob(jobOpeningId)
      setApplications(data)
    } catch {
      toast.error('Failed to load candidates')
    } finally {
      setLoading(false)
    }
  }, [jobOpeningId])

  useEffect(() => { loadApplications() }, [loadApplications, refreshKey])

  // Lazy-load stages only when rejection dialog opens
  async function handleRejectClick(app: CandidateApplication) {
    if (stages.length === 0) {
      try {
        const data = await fetchPipelineStages(jobOpeningId)
        setStages(data)
      } catch {
        toast.error('Failed to load pipeline stages')
        return
      }
    }
    setRejectTarget(app)
  }

  async function handleConfirmAction() {
    if (!confirmAction) return
    try {
      if (confirmAction.type === 'withdraw') {
        await withdrawApplication(confirmAction.application.id)
        toast.success('Candidate withdrawn')
      } else {
        await reactivateApplication(confirmAction.application.id)
        toast.success('Candidate reactivated')
      }
      setConfirmAction(null)
      loadApplications()
      onApplicationChange?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Candidates</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Candidates ({applications.length})</CardTitle>
          <AddCandidateDialog jobOpeningId={jobOpeningId} onCandidateAdded={() => { loadApplications(); onApplicationChange?.() }} />
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No candidates have been submitted to this job yet. Add your first candidate to get started.
            </p>
          ) : (
            <div className="rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Candidate</th>
                    <th className="px-3 py-2 font-medium hidden sm:table-cell">Title</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium hidden md:table-cell">Applied</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(app => (
                    <tr key={app.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Link
                          href={`/candidates/${app.candidate_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {app.candidate_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {app.candidate_current_title ?? '—'}
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
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {app.status === 'active' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRejectClick(app)}
                              >
                                Reject
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmAction({ type: 'withdraw', application: app })}
                              >
                                Withdraw
                              </Button>
                            </>
                          )}
                          {(app.status === 'rejected' || app.status === 'withdrawn') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmAction({ type: 'reactivate', application: app })}
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      {rejectTarget && (
        <RejectCandidateDialog
          application={rejectTarget}
          stages={stages}
          open={!!rejectTarget}
          onOpenChange={open => { if (!open) setRejectTarget(null) }}
          onRejected={() => {
            setRejectTarget(null)
            loadApplications()
            onApplicationChange?.()
          }}
        />
      )}

      {/* Withdraw / Reactivate Confirmation */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={open => { if (!open) setConfirmAction(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'withdraw' ? 'Withdraw Candidate' : 'Reactivate Candidate'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'withdraw'
                ? `Withdraw ${confirmAction.application.candidate_name} from this job opening?`
                : `Reactivate ${confirmAction?.application.candidate_name} in this pipeline? They will return to their last active stage.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>
              {confirmAction?.type === 'withdraw' ? 'Withdraw' : 'Reactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
