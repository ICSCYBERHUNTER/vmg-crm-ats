'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { format, isToday, isPast, parseISO } from 'date-fns'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/shared/DatePicker'
import {
  getFollowUps,
  createFollowUp,
  toggleFollowUp,
  deleteFollowUp,
} from '@/lib/supabase/follow-ups'
import type { FollowUp } from '@/types/database'

interface FollowUpTasksProps {
  entityType: string
  entityId: string
}

export function FollowUpTasks({ entityType, entityId }: FollowUpTasksProps) {
  const [tasks, setTasks] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [showCompleted, setShowCompleted] = useState(false)
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    const data = await getFollowUps(entityType, entityId)
    setTasks(data)
  }, [entityType, entityId])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const incompleteTasks = tasks.filter(t => !t.is_completed)
  const completedTasks = tasks
    .filter(t => t.is_completed)
    .sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bTime - aTime
    })
  const visibleCompleted = showAllCompleted ? completedTasks : completedTasks.slice(0, 4)

  async function handleAdd() {
    if (!title.trim() || !dueDate || submitting) return
    setSubmitting(true)
    try {
      await createFollowUp({
        entity_type: entityType,
        entity_id: entityId,
        title: title.trim(),
        due_date: format(dueDate, 'yyyy-MM-dd'),
      })
      setTitle('')
      setDueDate(undefined)
      await refresh()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(task: FollowUp) {
    const newCompleted = !task.is_completed
    // Optimistic update
    setTasks(prev =>
      prev.map(t =>
        t.id === task.id
          ? { ...t, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
          : t
      )
    )
    try {
      await toggleFollowUp(task.id, newCompleted)
      await refresh()
    } catch {
      await refresh()
    }
  }

  async function handleDelete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    try {
      await deleteFollowUp(id)
    } catch {
      await refresh()
    }
  }

  function dueDateColor(dateStr: string): string {
    const date = parseISO(dateStr)
    if (isToday(date)) return 'text-amber-400'
    if (isPast(date)) return 'text-red-400'
    return 'text-muted-foreground'
  }

  if (loading) {
    return <div className="h-8 animate-pulse rounded bg-muted/50" />
  }

  return (
    <div className="space-y-2">
      {/* Quick-Add Row */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add a task..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          className="flex-1 h-8 text-sm"
        />
        <div className="w-[150px] shrink-0">
          <DatePicker
            value={dueDate}
            onChange={setDueDate}
            placeholder="Due date"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!title.trim() || !dueDate || submitting}
          className="h-8 px-3 text-xs"
        >
          Add
        </Button>
      </div>

      {/* Incomplete Tasks */}
      {incompleteTasks.length > 0 && (
        <div className="space-y-0.5">
          {incompleteTasks.map(task => (
            <div
              key={task.id}
              className="group flex items-center gap-2 rounded px-1 py-1.5 hover:bg-muted/50"
            >
              <Checkbox
                checked={false}
                onCheckedChange={() => handleToggle(task)}
              />
              <span className="flex-1 text-sm">{task.title}</span>
              <span className={`text-xs shrink-0 ${dueDateColor(task.due_date)}`}>
                {format(parseISO(task.due_date), 'MMM d')}
              </span>
              <button
                onClick={() => handleDelete(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(prev => !prev)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            {showCompleted ? 'Hide completed' : `Show completed (${completedTasks.length})`}
          </button>

          {showCompleted && (
            <div className="space-y-0.5 mt-1">
              {visibleCompleted.map(task => (
                <div
                  key={task.id}
                  className="group flex items-center gap-2 rounded px-1 py-1.5 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={true}
                    onCheckedChange={() => handleToggle(task)}
                  />
                  <span className="flex-1 text-sm line-through text-muted-foreground">
                    {task.title}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {task.completed_at ? format(parseISO(task.completed_at), 'MMM d') : ''}
                  </span>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {completedTasks.length > 4 && !showAllCompleted && (
                <button
                  onClick={() => setShowAllCompleted(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 pl-1"
                >
                  Show all ({completedTasks.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
