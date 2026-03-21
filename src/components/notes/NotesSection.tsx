'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NoteForm } from './NoteForm'
import { NoteList } from './NoteList'
import type { NoteEntityType } from '@/types/database'

interface NotesSectionProps {
  entityType: NoteEntityType
  entityId: string
}

export function NotesSection({ entityType, entityId }: NotesSectionProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input by 300ms
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(searchInput.trim())
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [searchInput])

  function handleNoteAdded() {
    setSearchInput('')
    setDebouncedQuery('')
    setRefreshKey((k) => k + 1)
  }

  function clearSearch() {
    setSearchInput('')
    setDebouncedQuery('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <NoteForm
          entityType={entityType}
          entityId={entityId}
          onNoteAdded={handleNoteAdded}
        />

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Active search indicator */}
        {debouncedQuery && (
          <p className="text-xs text-muted-foreground">
            Showing results for: <span className="font-medium text-foreground">{debouncedQuery}</span>
          </p>
        )}

        <NoteList
          entityType={entityType}
          entityId={entityId}
          refreshKey={refreshKey}
          searchQuery={debouncedQuery}
        />
      </CardContent>
    </Card>
  )
}
