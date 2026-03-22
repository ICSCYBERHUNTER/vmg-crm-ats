'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchOverdueNextSteps, type OverdueItem } from '@/lib/supabase/dashboard'

export function OverdueNextSteps() {
  const [items, setItems] = useState<OverdueItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchOverdueNextSteps()
      .then(setItems)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="rounded-md border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
        Failed to load overdue items. Try refreshing.
      </div>
    )
  }

  if (!items) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="rounded-md bg-green-950/30 px-4 py-5 text-center">
            <p className="text-sm font-medium text-green-400">All caught up!</p>
            <p className="mt-1 text-xs text-green-600">No overdue items.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => {
            const href =
              item.source_type === 'job'
                ? `/jobs/${item.id}`
                : `/companies/${item.id}`
            return (
              <li key={`${item.source_type}-${item.id}`}>
                <Link
                  href={href}
                  className="flex items-center justify-between gap-3 py-3 px-1 rounded transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.next_step}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.source_label}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-destructive">
                    {item.days_overdue}d overdue
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
