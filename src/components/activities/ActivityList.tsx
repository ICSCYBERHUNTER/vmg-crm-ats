'use client'

import { useEffect, useState, useCallback } from 'react'
import { Lock, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ACTIVITY_TYPE_LABELS } from '@/lib/utils/labels'
import { fetchActivities, deleteActivity } from '@/lib/supabase/activities'
import { createClient } from '@/lib/supabase/client'
import type { ActivityEntityType, ActivityType, ActivityWithAuthor } from '@/types/database'

interface ActivityListProps {
  entityType: ActivityEntityType
  entityId: string
  refreshKey: number
}

const typeConfig: Record<ActivityType, { bg: string; color: string }> = {
  phone_call:       { bg: '#1e293b', color: '#60a5fa' },
  email:            { bg: '#0c2e1c', color: '#34d399' },
  conference:       { bg: '#2a1f0d', color: '#fbbf24' },
  linkedin_message: { bg: '#1e1636', color: '#a78bfa' },
  text_message:     { bg: '#0d2a1f', color: '#2dd4bf' },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ActivityList({ entityType, entityId, refreshKey }: ActivityListProps) {
  const [activities, setActivities] = useState<ActivityWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadActivities = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const data = await fetchActivities(entityType, entityId)
      setActivities(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities.')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    loadActivities()
  }, [loadActivities, refreshKey])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  async function handleDelete(activityId: string) {
    if (!confirm('Delete this activity? This cannot be undone.')) return
    setDeletingId(activityId)
    try {
      await deleteActivity(activityId)
      setActivities((prev) => prev.filter((a) => a.id !== activityId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete activity.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No activities yet. Log one above!
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const config = typeConfig[activity.activity_type]
        return (
          <div key={activity.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="rounded-full border-transparent font-medium"
                style={{ backgroundColor: config.bg, color: config.color }}
              >
                {ACTIVITY_TYPE_LABELS[activity.activity_type] ?? activity.activity_type}
              </Badge>
              {activity.is_private && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Private
                </span>
              )}
              <span
                className="ml-auto text-xs text-muted-foreground"
                title={new Date(activity.activity_date).toLocaleString()}
              >
                {timeAgo(activity.activity_date)}
              </span>
              {currentUserId === activity.created_by && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(activity.id)}
                  disabled={deletingId === activity.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <p className="text-sm whitespace-pre-wrap">{activity.description}</p>

            <p className="text-xs text-muted-foreground">
              — {activity.profiles?.full_name || 'Unknown user'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
