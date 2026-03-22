'use client'

import { useRouter } from 'next/navigation'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import type { CandidateApplication } from '@/types/database'

interface KanbanCardProps {
  application: CandidateApplication
  isOverlay?: boolean
}

export function KanbanCard({ application, isOverlay }: KanbanCardProps) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={!isOverlay ? style : undefined}
      {...(!isOverlay ? { ...listeners, ...attributes } : {})}
      onDoubleClick={() => router.push(`/candidates/${application.candidate_id}`)}
      title="Double-click to view candidate"
      className={cn(
        'rounded-md border border-border bg-card p-3 cursor-grab active:cursor-grabbing shadow-sm',
        isDragging && 'opacity-30',
        isOverlay && 'shadow-lg border-primary/50 rotate-2',
      )}
    >
      <p className="font-medium text-sm text-foreground">
        {application.candidate_name || 'Unknown Candidate'}
      </p>
      {application.candidate_current_title && (
        <p className="text-xs text-muted-foreground mt-1">
          {application.candidate_current_title}
        </p>
      )}
      {application.candidate_current_company && (
        <p className="text-xs text-muted-foreground">
          @ {application.candidate_current_company}
        </p>
      )}
    </div>
  )
}
