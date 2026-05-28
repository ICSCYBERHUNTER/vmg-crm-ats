'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Lock, Trash2, Pencil, Check, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { NoteTypeBadge } from './NoteTypeBadge'
import { MarkdownToolbar } from './MarkdownToolbar'
import { fetchNotes, searchNotes, deleteNote, updateNote } from '@/lib/supabase/notes'
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

function NoteContent({ content }: { content: string }) {
  return (
    <div className="text-sm prose-sm max-w-none">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function NoteCard({
  note,
  currentUserId,
  deletingId,
  onDelete,
  onUpdate,
}: {
  note: NoteWithAuthor
  currentUserId: string | null
  deletingId: string | null
  onDelete: (id: string) => void
  onUpdate: (id: string, content: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const isOwner = currentUserId === note.created_by

  function startEdit() {
    setEditContent(note.content)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEditContent('')
  }

  async function saveEdit() {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      await onUpdate(note.id, editContent)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-2">
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
        {isOwner && !editing && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={startEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(note.id)}
              disabled={deletingId === note.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <MarkdownToolbar textareaRef={editTextareaRef} onChange={setEditContent} />
          <Textarea
            ref={editTextareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveEdit} disabled={saving || !editContent.trim()}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <NoteContent content={note.content} />
      )}

      <p className="text-xs text-muted-foreground">
        — {note.profiles?.full_name || 'Unknown user'}
      </p>
    </div>
  )
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

  async function handleUpdate(noteId: string, content: string) {
    try {
      const updated = await updateNote(noteId, content)
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note.')
      throw err
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
        <NoteCard
          key={note.id}
          note={note}
          currentUserId={currentUserId}
          deletingId={deletingId}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  )
}
