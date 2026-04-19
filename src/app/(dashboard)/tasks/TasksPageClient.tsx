'use client'

import { useState, useEffect, useCallback } from 'react'
import { TaskCard } from '@/components/tasks/TaskCard'
import { ChevronDown, ChevronRight, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchAllTasks } from '@/lib/supabase/follow-ups'
import type { FollowUpWithNames } from '@/lib/supabase/follow-ups'
import { Skeleton } from '@/components/ui/skeleton'

function getTodayStr(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function getEndOfWeekStr(): string {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 6=Sat
  const daysUntilSunday = 7 - dayOfWeek
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${endOfWeek.getFullYear()}-${pad(endOfWeek.getMonth() + 1)}-${pad(endOfWeek.getDate())}`
}

export function TasksPageClient() {
  const [tasks, setTasks] = useState<FollowUpWithNames[] | null>(null)
  const [error, setError] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [completedTasks, setCompletedTasks] = useState<FollowUpWithNames[]>([])
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)

  const loadTasks = useCallback(() => {
    fetchAllTasks(false)
      .then(setTasks)
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const today = getTodayStr()
  const endOfWeek = getEndOfWeekStr()

  // Group tasks into sections
  const overdue = tasks?.filter(t => !t.is_completed && t.due_date < today) ?? []
  const dueToday = tasks?.filter(t => !t.is_completed && t.due_date === today) ?? []
  const thisWeek = tasks?.filter(t => !t.is_completed && t.due_date > today && t.due_date <= endOfWeek) ?? []
  const upcoming = tasks?.filter(t => !t.is_completed && t.due_date > endOfWeek) ?? []

  const handleRefresh = useCallback(() => {
    loadTasks()
  }, [loadTasks])

  const handleToggleCompleted = async () => {
    if (!showCompleted) {
      setIsLoadingCompleted(true)
      try {
        const allTasks = await fetchAllTasks(true)
        setCompletedTasks(allTasks.filter(t => t.is_completed))
      } catch {
        // silently fail
      } finally {
        setIsLoadingCompleted(false)
      }
    }
    setShowCompleted(prev => !prev)
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        </div>
        <div className="rounded-md border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
          Failed to load tasks. Try refreshing.
        </div>
      </div>
    )
  }

  if (!tasks) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  const totalOpen = overdue.length + dueToday.length + thisWeek.length + upcoming.length
  const allEmpty = totalOpen === 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {overdue.length > 0
            ? `${overdue.length} overdue \u00b7 ${totalOpen - overdue.length} open`
            : `${totalOpen} open tasks`
          }
        </p>
      </div>

      {/* Task sections */}
      {!allEmpty && (
        <div className="space-y-6">
          <TaskSection
            title="Overdue"
            count={overdue.length}
            tasks={overdue}
            headerStyle={{ color: '#f87171' }}
            onComplete={handleRefresh}
          />
          <TaskSection
            title="Due today"
            count={dueToday.length}
            tasks={dueToday}
            headerStyle={{ color: '#fbbf24' }}
            onComplete={handleRefresh}
          />
          <TaskSection
            title="This week"
            count={thisWeek.length}
            tasks={thisWeek}
            onComplete={handleRefresh}
          />
          <TaskSection
            title="Upcoming"
            count={upcoming.length}
            tasks={upcoming}
            onComplete={handleRefresh}
          />
        </div>
      )}

      {/* Empty state */}
      {allEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ListChecks className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-medium text-muted-foreground">All caught up</h2>
          <p className="text-sm text-muted-foreground/60 mt-1">
            No open tasks. Create tasks from candidate, company, or job pages.
          </p>
        </div>
      )}

      {/* Show Completed toggle */}
      <div className="border-t border-border pt-4">
        <button
          type="button"
          onClick={handleToggleCompleted}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <ListChecks className="h-4 w-4" />
          Show completed tasks
          {showCompleted && completedTasks.length > 0 && (
            <span className="text-xs">({completedTasks.length})</span>
          )}
        </button>

        {showCompleted && (
          <div className="mt-4 space-y-2">
            {isLoadingCompleted ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : completedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed tasks</p>
            ) : (
              completedTasks.map(task => (
                <TaskCard key={task.id} task={task} onComplete={handleRefresh} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Section subcomponent ----

interface TaskSectionProps {
  title: string
  count: number
  tasks: FollowUpWithNames[]
  headerStyle?: React.CSSProperties
  onComplete?: () => void
}

function TaskSection({ title, count, tasks, headerStyle, onComplete }: TaskSectionProps) {
  if (tasks.length === 0) return null

  return (
    <div>
      <h2
        className={cn(
          'text-xs font-semibold uppercase tracking-wider mb-3',
          !headerStyle && 'text-muted-foreground'
        )}
        style={headerStyle}
      >
        {title} ({count})
      </h2>
      <div className="space-y-2">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onComplete={onComplete} />
        ))}
      </div>
    </div>
  )
}
