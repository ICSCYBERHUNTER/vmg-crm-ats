'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { Checkbox } from '@/components/ui/checkbox'
import { getOverdueFollowUps, toggleFollowUp } from '@/lib/supabase/follow-ups'
import type { OverdueFollowUp } from '@/lib/supabase/follow-ups'

export function OverdueJobTasks() {
  const [tasks, setTasks] = useState<OverdueFollowUp[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    getOverdueFollowUps('job_opening')
      .then(setTasks)
      .finally(() => setLoaded(true))
  }, [])

  async function handleToggle(task: OverdueFollowUp) {
    setTasks(prev => prev.filter(t => t.id !== task.id))
    try {
      await toggleFollowUp(task.id, true)
    } catch {
      const data = await getOverdueFollowUps('job_opening')
      setTasks(data)
    }
  }

  if (!loaded || tasks.length === 0) return null

  const visible = showAll ? tasks : tasks.slice(0, 5)

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
      <p className="text-sm font-medium text-red-400 mb-2">Overdue tasks</p>
      <div className="space-y-1">
        {visible.map(task => (
          <div key={task.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={false}
              onCheckedChange={() => handleToggle(task)}
            />
            <span className="flex-1">
              {task.title}
              <span className="text-muted-foreground"> — {task.entity_name}</span>
            </span>
            <span className="text-xs text-red-400 shrink-0">
              {format(parseISO(task.due_date), 'MMM d')}
            </span>
          </div>
        ))}
      </div>
      {tasks.length > 5 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
        >
          Show all ({tasks.length})
        </button>
      )}
    </div>
  )
}
