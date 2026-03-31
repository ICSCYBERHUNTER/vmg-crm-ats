'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Pencil, Search, Send, Star, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getTalentPool,
  getTalentPoolMembers,
  updateTalentPool,
  deleteTalentPool,
  addCandidateToPool,
  removeCandidateFromPool,
  searchCandidatesForPool,
  getOpenJobOpenings,
  bulkSubmitToJob,
} from '@/lib/supabase/talent-pools'
import type {
  TalentPool,
  TalentPoolMemberWithCandidate,
} from '@/types/database'
import type { PoolCandidateSearchResult, OpenJobOpening } from '@/lib/supabase/talent-pools'
import { label, CATEGORY_LABELS, SENIORITY_LEVEL_LABELS } from '@/lib/utils/labels'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

export default function TalentPoolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [pool, setPool] = useState<TalentPool | null>(null)
  const [members, setMembers] = useState<TalentPoolMemberWithCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Candidate search
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<PoolCandidateSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<TalentPoolMemberWithCandidate | null>(null)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Bulk submit dialog
  const [submitOpen, setSubmitOpen] = useState(false)
  const [jobs, setJobs] = useState<OpenJobOpening[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadPool = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [poolData, membersData] = await Promise.all([
        getTalentPool(id),
        getTalentPoolMembers(id),
      ])
      if (!poolData) {
        setPool(null)
        setError(true)
        return
      }
      setPool(poolData)
      setMembers(membersData)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadPool()
  }, [loadPool])

  // Debounced candidate search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const results = await searchCandidatesForPool(id, searchTerm.trim())
        setSearchResults(results)
        setShowDropdown(true)
      } catch {
        toast.error('Search failed')
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, id])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleAddCandidate(candidate: PoolCandidateSearchResult) {
    try {
      await addCandidateToPool(id, candidate.id)
      toast.success(`Added ${candidate.full_name}`)
      setSearchTerm('')
      setShowDropdown(false)
      const updated = await getTalentPoolMembers(id)
      setMembers(updated)
    } catch {
      toast.error('Failed to add candidate')
    }
  }

  async function handleRemoveCandidate(member: TalentPoolMemberWithCandidate) {
    try {
      await removeCandidateFromPool(id, member.candidate_id)
      toast.success(`Removed ${member.candidate.full_name}`)
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(member.candidate_id)
        return next
      })
      setRemoveTarget(null)
    } catch {
      toast.error('Failed to remove candidate')
      setRemoveTarget(null)
    }
  }

  async function handleEdit() {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const updated = await updateTalentPool(id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      })
      setPool(updated)
      setEditOpen(false)
      toast.success('Pool updated')
    } catch {
      toast.error('Failed to update pool')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteTalentPool(id)
      toast.success('Pool deleted')
      router.push('/talent-pools')
    } catch {
      toast.error('Failed to delete pool')
      setDeleting(false)
    }
  }

  function openEdit() {
    if (!pool) return
    setEditName(pool.name)
    setEditDescription(pool.description ?? '')
    setEditOpen(true)
  }

  // Selection helpers
  const allSelected = members.length > 0 && selectedIds.size === members.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < members.length

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(members.map((m) => m.candidate_id)))
    }
  }

  function toggleSelectOne(candidateId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(candidateId) ? next.delete(candidateId) : next.add(candidateId)
      return next
    })
  }

  // Bulk submit
  async function openSubmitDialog() {
    setSubmitOpen(true)
    if (jobs.length === 0) {
      setJobsLoading(true)
      try {
        const data = await getOpenJobOpenings()
        setJobs(data)
      } catch {
        toast.error('Failed to load job openings')
      } finally {
        setJobsLoading(false)
      }
    }
  }

  async function handleBulkSubmit() {
    if (!selectedJobId) return
    setSubmitting(true)

    const selectedJob = jobs.find((j) => j.id === selectedJobId)
    const jobLabel = selectedJob
      ? `${selectedJob.title}${selectedJob.company_name ? ` — ${selectedJob.company_name}` : ''}`
      : 'job'

    const candidatesForSubmit = members
      .filter((m) => selectedIds.has(m.candidate_id))
      .map((m) => ({ id: m.candidate_id, name: m.candidate.full_name }))

    try {
      const result = await bulkSubmitToJob(selectedJobId, candidatesForSubmit)

      if (result.added === 0 && result.skipped > 0) {
        toast.info("All candidates already in this job's pipeline")
      } else if (result.skipped === 0) {
        toast.success(
          `${result.added} candidate${result.added !== 1 ? 's' : ''} submitted to ${jobLabel}`
        )
      } else {
        toast.success(
          `${result.added} submitted, ${result.skipped} skipped (already in pipeline): ${result.skippedNames.join(', ')}`
        )
      }

      setSubmitOpen(false)
      setSelectedIds(new Set())
      setSelectedJobId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-80" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // ── Not found / error ──────────────────────────────────────────────────────

  if (error || !pool) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-semibold">Pool Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This talent pool may have been deleted or the link is incorrect.
        </p>
        <Link href="/talent-pools" className="mt-6">
          <Button variant="outline">Back to Talent Pools</Button>
        </Link>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{pool.name}</h1>
          {pool.description && (
            <p className="mt-1 text-sm text-muted-foreground">{pool.description}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} candidate{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 hover:text-red-600"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Add Candidate Search */}
      <div ref={searchRef} className="relative max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidates to add..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true)
            }}
            className="pl-9"
          />
          {searchLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {showDropdown && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lg">
            {searchResults.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No candidates found</div>
            ) : (
              searchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-accent transition-colors"
                  onClick={() => handleAddCandidate(c)}
                >
                  <span className="text-sm font-medium">{c.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[c.current_title, c.current_company].filter(Boolean).join(' at ') || 'No title'}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bulk Submit toolbar — only shown when candidates are selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={openSubmitDialog}>
            <Send className="mr-1.5 h-4 w-4" />
            Submit to Job ({selectedIds.size})
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Members Table */}
      {members.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="font-medium text-muted-foreground">No candidates in this pool yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the search above to add candidates.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleSelectAll}
                  aria-label="Select all candidates"
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Seniority</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const c = member.candidate
              const isStar = c.is_star
              const isSelected = selectedIds.has(member.candidate_id)
              return (
                <TableRow key={member.id} data-state={isSelected ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectOne(member.candidate_id)}
                      aria-label={`Select ${c.full_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/candidates/${member.candidate_id}`}
                      className={`font-medium hover:underline ${isStar ? 'text-amber-400' : 'text-blue-400'}`}
                    >
                      {isStar && <Star className="mr-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                      {c.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.current_title ?? '—'}
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {c.current_company ?? '—'}
                  </TableCell>
                  <TableCell>{label(CATEGORY_LABELS, c.category)}</TableCell>
                  <TableCell>{label(SENIORITY_LEVEL_LABELS, c.seniority_level)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-sm text-red-500 hover:text-red-600"
                      onClick={() => setRemoveTarget(member)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Talent Pool</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-pool-name">Name</Label>
              <Input
                id="edit-pool-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editName.trim()) handleEdit()
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-pool-description">Description (optional)</Label>
              <Textarea
                id="edit-pool-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!editName.trim() || saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Submit — Job Picker Dialog */}
      <Dialog
        open={submitOpen}
        onOpenChange={(open) => {
          setSubmitOpen(open)
          if (!open) setSelectedJobId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Submit {selectedIds.size} candidate{selectedIds.size !== 1 ? 's' : ''} to a job
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto py-1">
            {jobsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No open job openings
              </p>
            ) : (
              jobs.map((job) => {
                const isSelected = selectedJobId === job.id
                return (
                  <button
                    key={job.id}
                    type="button"
                    className={`flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <span className="text-sm font-medium">{job.title}</span>
                    {job.company_name && (
                      <span className={`text-xs ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {job.company_name}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSubmitOpen(false)
                setSelectedJobId(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={!selectedJobId || submitting}
            >
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this pool?</AlertDialogTitle>
            <AlertDialogDescription>
              This won&apos;t delete the candidates, just the pool grouping.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Candidate Confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.candidate.full_name} from this pool? This won&apos;t delete the candidate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && handleRemoveCandidate(removeTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
