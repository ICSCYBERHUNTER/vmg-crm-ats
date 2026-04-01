'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { HighlightedSnippet } from '@/components/shared/HighlightedSnippet'
import { globalSearch, fetchContactCompanyId } from '@/lib/supabase/search'
import { getStarredCandidateIds } from '@/lib/supabase/candidates-client'
import {
  getSearchResultUrl,
  getMatchSourceLabel,
  getEntityTypeIcon,
  getEntityTypeLabel,
} from '@/lib/utils/search'
import type { SearchResult } from '@/types/database'

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(urlQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [starredCandidateIds, setStarredCandidateIds] = useState<Set<string>>(new Set())

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestIdRef = useRef(0)
  const skipNextDebounceRef = useRef(false)
  const pendingUrlSyncRef = useRef<string | null>(null)

  useEffect(() => {
    getStarredCandidateIds().then(setStarredCandidateIds).catch(() => {})
  }, [])

  const clearSearch = useCallback((invalidatePending = false) => {
    if (invalidatePending) {
      searchRequestIdRef.current += 1
    }

    setResults([])
    setLoading(false)
    setSearched(false)
  }, [])

  const syncUrl = useCallback(
    (rawQuery: string) => {
      const trimmed = rawQuery.trim()
      const nextUrl = trimmed
        ? `/search?q=${encodeURIComponent(trimmed)}`
        : '/search'

      pendingUrlSyncRef.current = trimmed
      router.replace(nextUrl)
    },
    [router]
  )

  const performSearch = useCallback(
    async (rawQuery: string, options?: { syncUrl?: boolean }) => {
      const trimmed = rawQuery.trim()

      if (trimmed.length < 2) {
        clearSearch(true)
        if (options?.syncUrl !== false) {
          syncUrl(trimmed)
        }
        return
      }

      if (options?.syncUrl !== false) {
        syncUrl(trimmed)
      }

      const requestId = searchRequestIdRef.current + 1
      searchRequestIdRef.current = requestId

      setSearched(false)
      setLoading(true)

      try {
        const data = await globalSearch(trimmed)
        if (searchRequestIdRef.current !== requestId) return

        setResults(data)
        setSearched(true)
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    [clearSearch, syncUrl]
  )

  useEffect(() => {
    const trimmedUrlQuery = urlQuery.trim()

    if (pendingUrlSyncRef.current === trimmedUrlQuery) {
      pendingUrlSyncRef.current = null
      return
    }

    skipNextDebounceRef.current = true
    setQuery(urlQuery)

    if (trimmedUrlQuery.length < 2) {
      clearSearch(true)
      return
    }

    void performSearch(trimmedUrlQuery, { syncUrl: false })
  }, [urlQuery, clearSearch, performSearch])

  useEffect(() => {
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false
      return
    }

    const trimmedQuery = query.trim()

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (trimmedQuery.length < 2) {
      clearSearch(true)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      void performSearch(trimmedQuery)
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, clearSearch, performSearch])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    void performSearch(query)
  }

  const handleQueryChange = useCallback(
    (nextQuery: string) => {
      setQuery(nextQuery)
      syncUrl(nextQuery)
    },
    [syncUrl]
  )

  const handleResultClick = useCallback(
    async (result: SearchResult) => {
      if (result.entity_type === 'contact') {
        const companyId = await fetchContactCompanyId(result.entity_id)
        router.push(getSearchResultUrl(result, companyId ?? undefined))
      } else {
        router.push(getSearchResultUrl(result))
      }
    },
    [router]
  )

  const grouped = results.reduce<Record<string, SearchResult[]>>(
    (acc, result) => {
      const key = result.entity_type
      if (!acc[key]) acc[key] = []
      acc[key].push(result)
      return acc
    },
    {}
  )

  const groupOrder = ['candidate', 'company', 'contact', 'job_opening']
  const sortedGroups = Object.keys(grouped).sort(
    (a, b) => (groupOrder.indexOf(a) ?? 99) - (groupOrder.indexOf(b) ?? 99)
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {query ? `Search Results for "${query}"` : 'Search'}
        </h1>
        {searched && !loading && (
          <span className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search candidates, companies, notes..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-9 pr-24"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Searching...</span>
            </div>
          )}
        </div>
      </form>

      {query.trim().length < 2 && !loading && (
        <p className="py-16 text-center text-muted-foreground">
          Enter at least 2 characters to search across candidates, companies,
          notes, and job openings.
        </p>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">
          No results found for &ldquo;{query}&rdquo;. Try different keywords or
          check your spelling.
        </p>
      )}

      {!loading &&
        sortedGroups.map((entityType) => {
          const group = grouped[entityType]
          const Icon = getEntityTypeIcon(entityType)

          return (
            <Card key={entityType}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-5 w-5" />
                  {getEntityTypeLabel(entityType)} ({group.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {group.map((result, index) => (
                  <button
                    key={`${result.entity_type}-${result.entity_id}-${result.match_source}-${index}`}
                    type="button"
                    className="flex w-full flex-col gap-1 px-6 py-3 text-left transition-colors hover:bg-accent"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {result.entity_type === 'candidate' && starredCandidateIds.has(result.entity_id) ? (
                        <span className="flex items-center gap-1 font-medium text-amber-400">
                          {result.entity_name}
                          <Star className="h-3 w-3 fill-amber-400" />
                        </span>
                      ) : (
                        <span className="font-medium">{result.entity_name}</span>
                      )}
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {getMatchSourceLabel(result.match_source)}
                      </Badge>
                    </div>
                    <HighlightedSnippet snippet={result.snippet} />
                    <span className="text-xs text-muted-foreground">
                      Found in: {getMatchSourceLabel(result.match_source)} ú{' '}
                      {new Date(result.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )
        })}
    </div>
  )
}
