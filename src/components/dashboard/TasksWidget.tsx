'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchUpcomingTasks, toggleFollowUpComplete, type FollowUpWithNames } from '@/lib/supabase/follow-ups'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Safe date formatting: parse YYYY-MM-DD as local date, not UTC
function formatDueDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return format(new Date(y, m - 1, d), 'MMM d')
}

function getEntityUrl(type: string, id: string, companyId?: string | null): string {
  switch (type) {
    case 'candidate': return `/candidates/${id}`
    case 'company': return `/companies/${id}`
    case 'job_opening': return `/jobs/${id}`
    case 'contact': return companyId ? `/companies/${companyId}/contacts/${id}` : '#'
    default: return '#'
  }
}

// ─── Task row ────────────────────────────────────────────────────────��────────

function TaskRow({
  task,
  isLocallyCompleted,
  onToggle,
}: {
  task: FollowUpWithNames
  isLocallyCompleted: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const done = isLocallyCompleted

  return (
    <div
      className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/40"
      style={done ? { opacity: 0.5 } : undefined}
    >
      <Checkbox checked={done} onCheckedChange={onToggle} />

      <span
        className={`text-sm cursor-pointer hover:underline ${done ? 'line-through text-muted-foreground' : ''}`}
        onClick={() => {
          const url = getEntityUrl(task.entity_type, task.entity_id, task.primary_company_id)
          if (url !== '#') router.push(url)
        }}
      >
        {task.title}
      </span>

      <span className="text-xs text-muted-foreground truncate max-w-[200px] shrink-0">
        {'· '}{task.primary_name}
        {task.secondary_name && task.secondary_entity_type && task.secondary_entity_id && (
          <>
            {' · '}
            <span
              className="cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                const url = getEntityUrl(task.secondary_entity_type!, task.secondary_entity_id!, task.secondary_company_id)
                if (url !== '#') router.push(url)
              }}
            >
              {task.secondary_name}
            </span>
          </>
        )}
      </span>

      <span className="text-xs text-muted-foreground shrink-0 ml-auto">
        {formatDueDate(task.due_date)}
      </span>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  label,
  headerClass,
  tasks,
  optimisticCompletionById,
  onToggle,
}: {
  label: string
  headerClass: string
  tasks: FollowUpWithNames[]
  optimisticCompletionById: Map<string, boolean>
  onToggle: (id: string) => void
}) {
  if (tasks.length === 0) return null

  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${headerClass}`}>
        {label} ({tasks.length})
      </p>
      <div className="space-y-0.5">
        {tasks.map(task => {
          // Derive displayed completion from optimistic map or task state
          const isDisplayedCompleted = optimisticCompletionById.has(task.id)
            ? optimisticCompletionById.get(task.id)!
            : task.is_completed

          return (
            <TaskRow
              key={task.id}
              task={task}
              isLocallyCompleted={isDisplayedCompleted}
              onToggle={() => onToggle(task.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Widget ────────────────────────────────────────────────────────────────��──

export function TasksWidget() {
  const [tasks, setTasks] = useState<FollowUpWithNames[] | null>(null)
  const [error, setError] = useState(false)
  // Track optimistic completion state per task id: true = completed, false = incomplete
  const [optimisticCompletionById, setOptimisticCompletionById] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    fetchUpcomingTasks()
      .then(setTasks)
      .catch(() => setError(true))
  }, [])

  async function handleToggle(id: string) {
    // Find the task to get current displayed state
    const task = tasks?.find(t => t.id === id)
    if (!task) return

    // Derive displayed completion state from optimistic map or task itself
    const displayedCompletion = optimisticCompletionById.has(id)
      ? optimisticCompletionById.get(id)!
      : task.is_completed

    // Compute next value (toggle)
    const nextValue = !displayedCompletion

    // Optimistic: update map
    setOptimisticCompletionById(prev => new Map(prev).set(id, nextValue))

    try {
      await toggleFollowUpComplete(id, nextValue)
    } catch {
      // Revert on failure
      setOptimisticCompletionById(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
        Failed to load tasks. Try refreshing.
      </div>
    )
  }

  if (!tasks) {
    return (
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 rounded-md" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const today = getTodayStr()
  const overdue = tasks.filter(t => t.due_date < today)
  const dueToday = tasks.filter(t => t.due_date === today)
  const upcoming = tasks.filter(t => t.due_date > today)

  const hasAny = overdue.length + dueToday.length + upcoming.length > 0

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="rounded-md bg-green-950/30 px-4 py-5 text-center">
            <p className="text-sm font-medium text-green-400">All caught up!</p>
            <p className="mt-1 text-xs text-green-600">No tasks due in the next 7 days.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="scrollbar-subtle max-h-[500px] overflow-y-auto space-y-4">
          <Section
            label="Overdue"
            headerClass="text-red-400"
            tasks={overdue}
            optimisticCompletionById={optimisticCompletionById}
            onToggle={handleToggle}
          />
          <Section
            label="Due Today"
            headerClass="text-amber-400"
            tasks={dueToday}
            optimisticCompletionById={optimisticCompletionById}
            onToggle={handleToggle}
          />
          <Section
            label="Upcoming"
            headerClass="text-muted-foreground"
            tasks={upcoming}
            optimisticCompletionById={optimisticCompletionById}
            onToggle={handleToggle}
          />
        </div>
      </CardContent>
    </Card>
  )
}
