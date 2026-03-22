'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  fetchPipelineSnapshot,
  type PipelineSnapshotStage,
} from '@/lib/supabase/dashboard'

const MAX_BAR_HEIGHT = 120
const MIN_BAR_HEIGHT = 8

export function PipelineSnapshot() {
  const [stages, setStages] = useState<PipelineSnapshotStage[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchPipelineSnapshot()
      .then(setStages)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="rounded-md border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
        Failed to load pipeline snapshot. Try refreshing.
      </div>
    )
  }

  if (!stages) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-end gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <Skeleton className="w-full rounded-t-sm" style={{ height: `${60 + i * 15}px` }} />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (stages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="py-4 text-center text-sm text-muted-foreground">
            No active candidates in pipelines.
          </p>
        </CardContent>
      </Card>
    )
  }

  const maxCount = Math.max(...stages.map((s) => s.candidate_count))
  const lastStageName = stages[stages.length - 1]?.stage_name?.toLowerCase() ?? ''
  const isOfferStage = (name: string) =>
    name.toLowerCase().includes('offer') || name.toLowerCase().includes('placed')

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-end gap-3">
          {stages.map((stage) => {
            const barHeight = Math.max(
              MIN_BAR_HEIGHT,
              Math.round((stage.candidate_count / maxCount) * MAX_BAR_HEIGHT)
            )
            const isGoalStage =
              isOfferStage(stage.stage_name) ||
              stage.stage_name === stages[stages.length - 1]?.stage_name
            void lastStageName

            return (
              <div
                key={stage.stage_name}
                className="flex flex-1 flex-col items-center gap-1"
              >
                {/* Count above bar */}
                <span className="text-xs font-medium text-foreground">
                  {stage.candidate_count}
                </span>
                {/* Bar */}
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    isGoalStage ? 'bg-green-500' : 'bg-primary'
                  }`}
                  style={{ height: `${barHeight}px` }}
                />
                {/* Stage name */}
                <span className="mt-1 text-center text-[11px] leading-tight text-muted-foreground">
                  {stage.stage_name}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
