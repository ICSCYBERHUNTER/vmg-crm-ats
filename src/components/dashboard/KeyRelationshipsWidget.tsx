'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchKeyRelationships } from '@/lib/supabase/key-relationships'
import type { KeyRelationshipWithDetails } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function getDaysBadge(days: number | null) {
  if (days === null) {
    return (
      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-[10px]">
        Never
      </Badge>
    )
  }
  if (days === 0) {
    return (
      <Badge variant="secondary" className="bg-green-950 text-green-400 text-[10px]">
        Today
      </Badge>
    )
  }
  if (days <= 60) {
    return (
      <Badge variant="secondary" className="bg-green-950 text-green-400 text-[10px]">
        {days}d
      </Badge>
    )
  }
  if (days <= 90) {
    return (
      <Badge variant="secondary" className="bg-amber-950 text-amber-400 text-[10px]">
        {days}d
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="bg-red-950 text-red-400 text-[10px]">
      {days}d
    </Badge>
  )
}

function getEntityLink(r: KeyRelationshipWithDetails): string {
  if (r.entity_type === 'candidate') return `/candidates/${r.entity_id}`
  if (r.entity_type === 'company_contact' && r.company_id) {
    return `/companies/${r.company_id}/contacts/${r.entity_id}`
  }
  return '#'
}

export function KeyRelationshipsWidget() {
  const [items, setItems] = useState<KeyRelationshipWithDetails[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchKeyRelationships()
      .then(setItems)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="rounded-md border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
        Failed to load key relationships. Try refreshing.
      </div>
    )
  }

  if (!items) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-md" />
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
          <p className="text-center text-sm text-muted-foreground">
            No key relationships yet
          </p>
        </CardContent>
      </Card>
    )
  }

  const top10 = items.slice(0, 10)
  const hasMore = items.length > 10

  return (
    <Card>
      <CardContent className="p-4">
        <ul className="flex flex-col divide-y divide-border">
          {top10.map((r) => (
            <li key={r.id}>
              <Link
                href={getEntityLink(r)}
                className="flex items-center justify-between gap-3 rounded px-1 py-2.5 transition-colors hover:bg-muted/40"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {r.name}
                </span>
                {getDaysBadge(r.days_since_contact)}
              </Link>
            </li>
          ))}
        </ul>
        {hasMore && (
          <div className="mt-2 text-center">
            <Link
              href="/key-relationships"
              className="text-xs font-medium text-primary hover:underline"
            >
              View All &rarr;
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
