'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchQuickStats, type QuickStats } from '@/lib/supabase/dashboard'

interface StatCard {
  label: string
  value: number
  href: string
}

export function QuickStats() {
  const router = useRouter()
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchQuickStats()
      .then(setStats)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="rounded-md border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
        Failed to load stats. Try refreshing.
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  const cards: StatCard[] = [
    { label: 'Total candidates', value: stats.totalCandidates, href: '/candidates' },
    { label: 'Client companies', value: stats.clientCompanies, href: '/companies' },
    { label: 'Open jobs', value: stats.openJobs, href: '/jobs' },
    { label: 'Active prospects', value: stats.activeProspects, href: '/companies' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.label}
          onClick={() => router.push(card.href)}
          className="rounded-lg border border-border bg-muted/50 p-4 text-left transition-colors hover:bg-muted/80"
        >
          <p className="text-[13px] text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{card.value}</p>
        </button>
      ))}
    </div>
  )
}
