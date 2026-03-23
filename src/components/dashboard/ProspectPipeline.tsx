'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchProspectPipeline, type ProspectPipelineCounts } from '@/lib/supabase/dashboard'

interface StageConfig {
  key: keyof ProspectPipelineCounts
  label: string
  countBg: string
  countColor: string
  colBg: string
}

const stages: StageConfig[] = [
  {
    key: 'researching',
    label: 'Researching',
    countBg: '#2d1b4e',
    countColor: '#c084fc',
    colBg: 'bg-purple-950/30',
  },
  {
    key: 'targeted',
    label: 'Targeted',
    countBg: '#1e3a5f',
    countColor: '#60a5fa',
    colBg: 'bg-blue-950/30',
  },
  {
    key: 'contacted',
    label: 'Contacted',
    countBg: '#422006',
    countColor: '#fbbf24',
    colBg: 'bg-amber-950/30',
  },
  {
    key: 'negotiating_fee',
    label: 'Negotiating Fee',
    countBg: '#2d1b4e',
    countColor: '#c084fc',
    colBg: 'bg-purple-950/30',
  },
  {
    key: 'closed',
    label: 'Closed',
    countBg: '#14291a',
    countColor: '#4ade80',
    colBg: 'bg-green-950/30',
  },
]

export function ProspectPipeline() {
  const router = useRouter()
  const [counts, setCounts] = useState<ProspectPipelineCounts | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchProspectPipeline()
      .then(setCounts)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="rounded-md border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
        Failed to load prospect pipeline. Try refreshing.
      </div>
    )
  }

  if (!counts) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = Object.values(counts).reduce((sum, v) => sum + v, 0)

  return (
    <Card>
      <CardContent className="p-4">
        {total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No active prospects. Start by adding prospect companies.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {stages.map((stage) => (
              <button
                key={stage.key}
                onClick={() => router.push('/companies')}
                className={`flex flex-col items-center gap-2 rounded-lg p-4 transition-colors hover:opacity-80 ${stage.colBg}`}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl font-bold"
                  style={{ backgroundColor: stage.countBg, color: stage.countColor }}
                >
                  {counts[stage.key]}
                </div>
                <span className="text-center text-sm font-medium text-foreground">
                  {stage.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
