'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchOpenJobsForCandidate,
  submitCandidateToJob,
} from '@/lib/supabase/candidate-applications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface SubmitToJobDialogProps {
  candidateId: string
  onSubmitted: () => void
}

export function SubmitToJobDialog({ candidateId, onSubmitted }: SubmitToJobDialogProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [jobs, setJobs] = useState<
    { id: string; title: string; company_name: string | null; status: string }[]
  >([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)

  const loadJobs = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const data = await fetchOpenJobsForCandidate(candidateId, query || undefined)
      setJobs(data)
    } catch {
      toast.error('Failed to load job openings')
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => {
    if (open) loadJobs('')
  }, [open, loadJobs])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => loadJobs(search), 300)
    return () => clearTimeout(timer)
  }, [search, open, loadJobs])

  async function handleSelect(jobOpeningId: string) {
    setSubmitting(jobOpeningId)
    try {
      await submitCandidateToJob(candidateId, jobOpeningId)
      toast.success('Candidate submitted to job')
      setOpen(false)
      setSearch('')
      onSubmitted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit candidate')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <SendHorizontal className="mr-1.5 h-4 w-4" />
            Submit to Job
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Candidate to Job Opening</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs by title or company..."
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {loading && (
            <p className="py-4 text-center text-sm text-muted-foreground">Searching...</p>
          )}

          {!loading && jobs.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {search ? 'No jobs found matching your search.' : 'No open jobs available.'}
            </p>
          )}

          {!loading && jobs.map(j => (
            <button
              key={j.id}
              onClick={() => handleSelect(j.id)}
              disabled={submitting !== null}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <span className="font-medium">{j.title}</span>
              {j.company_name && (
                <span className="text-muted-foreground">{j.company_name}</span>
              )}
              {submitting === j.id && (
                <span className="ml-auto text-xs text-muted-foreground">Submitting...</span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
