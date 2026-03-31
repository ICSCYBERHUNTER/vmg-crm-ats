'use client'

import { useRouter } from 'next/navigation'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CandidateApplication } from '@/types/database'

interface KanbanCardProps {
  application: CandidateApplication
  isOverlay?: boolean
  onRemove?: (application: CandidateApplication) => void
  accentColor?: string
}

export function KanbanCard({ application, isOverlay, onRemove, accentColor }: KanbanCardProps) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  })

  const style = {
    transform: !isOverlay ? CSS.Translate.toString(transform) : undefined,
    ...(accentColor && !isOverlay ? {
      borderLeft: `2.5px solid ${accentColor}`,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    } : {}),
  }

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={style}
      {...(!isOverlay ? { ...listeners, ...attributes } : {})}
      onDoubleClick={() => router.push(`/candidates/${application.candidate_id}`)}
      title="Double-click to view candidate"
      className={cn(
        'group relative rounded-md border border-border bg-card p-2 cursor-grab active:cursor-grabbing shadow-sm',
        isDragging && 'opacity-30',
        isOverlay && 'shadow-lg border-primary/50 rotate-2',
      )}
    >
      {/* Remove button — hover only */}
      {onRemove && !isOverlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(application)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/80"
          title="Remove from pipeline"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <p className="font-medium text-sm text-foreground leading-tight">
        {application.candidate_name || 'Unknown Candidate'}
      </p>
      {application.candidate_current_title && (
        <p className="text-xs text-zinc-400 mt-0.5 leading-tight">
          {application.candidate_current_title}
        </p>
      )}
    </div>
  )
}
