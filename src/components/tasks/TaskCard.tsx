'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Briefcase, Building2, User, Users, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleFollowUpComplete } from '@/lib/supabase/follow-ups'
import type { FollowUpWithNames } from '@/lib/supabase/follow-ups'

// Entity type → visual config for colored chips (inline styles to match PriorityBadge pattern)
const ENTITY_CHIP_CONFIG: Record<string, {
  label: string
  icon: typeof Briefcase
  bg: string
  color: string
}> = {
  candidate: {
    label: 'Candidate',
    icon: User,
    bg: '#0d2926',
    color: '#5eead4',
  },
  company: {
    label: 'Company',
    icon: Building2,
    bg: '#0c1a2e',
    color: '#60a5fa',
  },
  contact: {
    label: 'Contact',
    icon: Users,
    bg: '#1e0d2e',
    color: '#c084fc',
  },
  job_opening: {
    label: 'Job',
    icon: Briefcase,
    bg: '#1a0d2e',
    color: '#a78bfa',
  },
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

interface TaskCardProps {
  task: FollowUpWithNames
  onComplete?: () => void
}

export function TaskCard({ task, onComplete }: TaskCardProps) {
  const router = useRouter()
  const [isCompleted, setIsCompleted] = useState(task.is_completed)
  const [isPending, startTransition] = useTransition()

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = !isCompleted
    setIsCompleted(newValue) // optimistic

    try {
      await toggleFollowUpComplete(task.id, newValue)
      startTransition(() => {
        onComplete?.()
      })
      toast.success(newValue ? 'Task completed' : 'Task reopened')
    } catch {
      setIsCompleted(!newValue) // rollback
      toast.error('Failed to update task')
    }
  }

  // Determine due date display
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isOverdue = !isCompleted && task.due_date < todayStr
  const isDueToday = task.due_date === todayStr

  // Format due date for display (e.g., "Apr 22")
  const dueDate = new Date(
    parseInt(task.due_date.substring(0, 4)),
    parseInt(task.due_date.substring(5, 7)) - 1,
    parseInt(task.due_date.substring(8, 10))
  )
  const dueDateDisplay = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const primaryConfig = ENTITY_CHIP_CONFIG[task.entity_type]
  const secondaryConfig = task.secondary_entity_type
    ? ENTITY_CHIP_CONFIG[task.secondary_entity_type]
    : null

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:bg-accent/50',
        isCompleted && 'opacity-60',
        isPending && 'opacity-40'
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={handleToggleComplete}
        disabled={isPending}
        className={cn(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors',
          isCompleted
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40 hover:border-primary'
        )}
        aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isCompleted && <Check className="h-3 w-3" />}
      </button>

      {/* Task body */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className={cn(
          'text-sm font-medium leading-tight',
          isCompleted && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>

        {/* Description preview (if exists) */}
        {task.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            {task.description}
          </p>
        )}

        {/* Entity chips */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* Primary entity chip */}
          {primaryConfig && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const url = getEntityUrl(task.entity_type, task.entity_id, task.primary_company_id)
                if (url !== '#') router.push(url)
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: primaryConfig.bg, color: primaryConfig.color }}
            >
              <primaryConfig.icon className="h-3 w-3" />
              {task.primary_name}
            </button>
          )}

          {/* Separator dot */}
          {secondaryConfig && task.secondary_name && (
            <span className="text-muted-foreground text-xs">&middot;</span>
          )}

          {/* Secondary entity chip */}
          {secondaryConfig && task.secondary_name && task.secondary_entity_id && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const url = getEntityUrl(
                  task.secondary_entity_type!,
                  task.secondary_entity_id!,
                  task.secondary_company_id
                )
                if (url !== '#') router.push(url)
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: secondaryConfig.bg, color: secondaryConfig.color }}
            >
              <secondaryConfig.icon className="h-3 w-3" />
              {task.secondary_name}
            </button>
          )}
        </div>
      </div>

      {/* Due date badge — right side */}
      <span
        className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
        style={
          isOverdue
            ? { backgroundColor: '#2d1215', color: '#f87171' }
            : isDueToday
              ? { backgroundColor: '#2a1f0d', color: '#fbbf24' }
              : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
        }
      >
        {isOverdue ? `Overdue \u00b7 ${dueDateDisplay}` : dueDateDisplay}
      </span>
    </div>
  )
}
