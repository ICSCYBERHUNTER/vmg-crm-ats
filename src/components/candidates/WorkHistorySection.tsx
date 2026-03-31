'use client'

import { useEffect, useState } from 'react'
import { Briefcase, Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { WorkHistoryForm } from './WorkHistoryForm'
import type { WorkHistoryFormValues } from './WorkHistoryForm'
import {
  fetchWorkHistory,
  createWorkHistoryEntry,
  updateWorkHistoryEntry,
  deleteWorkHistoryEntry,
} from '@/lib/supabase/work-history'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { WorkHistory } from '@/types/database'

// ─── Date helpers ───────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMonthYear(dateStr: string | null): string | null {
  if (!dateStr) return null
  const parts = dateStr.split('-').map(Number)
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
  return `${SHORT_MONTHS[parts[1] - 1]} ${parts[0]}`
}

function calcDuration(startStr: string | null, endStr: string | null): string | null {
  if (!startStr) return null
  const sp = startStr.split('-').map(Number)
  const startYear = sp[0]; const startMonth = sp[1]
  const now = new Date()
  const endYear = endStr ? endStr.split('-').map(Number)[0] : now.getFullYear()
  const endMonth = endStr ? endStr.split('-').map(Number)[1] : now.getMonth() + 1
  if (isNaN(startYear) || isNaN(startMonth)) return null
  const start = { year: startYear, month: startMonth }
  const end = { year: endYear, month: endMonth }
  let months = (end.year - start.year) * 12 + (end.month - start.month)
  if (months < 0) months = 0
  const yrs = Math.floor(months / 12)
  const mos = months % 12

  if (yrs === 0 && mos === 0) return 'Less than a month'
  const parts: string[] = []
  if (yrs > 0) parts.push(`${yrs} yr${yrs > 1 ? 's' : ''}`)
  if (mos > 0) parts.push(`${mos} mo${mos > 1 ? 's' : ''}`)
  return parts.join(' ')
}

// ─── Timeline entry ─────────────────────────────────────────────────────────

function TimelineEntry({
  entry,
  onEdit,
  onDelete,
}: {
  entry: WorkHistory
  onEdit: () => void
  onDelete: () => void
}) {
  const start = formatMonthYear(entry.start_date)
  const end = entry.is_current ? 'Present' : formatMonthYear(entry.end_date)
  const duration = calcDuration(entry.start_date, entry.is_current ? null : entry.end_date)

  const dateRange = start
    ? `${start} – ${end ?? '?'}${duration ? ` · ${duration}` : ''}`
    : null

  return (
    <div className="group relative pl-6 pb-6 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-3 bottom-0 w-px bg-border group-last:hidden" />
      {/* Timeline dot */}
      <div className="absolute left-0 top-[7px] h-[15px] w-[15px] rounded-full border-2 border-primary bg-background" />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{entry.company_name}</span>
            {entry.is_current && (
              <Badge variant="outline" className="border-green-500 text-green-600 text-[10px] px-1.5 py-0">
                Current
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{entry.job_title}</p>
          {dateRange && <p className="text-xs text-muted-foreground mt-0.5">{dateRange}</p>}
          {entry.location && <p className="text-xs text-muted-foreground">{entry.location}</p>}
          {entry.description && <p className="text-sm mt-1.5 whitespace-pre-wrap">{entry.description}</p>}
        </div>

        <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main section ───────────────────────────────────────────────────────────

interface WorkHistorySectionProps {
  candidateId: string
}

export function WorkHistorySection({ candidateId }: WorkHistorySectionProps) {
  const [entries, setEntries] = useState<WorkHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<WorkHistory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkHistory | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchWorkHistory(candidateId)
      .then(setEntries)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [candidateId])

  async function handleSave(values: WorkHistoryFormValues) {
    try {
      if (editingEntry) {
        const updated = await updateWorkHistoryEntry(editingEntry.id, {
          company_name: values.company_name,
          job_title: values.job_title,
          is_current: values.is_current,
          start_date: values.start_date || undefined,
          end_date: values.end_date || undefined,
          location: values.location || undefined,
          description: values.description || undefined,
        })
        setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
        setEditingEntry(null)
        toast.success('Position updated.')
      } else {
        const created = await createWorkHistoryEntry({
          candidate_id: candidateId,
          company_name: values.company_name,
          job_title: values.job_title,
          is_current: values.is_current,
          start_date: values.start_date || undefined,
          end_date: values.end_date || undefined,
          location: values.location || undefined,
          description: values.description || undefined,
        })
        setEntries((prev) => [created, ...prev])
        setShowForm(false)
        toast.success('Position added.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as Record<string, unknown>).message) : 'Failed to save position.'
      toast.error(msg)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteWorkHistoryEntry(deleteTarget.id)
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id))
      toast.success('Position deleted.')
    } catch {
      toast.error('Failed to delete position.')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const addButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => { setShowForm(true); setEditingEntry(null) }}
    >
      <Plus className="mr-1.5 h-3.5 w-3.5" />
      Add Position
    </Button>
  )

  return (
    <CollapsibleSection
      title="Work History"
      icon={<Briefcase className="h-4 w-4" />}
      count={entries.length}
      defaultOpen
      headerAction={addButton}
    >
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">Failed to load work history. Try refreshing.</p>
      )}

      {!loading && !error && (
        <>
          {(showForm && !editingEntry) && (
            <div className="mb-4">
              <WorkHistoryForm onSave={handleSave} onCancel={() => setShowForm(false)} />
            </div>
          )}

          {entries.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground">
              No work history added yet. Add positions to build this candidate&apos;s career timeline.
            </p>
          )}

          {entries.map((entry) =>
            editingEntry?.id === entry.id ? (
              <div key={entry.id} className="mb-4">
                <WorkHistoryForm
                  initial={entry}
                  onSave={handleSave}
                  onCancel={() => setEditingEntry(null)}
                />
              </div>
            ) : (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                onEdit={() => { setEditingEntry(entry); setShowForm(false) }}
                onDelete={() => setDeleteTarget(entry)}
              />
            )
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Position</DialogTitle>
            <DialogDescription>
              Delete this position at {deleteTarget?.company_name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CollapsibleSection>
  )
}
