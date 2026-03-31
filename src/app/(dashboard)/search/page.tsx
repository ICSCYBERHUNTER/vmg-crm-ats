'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HighlightedSnippet } from '@/components/shared/HighlightedSnippet'
import { globalSearch } from '@/lib/supabase/search'
import { fetchContactCompanyId } from '@/lib/supabase/search'
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
  const query = searchParams.get('q') ?? ''

  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [starredCandidateIds, setStarredCandidateIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getStarredCandidateIds().then(setStarredCandidateIds).catch(() => {})
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      return
    }

    let cancelled = false
    setLoading(true)

    globalSearch(query).then((data) => {
      if (!cancelled) {
        setResults(data)
        setLoading(false)
        setSearched(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [query])

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

  // Group results by entity_type
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
      {/* Page header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {query
            ? `Search Results for "${query}"`
            : 'Search'}
        </h1>
        {searched && !loading && (
          <span className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Searching...</span>
        </div>
      )}

      {/* No query */}
      {!query && !loading && (
        <p className="py-16 text-center text-muted-foreground">
          Enter a search term above to search across all candidates, companies,
          notes, and job openings.
        </p>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">
          No results found for &ldquo;{query}&rdquo;. Try different keywords or
          check your spelling.
        </p>
      )}

      {/* Grouped results */}
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
                {group.map((result) => (
                  <button
                    key={`${result.entity_type}-${result.entity_id}-${result.match_source}`}
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
                      Found in: {getMatchSourceLabel(result.match_source)} ·{' '}
                      {new Date(result.created_at).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' }
                      )}
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
