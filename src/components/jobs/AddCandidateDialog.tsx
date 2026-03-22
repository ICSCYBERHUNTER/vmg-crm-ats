'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchCandidatesNotInJob,
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

interface AddCandidateDialogProps {
  jobOpeningId: string
  onCandidateAdded: () => void
}

export function AddCandidateDialog({ jobOpeningId, onCandidateAdded }: AddCandidateDialogProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<
    { id: string; first_name: string; last_name: string; current_title: string | null; current_company: string | null }[]
  >([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)

  const loadCandidates = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const data = await fetchCandidatesNotInJob(jobOpeningId, query || undefined)
      setCandidates(data)
    } catch {
      toast.error('Failed to load candidates')
    } finally {
      setLoading(false)
    }
  }, [jobOpeningId])

  // Load candidates when dialog opens
  useEffect(() => {
    if (open) {
      loadCandidates('')
    }
  }, [open, loadCandidates])

  // Debounced search
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => loadCandidates(search), 300)
    return () => clearTimeout(timer)
  }, [search, open, loadCandidates])

  async function handleSelect(candidateId: string) {
    setSubmitting(candidateId)
    try {
      await submitCandidateToJob(candidateId, jobOpeningId)
      toast.success('Candidate added to pipeline')
      setOpen(false)
      setSearch('')
      onCandidateAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add candidate')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add Candidate
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Candidate to Pipeline</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search candidates by name or title..."
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {loading && (
            <p className="py-4 text-center text-sm text-muted-foreground">Searching...</p>
          )}

          {!loading && candidates.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {search ? 'No candidates found matching your search.' : 'No candidates available.'}
            </p>
          )}

          {!loading && candidates.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              disabled={submitting !== null}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <span className="font-medium">
                {c.first_name} {c.last_name}
              </span>
              {(c.current_title || c.current_company) && (
                <span className="text-muted-foreground">
                  {[c.current_title, c.current_company].filter(Boolean).join(' at ')}
                </span>
              )}
              {submitting === c.id && (
                <span className="ml-auto text-xs text-muted-foreground">Adding...</span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
