'use client'

import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { KanbanCard } from './KanbanCard'
import type { CandidateApplication, PipelineStage } from '@/types/database'

interface KanbanColumnProps {
  stage: PipelineStage
  applications: CandidateApplication[]
}

export function KanbanColumn({ stage, applications }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[280px] w-[280px] rounded-lg border border-border bg-card/50',
        isOver && 'border-primary/50 bg-primary/5',
      )}
    >
      {/* Column header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-foreground">{stage.name}</h3>
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {applications.length}
          </span>
        </div>
      </div>

      {/* Cards container */}
      <div className="p-2 flex flex-col gap-2 flex-1 min-h-[100px]">
        {applications.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No candidates
          </p>
        ) : (
          applications.map(app => (
            <KanbanCard key={app.id} application={app} />
          ))
        )}
      </div>
    </div>
  )
}
