'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchProspectPipeline, type ProspectPipelineCounts } from '@/lib/supabase/dashboard'

interface BucketConfig {
  key: keyof ProspectPipelineCounts
  label: string
  href: string
  countBg: string
  countColor: string
  colBg: string
}

// Four pipeline stages + a "Needs Attention" bucket. (The old "Closed" stage was
// dropped: closing a prospect flips its status to client, so it leaves this view.)
// Each bucket links into the Prospects worklist, pre-filtered.
const buckets: BucketConfig[] = [
  {
    key: 'researching',
    label: 'Researching',
    href: '/prospects?stage=researching',
    countBg: '#2d1b4e',
    countColor: '#c084fc',
    colBg: 'bg-purple-950/30',
  },
  {
    key: 'targeted',
    label: 'Targeted',
    href: '/prospects?stage=targeted',
    countBg: '#1e3a5f',
    countColor: '#60a5fa',
    colBg: 'bg-blue-950/30',
  },
  {
    key: 'contacted',
    label: 'Contacted',
    href: '/prospects?stage=contacted',
    countBg: '#422006',
    countColor: '#fbbf24',
    colBg: 'bg-amber-950/30',
  },
  {
    key: 'negotiating_fee',
    label: 'Negotiating Fee',
    href: '/prospects?stage=negotiating_fee',
    countBg: '#2d1b4e',
    countColor: '#c084fc',
    colBg: 'bg-purple-950/30',
  },
  {
    key: 'needs_attention',
    label: 'Needs Attention',
    href: '/prospects?view=attention',
    countBg: '#2d1215',
    countColor: '#f87171',
    colBg: 'bg-red-950/30',
  },
]

export function ProspectPipeline() {
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

  const totalProspects =
    counts.researching + counts.targeted + counts.contacted + counts.negotiating_fee

  return (
    <Card>
      <CardContent className="p-4">
        {totalProspects === 0 && counts.needs_attention === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No active prospects. Start by adding prospect companies.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {buckets.map((bucket) => (
              <Link
                key={bucket.key}
                href={bucket.href}
                className={`flex flex-col items-center gap-2 rounded-lg p-4 transition-colors hover:opacity-80 ${bucket.colBg}`}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl font-bold"
                  style={{ backgroundColor: bucket.countBg, color: bucket.countColor }}
                >
                  {counts[bucket.key]}
                </div>
                <span className="text-center text-sm font-medium text-foreground">
                  {bucket.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
