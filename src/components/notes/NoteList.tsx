'use client'

import { useEffect, useState, useCallback } from 'react'
import { Lock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NoteTypeBadge } from './NoteTypeBadge'
import { fetchNotes, searchNotes, deleteNote } from '@/lib/supabase/notes'
import { createClient } from '@/lib/supabase/client'
import type { NoteEntityType, NoteWithAuthor } from '@/types/database'

interface NoteListProps {
  entityType: NoteEntityType
  entityId: string
  refreshKey: number
  searchQuery?: string
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function NoteList({ entityType, entityId, refreshKey, searchQuery }: NoteListProps) {
  const [notes, setNotes] = useState<NoteWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadNotes = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const data = searchQuery
        ? await searchNotes(entityType, entityId, searchQuery)
        : await fetchNotes(entityType, entityId)
      setNotes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes.')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, searchQuery])

  useEffect(() => {
    loadNotes()
  }, [loadNotes, refreshKey])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  async function handleDelete(noteId: string) {
    if (!confirm('Delete this note? This cannot be undone.')) return
    setDeletingId(noteId)
    try {
      await deleteNote(noteId, { entityType, entityId })
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {searchQuery
          ? `No notes matching "${searchQuery}"`
          : 'No notes yet. Add one above!'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div
          key={note.id}
          className="rounded-lg border p-4 space-y-2"
        >
          {/* Header row: badge, private indicator, timestamp, delete */}
          <div className="flex items-center gap-2 flex-wrap">
            <NoteTypeBadge noteType={note.note_type} />
            {note.is_private && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground" title={new Date(note.created_at).toLocaleString()}>
              {timeAgo(note.created_at)}
            </span>
            {currentUserId === note.created_by && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(note.id)}
                disabled={deletingId === note.id}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Content */}
          <p className="text-sm whitespace-pre-wrap">{note.content}</p>

          {/* Author */}
          <p className="text-xs text-muted-foreground">
            — {note.profiles?.full_name || 'Unknown user'}
          </p>
        </div>
      ))}
    </div>
  )
}
