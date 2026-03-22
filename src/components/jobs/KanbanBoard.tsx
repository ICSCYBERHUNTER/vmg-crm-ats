'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { fetchPipelineStages } from '@/lib/supabase/pipeline-stages'
import {
  fetchActiveApplicationsByJob,
  moveApplicationToStage,
} from '@/lib/supabase/candidate-applications'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { CandidateApplication, PipelineStage } from '@/types/database'

interface KanbanBoardProps {
  jobOpeningId: string
  refreshKey?: number
  onStageChange?: () => void
}

export function KanbanBoard({ jobOpeningId, refreshKey, onStageChange }: KanbanBoardProps) {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [applications, setApplications] = useState<CandidateApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCard, setActiveCard] = useState<CandidateApplication | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const loadData = useCallback(async () => {
    try {
      const [stagesData, appsData] = await Promise.all([
        fetchPipelineStages(jobOpeningId),
        fetchActiveApplicationsByJob(jobOpeningId),
      ])
      setStages(stagesData)
      setApplications(appsData)
    } catch {
      toast.error('Failed to load pipeline board')
    } finally {
      setLoading(false)
    }
  }, [jobOpeningId])

  useEffect(() => {
    loadData()
  }, [loadData, refreshKey])

  function getApplicationsForStage(stageId: string): CandidateApplication[] {
    return applications.filter(app => app.current_stage_id === stageId)
  }

  function resolveStageId(overId: string): string | null {
    const isStage = stages.some(s => s.id === overId)
    if (isStage) return overId

    const overApp = applications.find(app => app.id === overId)
    return overApp?.current_stage_id || null
  }

  function handleDragStart(event: DragStartEvent) {
    const draggedApp = applications.find(app => app.id === event.active.id)
    setActiveCard(draggedApp || null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)

    if (!over) return

    const applicationId = active.id as string
    const application = applications.find(app => app.id === applicationId)
    if (!application) return

    const newStageId = resolveStageId(over.id as string)
    const oldStageId = application.current_stage_id

    if (!newStageId || newStageId === oldStageId) return

    // Optimistic update
    setApplications(prev =>
      prev.map(app =>
        app.id === applicationId
          ? { ...app, current_stage_id: newStageId }
          : app
      )
    )

    try {
      const { error } = await moveApplicationToStage(applicationId, oldStageId!, newStageId)
      if (error) throw error
      onStageChange?.()
    } catch {
      // Rollback
      setApplications(prev =>
        prev.map(app =>
          app.id === applicationId
            ? { ...app, current_stage_id: oldStageId }
            : app
        )
      )
      toast.error('Failed to move candidate. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Pipeline Board</h2>
        <div className="flex gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[200px] min-w-[280px] w-[280px] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pipeline Board</h2>

      {stages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pipeline stages defined. Add stages above to see the pipeline board.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                applications={getApplicationsForStage(stage.id)}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCard ? <KanbanCard application={activeCard} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
