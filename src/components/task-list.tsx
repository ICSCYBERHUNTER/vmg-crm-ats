'use client'

import { useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { format, isToday, isPast, parseISO } from 'date-fns'
import { Checkbox } from '@/components/ui/checkbox'
import type { FollowUpWithNames } from '@/lib/supabase/follow-ups'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskListProps {
  tasks: FollowUpWithNames[]
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onDelete: (id: string) => void
  compact?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dueDateColor(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'text-amber-400'
  if (isPast(date)) return 'text-red-400'
  return 'text-muted-foreground'
}

function TaskRow({
  task,
  done,
  onToggle,
  onDelete,
  showDueDateAs,
  compact,
}: {
  task: FollowUpWithNames
  done: boolean
  onToggle: () => void
  onDelete: () => void
  showDueDateAs?: 'due' | 'completed'
  compact?: boolean
}) {
  const context = task.secondary_name
    ? `${task.primary_name} · ${task.secondary_name}`
    : task.primary_name

  const dateStr =
    showDueDateAs === 'completed' && task.completed_at
      ? format(parseISO(task.completed_at), 'MMM d')
      : format(parseISO(task.due_date), 'MMM d')

  const dateColorClass =
    showDueDateAs === 'completed'
      ? 'text-muted-foreground'
      : dueDateColor(task.due_date)

  return (
    <div
      className="group flex items-center gap-2 rounded px-1 py-1.5 hover:bg-muted/50"
      style={done ? { opacity: 0.5 } : undefined}
    >
      <Checkbox checked={done} onCheckedChange={onToggle} />

      <span className={`min-w-0 text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>
        {task.title}
      </span>

      <span className={`text-xs text-muted-foreground shrink-0 ${compact ? 'truncate max-w-[220px]' : ''}`}>
        · {context}
      </span>

      <span className={`text-xs shrink-0 ml-auto ${dateColorClass}`}>
        {dateStr}
      </span>

      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
        aria-label="Delete task"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskList({ tasks, onToggleComplete, onDelete, compact }: TaskListProps) {
  // Capture the IDs of tasks that were already complete when this component
  // first mounted. These live in the <details> expander and stay there.
  // Tasks completed DURING this session stay in the active list with strikethrough.
  const initiallyCompletedIds = useRef<Set<string> | null>(null)
  if (initiallyCompletedIds.current === null) {
    initiallyCompletedIds.current = new Set(
      tasks.filter(t => t.is_completed).map(t => t.id)
    )
  }

  const activeTasks = tasks.filter(t => !initiallyCompletedIds.current!.has(t.id))
  const completedAtLoad = tasks.filter(t => initiallyCompletedIds.current!.has(t.id))

  return (
    <div className="space-y-0.5">
      {activeTasks.length === 0 && completedAtLoad.length === 0 && (
        <p className="text-xs text-muted-foreground py-1">No tasks yet.</p>
      )}

      {activeTasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          done={task.is_completed}
          onToggle={() => onToggleComplete(task.id, !task.is_completed)}
          onDelete={() => onDelete(task.id)}
          compact={compact}
        />
      ))}

      {/* Tasks completed before this page load */}
      {completedAtLoad.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors py-1 list-none [&::-webkit-details-marker]:hidden">
            Show completed ({completedAtLoad.length})
          </summary>
          <div className="space-y-0.5 mt-1">
            {completedAtLoad.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                done={true}
                onToggle={() => onToggleComplete(task.id, false)}
                onDelete={() => onDelete(task.id)}
                showDueDateAs="completed"
                compact={compact}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
