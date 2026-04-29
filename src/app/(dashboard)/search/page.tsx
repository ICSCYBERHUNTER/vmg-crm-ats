'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, Loader2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { HighlightedSnippet } from '@/components/shared/HighlightedSnippet'
import { globalSearch } from '@/lib/supabase/search'
import type { SmartSearchResult, SearchResult } from '@/types/database'

// ── Types ───────────────────────────────────────────────────────────────────

type Mode = 'keyword' | 'smart'

type EntityScope = 'all' | 'candidate' | 'company' | 'contact' | 'job_opening' | 'note'

const SCOPE_OPTIONS: { value: EntityScope; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'candidate',   label: 'Candidates' },
  { value: 'company',     label: 'Companies' },
  { value: 'contact',     label: 'Contacts' },
  { value: 'job_opening', label: 'Jobs' },
  { value: 'note',        label: 'Notes' },
]

const VALID_SCOPES: EntityScope[] = ['all', 'candidate', 'company', 'contact', 'job_opening', 'note']

type PendingRequest = {
  id: number
  mode: Mode
  query: string
  notes: boolean
  scope: EntityScope
}

type RenderableResult = {
  entity_type: 'candidate' | 'company' | 'contact' | 'job_opening' | 'note'
  entity_id: string
  entity_name: string
  snippet: string
  created_at: string
  result_type?: 'semantic' | 'keyword' | 'both'
  similarity_score?: number
  keyword_rank?: number
  rerank_score?: number | null
  match_label?: 'Strong match' | 'Good match' | 'Possible match' | null
  note_parent_entity_type?: 'candidate' | 'company' | 'contact' | 'job_opening'
  note_parent_entity_id?: string
  contact_company_id?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const entityPath = (type: string, id: string): string => {
  switch (type) {
    case 'candidate': return `/candidates/${id}`
    case 'company': return `/companies/${id}`
    case 'contact': return `/contacts/${id}`
    case 'job_opening': return `/jobs/${id}`
    default: return '/search'
  }
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  candidate: 'bg-blue-100 text-blue-800',
  company: 'bg-emerald-100 text-emerald-800',
  contact: 'bg-purple-100 text-purple-800',
  job_opening: 'bg-amber-100 text-amber-800',
  note: 'bg-gray-100 text-gray-800',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  candidate: 'Candidate',
  company: 'Company',
  contact: 'Contact',
  job_opening: 'Job',
  note: 'Note',
}

const matchLabelClassName = (label: string | null | undefined): string | null => {
  if (!label) return null
  switch (label) {
    case 'Strong match': return 'bg-green-100 text-green-800'
    case 'Good match': return 'bg-blue-100 text-blue-800'
    case 'Possible match': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // User-facing state
  const [inputValue, setInputValue] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [activeMode, setActiveMode] = useState<Mode>('keyword')
  const [includeNotes, setIncludeNotes] = useState(false)
  const [scope, setScope] = useState<EntityScope>('all')
  const [results, setResults] = useState<RenderableResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Race protection refs
  const latestRequestId = useRef(0)
  const currentRequestRef = useRef<PendingRequest | null>(null)
  const lastQuerySetByPageRef = useRef<string | null>(null)

  const shouldApplyResponse = (request: PendingRequest): boolean => {
    const current = currentRequestRef.current
    return (
      current !== null &&
      request.id === current.id &&
      request.mode === current.mode &&
      request.query === current.query &&
      (request.mode === 'keyword' || (request.notes === current.notes && request.scope === current.scope))
    )
  }

  // ── Search functions (defined BEFORE the hydration effect) ──────────────

  const runKeywordSearch = useCallback(async (query: string) => {
    const requestId = ++latestRequestId.current
    const request: PendingRequest = { id: requestId, mode: 'keyword', query, notes: false, scope: 'all' }
    currentRequestRef.current = request

    setIsLoading(true)
    setError(null)

    try {
      const rows = await globalSearch(query)

      if (!shouldApplyResponse(request)) return

      const renderable: RenderableResult[] = rows.map((row: SearchResult) => ({
        entity_type: row.entity_type as RenderableResult['entity_type'],
        entity_id: row.entity_id,
        entity_name: row.entity_name,
        snippet: row.snippet,
        created_at: row.created_at,
      }))

      setActiveQuery(query)
      setActiveMode('keyword')
      setResults(renderable)
    } catch (err) {
      if (!shouldApplyResponse(request)) return
      console.error('Keyword search failed:', err)
      setError('Search failed. Please try again.')
    } finally {
      if (shouldApplyResponse(request)) setIsLoading(false)
    }
  }, [])

  const smartSearchCacheKey = (query: string, notes: boolean, entityScope: EntityScope) =>
    `vmg-smart-search:v1:${entityScope}:${notes ? '1' : '0'}:${query}`

  const runSmartSearch = useCallback(async (query: string, notes: boolean, entityScope: EntityScope) => {
    const requestId = ++latestRequestId.current
    const request: PendingRequest = { id: requestId, mode: 'smart', query, notes, scope: entityScope }
    currentRequestRef.current = request

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          includeNotes: entityScope === 'note' ? true : notes,
          entityScope,
        }),
      })

      const json = await response.json()

      if (!shouldApplyResponse(request)) return

      if (!json.success) {
        setError(json.error || 'Smart search failed.')
        return
      }

      const renderable: RenderableResult[] = json.data.results.map((r: SmartSearchResult) => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        entity_name: r.entity_name,
        snippet: r.snippet,
        created_at: r.created_at,
        result_type: r.result_type,
        similarity_score: r.similarity_score,
        keyword_rank: r.keyword_rank,
        rerank_score: r.rerank_score,
        match_label: r.match_label,
        note_parent_entity_type: r.note_parent_entity_type,
        note_parent_entity_id: r.note_parent_entity_id,
        contact_company_id: r.contact_company_id,
      }))

      // Cache results for Back navigation — sessionStorage only (cleared on tab close)
      try {
        sessionStorage.setItem(
          smartSearchCacheKey(query, notes, entityScope),
          JSON.stringify(renderable)
        )
      } catch {
        // sessionStorage full or unavailable — not a fatal error
      }

      setActiveQuery(query)
      setActiveMode('smart')
      setResults(renderable)
    } catch (err) {
      if (!shouldApplyResponse(request)) return
      console.error('Smart search failed:', err)
      setError('Smart search failed. Please try again.')
    } finally {
      if (shouldApplyResponse(request)) setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mount-only effect: restore from cache on Back navigation ────────────
  // The [searchParams] effect below won't re-fire when the URL is unchanged
  // (e.g. pressing Back to the same search URL). This effect runs once on
  // mount and handles that case by reading sessionStorage directly.

  const didMountRestoreRef = useRef(false)

  useEffect(() => {
    if (didMountRestoreRef.current) return
    didMountRestoreRef.current = true

    const q = (searchParams.get('q') || '').trim()
    const mode: Mode = searchParams.get('mode') === 'smart' ? 'smart' : 'keyword'
    if (!q || mode !== 'smart') return

    const notes = searchParams.get('notes') === '1'
    const rawScope = searchParams.get('scope') ?? 'all'
    const activeScope: EntityScope = VALID_SCOPES.includes(rawScope as EntityScope)
      ? (rawScope as EntityScope)
      : 'all'

    try {
      const cached = sessionStorage.getItem(smartSearchCacheKey(q, notes, activeScope))
      if (!cached) return
      const parsed = JSON.parse(cached) as RenderableResult[]
      setInputValue(q)
      setIncludeNotes(notes)
      setScope(activeScope)
      setActiveQuery(q)
      setActiveMode('smart')
      setResults(parsed)
      setIsLoading(false)
      setError(null)
      // Mark so the [searchParams] effect skips the live search for this query
      lastQuerySetByPageRef.current = q
    } catch {
      // Corrupted cache entry — [searchParams] effect will run the live search
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── URL hydration effect (THE ONLY PLACE THAT FIRES SEARCHES) ──────────

  useEffect(() => {
    const q = (searchParams.get('q') || '').trim()
    const mode: Mode = searchParams.get('mode') === 'smart' ? 'smart' : 'keyword'
    const notes = mode === 'smart' && searchParams.get('notes') === '1'
    const rawScope = searchParams.get('scope') ?? 'all'
    const activeScope: EntityScope = VALID_SCOPES.includes(rawScope as EntityScope)
      ? (rawScope as EntityScope)
      : 'all'

    const isOwnEcho = lastQuerySetByPageRef.current === q
    lastQuerySetByPageRef.current = null // clear after read — one-shot guard
    if (!isOwnEcho) {
      setInputValue(q)
    }
    setIncludeNotes(notes)
    setScope(activeScope)

    if (!q) {
      setActiveQuery('')
      setResults([])
      setError(null)
      latestRequestId.current++
      currentRequestRef.current = null
      setIsLoading(false)
      return
    }

    if (mode === 'smart') {
      // Check sessionStorage before firing a new Voyage API call.
      // On Back navigation the URL params are identical, so the key matches
      // and we restore results without touching /api/smart-search.
      try {
        const cached = sessionStorage.getItem(smartSearchCacheKey(q, notes, activeScope))
        if (cached) {
          const parsed = JSON.parse(cached) as RenderableResult[]
          setActiveQuery(q)
          setActiveMode('smart')
          setResults(parsed)
          setIsLoading(false)
          return
        }
      } catch {
        // Corrupted cache entry — fall through to live search
      }
      runSmartSearch(q, notes, activeScope)
    } else {
      runKeywordSearch(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── Event handlers (URL ONLY — no direct search calls) ─────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    if (!value.trim()) {
      lastQuerySetByPageRef.current = ''
      const clearParams = new URLSearchParams()
      if (scope !== 'all') clearParams.set('scope', scope)
      router.replace(clearParams.size ? `/search?${clearParams.toString()}` : '/search')
      return
    }

    // No live search while typing — user must press Enter to run search.
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()

    const trimmed = inputValue.trim()
    if (!trimmed) return

    const params = new URLSearchParams()
    params.set('q', trimmed)
    params.set('mode', 'smart')
    if (includeNotes) params.set('notes', '1')
    if (scope !== 'all') params.set('scope', scope)
    lastQuerySetByPageRef.current = trimmed
    router.push(`/search?${params.toString()}`)
  }

  const handleToggleNotes = () => {
    const next = !includeNotes

    if (activeMode === 'smart' && activeQuery) {
      const params = new URLSearchParams()
      params.set('q', activeQuery)
      params.set('mode', 'smart')
      if (next) params.set('notes', '1')
      if (scope !== 'all') params.set('scope', scope)
      lastQuerySetByPageRef.current = activeQuery
      router.push(`/search?${params.toString()}`)
      return
    }

    setIncludeNotes(next)
  }

  const handleScopeChange = (next: EntityScope) => {
    if (activeMode === 'smart' && activeQuery) {
      const params = new URLSearchParams()
      params.set('q', activeQuery)
      params.set('mode', 'smart')
      // notes toggle carries over unless scope forces it
      if (includeNotes || next === 'note') params.set('notes', '1')
      if (next !== 'all') params.set('scope', next)
      lastQuerySetByPageRef.current = activeQuery
      router.push(`/search?${params.toString()}`)
      return
    }

    setScope(next)
  }

  const handleResultClick = (result: RenderableResult) => {
    if (result.entity_type === 'note') {
      if (result.note_parent_entity_type && result.note_parent_entity_id) {
        router.push(entityPath(result.note_parent_entity_type, result.note_parent_entity_id))
      }
      return
    }

    if (result.entity_type === 'contact') {
      if (result.contact_company_id) {
        router.push(`/companies/${result.contact_company_id}/contacts/${result.entity_id}`)
      }
      return
    }

    router.push(entityPath(result.entity_type, result.entity_id))
  }

  // ── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      latestRequestId.current++
      currentRequestRef.current = null
    }
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────

  const showEmptyState = !inputValue && !activeQuery
  const showNoResults = activeQuery && !isLoading && results.length === 0 && !error

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Search</h1>

      {/* Search input */}
      <div className="space-y-3">
        <div className="relative">
          <Sparkles
            className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              activeMode === 'smart' && activeQuery
                ? 'text-violet-500 fill-violet-500'
                : 'text-muted-foreground'
            }`}
          />
          <input
            type="text"
            placeholder="Search candidates, companies, contacts, jobs, and notes... (Press Enter for smart search)"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 pr-24 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Searching...</span>
            </div>
          )}
        </div>

        {/* Mode indicator + scope selector + notes toggle row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode indicator */}
          {activeQuery && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {activeMode === 'smart' ? (
                <>
                  <Sparkles className="h-3 w-3 text-violet-500 fill-violet-500" />
                  Smart search
                </>
              ) : (
                <>
                  <Search className="h-3 w-3" />
                  Keyword search
                </>
              )}
            </span>
          )}

          {/* Scope selector — always visible so scope persists while typing */}
          {activeMode === 'smart' || !activeQuery || scope !== 'all' ? (
            <div className="flex items-center gap-1">
              {SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleScopeChange(opt.value)}
                  className={`flex h-8 items-center rounded-md border px-3 text-xs transition-colors ${
                    scope === opt.value
                      ? 'border-violet-400 bg-violet-400/10 text-violet-600 font-medium'
                      : 'border-input bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Include Notes toggle — hidden when scope is already 'note' */}
          {scope !== 'note' && (
            <button
              type="button"
              onClick={handleToggleNotes}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs transition-colors ${
                includeNotes
                  ? 'border-violet-400 bg-violet-400/10 text-violet-600'
                  : activeMode === 'keyword' && activeQuery
                    ? 'border-input bg-transparent text-muted-foreground'
                    : 'border-input bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {includeNotes ? 'Including notes' : 'Notes excluded'}
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Empty state */}
      {showEmptyState && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            Search candidates, companies, contacts, jobs, and notes.
          </p>
          <p className="text-sm text-muted-foreground/70">
            Hit Enter for smart search powered by AI.
          </p>
        </div>
      )}

      {/* No results */}
      {showNoResults && (
        <p className="py-16 text-center text-muted-foreground">
          No results found for &ldquo;{activeQuery}&rdquo;. Try different keywords or
          check your spelling.
        </p>
      )}

      {/* Result count */}
      {results.length > 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="divide-y divide-border rounded-md border">
          {results.map((result, index) => {
            const labelClass = matchLabelClassName(result.match_label)

            return (
              <button
                key={`${result.entity_type}-${result.entity_id}-${index}`}
                type="button"
                className="flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors hover:bg-accent cursor-pointer"
                onClick={() => handleResultClick(result)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`shrink-0 text-xs ${ENTITY_TYPE_COLORS[result.entity_type] || ''}`}
                    >
                      {ENTITY_TYPE_LABELS[result.entity_type] || result.entity_type}
                    </Badge>
                    <span className="font-medium">{result.entity_name}</span>
                  </div>
                  {result.match_label && labelClass && (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${labelClass}`}>
                      {result.match_label}
                    </span>
                  )}
                </div>
                <HighlightedSnippet snippet={result.snippet} />
                <span className="text-xs text-muted-foreground">
                  {new Date(result.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
