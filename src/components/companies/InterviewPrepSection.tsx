'use client'

import { useState, useEffect, useCallback } from 'react'
import { GraduationCap, Lock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { fetchNotes, createNote, deleteNote } from '@/lib/supabase/notes'
import { createClient } from '@/lib/supabase/client'
import type { NoteWithAuthor } from '@/types/database'

interface InterviewPrepSectionProps {
  companyId: string
  companyName: string
  readOnly?: boolean
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function InterviewPrepSection({ companyId, companyName, readOnly = false }: InterviewPrepSectionProps) {
  const [tips, setTips] = useState<NoteWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadTips = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const data = await fetchNotes('company', companyId, { noteType: 'interview_prep' })
      setTips(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tips.')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { loadTips() }, [loadTips])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await createNote({
        entity_type: 'company',
        entity_id: companyId,
        content: content.trim(),
        note_type: 'interview_prep',
        is_private: isPrivate,
      })
      setContent('')
      setIsPrivate(false)
      await loadTips()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add tip.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this tip? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteNote(id)
      setTips((prev) => prev.filter((t) => t.id !== id))
    } catch {
      // no-op — tip will reload on next open
    } finally {
      setDeletingId(null)
    }
  }

  const title = companyName
    ? `Interview Prep Tips — ${companyName}`
    : 'Interview Prep Tips'

  return (
    <CollapsibleSection
      title={title}
      icon={<GraduationCap className="h-4 w-4" />}
      count={tips.length}
      defaultOpen={false}
    >
      {!readOnly && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3">
          <Textarea
            placeholder="Add a tip — e.g., 'They always include a case study exercise'"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Private
            </label>
            <Button type="submit" disabled={submitting || !content.trim()} className="ml-auto">
              {submitting ? 'Adding...' : 'Add Tip'}
            </Button>
          </div>
          {submitError && <p className="text-xs text-destructive">{submitError}</p>}
        </form>
      )}

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && tips.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No interview prep tips yet. Add tips to help your team prep candidates for interviews at this company.
        </p>
      )}

      {!loading && !error && tips.length > 0 && (
        <div className="space-y-3">
          {tips.map((tip) => (
            <div key={tip.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                {tip.is_private && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Private
                  </span>
                )}
                <span
                  className="ml-auto text-xs text-muted-foreground"
                  title={new Date(tip.created_at).toLocaleString()}
                >
                  {timeAgo(tip.created_at)}
                </span>
                {currentUserId === tip.created_by && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(tip.id)}
                    disabled={deletingId === tip.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{tip.content}</p>
              <p className="text-xs text-muted-foreground">— {tip.profiles?.full_name || 'Unknown user'}</p>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
