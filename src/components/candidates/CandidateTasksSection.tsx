'use client'

import { useState, useCallback, useEffect } from 'react'
import { AddTaskForm } from '@/components/add-task-form'
import { TaskList } from '@/components/task-list'
import {
  getFollowUps,
  toggleFollowUpComplete,
  deleteFollowUp,
  type FollowUpWithNames,
} from '@/lib/supabase/follow-ups'

interface CandidateTasksSectionProps {
  candidateId: string
  candidateName: string
}

export function CandidateTasksSection({
  candidateId,
  candidateName,
}: CandidateTasksSectionProps) {
  const [tasks, setTasks] = useState<FollowUpWithNames[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await getFollowUps('candidate', candidateId)
    setTasks(data)
  }, [candidateId])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  async function handleToggle(id: string, isCompleted: boolean) {
    // Optimistic update
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              is_completed: isCompleted,
              completed_at: isCompleted ? new Date().toISOString() : null,
            }
          : t
      )
    )
    try {
      await toggleFollowUpComplete(id, isCompleted)
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

  if (loading) {
    return <div className="h-8 animate-pulse rounded bg-muted/50" />
  }

  return (
    <div className="space-y-3">
      <AddTaskForm
        currentEntityType="candidate"
        currentEntityId={candidateId}
        currentEntityName={candidateName}
        onTaskCreated={refresh}
      />
      <TaskList
        tasks={tasks}
        onToggleComplete={handleToggle}
        onDelete={handleDelete}
      />
    </div>
  )
}
