'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Heart, X, Pencil, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchKeyRelationships,
  removeKeyRelationship,
  updateKeyRelationshipNote,
} from '@/lib/supabase/key-relationships'
import type { KeyRelationshipWithDetails } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function getDaysBadge(days: number | null) {
  if (days === null) {
    return (
      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
        Never contacted
      </Badge>
    )
  }
  if (days === 0) {
    return (
      <Badge variant="secondary" className="bg-green-950 text-green-400">
        Today
      </Badge>
    )
  }
  if (days <= 60) {
    return (
      <Badge variant="secondary" className="bg-green-950 text-green-400">
        {days}d ago
      </Badge>
    )
  }
  if (days <= 90) {
    return (
      <Badge variant="secondary" className="bg-amber-950 text-amber-400">
        {days}d ago
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="bg-red-950 text-red-400">
      {days}d ago
    </Badge>
  )
}

function getEntityLabel(entityType: string) {
  return entityType === 'candidate' ? 'Candidate' : 'Contact'
}

function getEntityLink(r: KeyRelationshipWithDetails): string {
  if (r.entity_type === 'candidate') return `/candidates/${r.entity_id}`
  if (r.entity_type === 'company_contact' && r.company_id) {
    return `/companies/${r.company_id}/contacts/${r.entity_id}`
  }
  return '#'
}

function InlineNoteEditor({
  relationshipId,
  initialNote,
  onSaved,
}: {
  relationshipId: string
  initialNote: string | null
  onSaved: (note: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialNote ?? '')

  async function handleSave() {
    const ok = await updateKeyRelationshipNote(relationshipId, value)
    if (ok) {
      onSaved(value)
      setEditing(false)
    } else {
      toast.error('Failed to update note')
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Why is this person a key relationship?"
          className="h-7 text-xs"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleSave}>
          Save
        </Button>
      </div>
    )
  }

  if (initialNote) {
    return (
      <button
        type="button"
        className="flex items-center gap-1 text-xs italic text-muted-foreground hover:text-foreground"
        onClick={() => setEditing(true)}
      >
        {initialNote}
        <Pencil className="h-3 w-3 shrink-0 opacity-50" />
      </button>
    )
  }

  return (
    <button
      type="button"
      className="text-xs text-muted-foreground/60 hover:text-muted-foreground"
      onClick={() => setEditing(true)}
    >
      Add note...
    </button>
  )
}

export default function KeyRelationshipsPage() {
  const [items, setItems] = useState<KeyRelationshipWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchKeyRelationships()
      setItems(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleRemove(r: KeyRelationshipWithDetails) {
    if (!window.confirm(`Remove ${r.name} from Key Relationships?`)) return
    const ok = await removeKeyRelationship(r.entity_type, r.entity_id)
    if (ok) {
      setItems((prev) => prev.filter((item) => item.id !== r.id))
      toast.success(`${r.name} removed`)
    } else {
      toast.error('Failed to remove')
    }
  }

  function handleNoteSaved(id: string, note: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, context_note: note } : item))
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Key Relationships</h1>
        <div className="rounded-md border border-red-800 bg-red-950/30 p-6 text-center">
          <p className="text-sm text-red-400">
            Failed to load key relationships. Check your connection and try refreshing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Key Relationships</h1>
        {items.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'person' : 'people'}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <Heart className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 font-medium text-muted-foreground">
            No key relationships yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add candidates or contacts from their detail pages.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {items.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 px-6 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={getEntityLink(r)}
                    className="text-sm font-medium text-blue-400 hover:underline"
                  >
                    {r.name}
                  </Link>
                  {(r.title || r.company) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {r.title}
                      {r.title && r.company ? ' at ' : ''}
                      {r.company}
                    </p>
                  )}
                  <InlineNoteEditor
                    relationshipId={r.id}
                    initialNote={r.context_note}
                    onSaved={(note) => handleNoteSaved(r.id, note)}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {getDaysBadge(r.days_since_contact)}
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {getEntityLabel(r.entity_type)}
                  </Badge>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemove(r)}
                    title="Remove from Key Relationships"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
