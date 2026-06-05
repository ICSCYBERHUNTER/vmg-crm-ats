'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { label, CATEGORY_LABELS, SENIORITY_LEVEL_LABELS } from '@/lib/utils/labels'
import type { SimilarCandidate } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type SimilarResponse =
  | { status: 'ok'; results: SimilarCandidate[] }
  | { status: 'source_missing_embedding'; results: SimilarCandidate[]; message: string }
  | { status: 'no_similar_candidates'; results: SimilarCandidate[]; message: string }
  | { status: 'error'; message: string }

interface FindSimilarDialogProps {
  candidateId: string
  candidateName: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FindSimilarDialog({ candidateId, candidateName }: FindSimilarDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<SimilarResponse | null>(null)

  async function fetchSimilar() {
    setLoading(true)
    setResponse(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}/similar`)
      const data = (await res.json()) as SimilarResponse
      setResponse(data)
    } catch {
      setResponse({ status: 'error', message: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (isOpen) {
      fetchSimilar()
    }
  }

  function handleResultClick(id: string) {
    setOpen(false)
    router.push(`/candidates/${id}`)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <Sparkles className="mr-1.5 h-4 w-4" />
        Find Similar
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Candidates Similar to {candidateName}</DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Finding similar candidates...</p>
            </div>
          )}

          {!loading && response && (
            <>
              {(response.status === 'source_missing_embedding' ||
                response.status === 'no_similar_candidates') && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {response.message}
                </p>
              )}

              {response.status === 'error' && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <p className="text-sm text-muted-foreground">
                    Something went wrong. Please try again.
                  </p>
                  <Button variant="outline" size="sm" onClick={fetchSimilar}>
                    Retry
                  </Button>
                </div>
              )}

              {response.status === 'ok' && (
                <div className="scrollbar-subtle max-h-[60vh] overflow-y-auto divide-y">
                  {response.results.map((result) => {
                    const titleCompany =
                      [result.current_title, result.current_company]
                        .filter(Boolean)
                        .join(' at ') || '—'
                    const location = [result.location_city, result.location_state]
                      .filter(Boolean)
                      .join(', ')
                    const similarityPct = Math.round(result.similarity_score * 100)
                    const categoryLabel = result.category
                      ? label(CATEGORY_LABELS, result.category)
                      : null
                    const seniorityLabel = result.seniority_level
                      ? label(SENIORITY_LEVEL_LABELS, result.seniority_level)
                      : null

                    return (
                      <div
                        key={result.id}
                        className="flex items-start justify-between gap-4 px-1 py-3 cursor-pointer rounded hover:bg-muted/50 transition-colors"
                        onClick={() => handleResultClick(result.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {result.is_star && (
                              <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                            )}
                            <span className="text-sm font-medium text-blue-400 hover:underline">
                              {result.first_name} {result.last_name}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{titleCompany}</p>
                          {location && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{location}</p>
                          )}
                          {(categoryLabel || seniorityLabel) && (
                            <div className="mt-1.5 flex gap-1.5">
                              {categoryLabel && categoryLabel !== '—' && (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {categoryLabel}
                                </span>
                              )}
                              {seniorityLabel && seniorityLabel !== '—' && (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {seniorityLabel}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-xs text-muted-foreground">
                            Similarity: {similarityPct}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
