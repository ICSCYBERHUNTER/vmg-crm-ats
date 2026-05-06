'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CandidateApplication } from '@/types/database'

interface KanbanCardProps {
  application: CandidateApplication
  isOverlay?: boolean
  onRemove?: (application: CandidateApplication) => void
  accentColor?: string
  isFirstStage?: boolean
  onContactedToggle?: (applicationId: string) => void
  onRankChange?: (applicationId: string) => void
}

export function KanbanCard({ application, isOverlay, onRemove, accentColor, isFirstStage, onContactedToggle, onRankChange }: KanbanCardProps) {
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
      onDoubleClick={() => window.open(`/candidates/${application.candidate_id}`, '_blank')}
      title="Double-click to open candidate in new tab"
      className={cn(
        'group relative rounded-md border border-border bg-card pt-6 px-2 pb-2 cursor-grab active:cursor-grabbing shadow-sm',
        isDragging && 'opacity-30',
        isOverlay && 'shadow-lg border-primary/50 rotate-2',
      )}
    >
      {/* Remove button — hover only, left of rank widget */}
      {onRemove && !isOverlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(application)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1 right-7 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/80"
          title="Remove from pipeline"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Rank widget — always visible, cycles null→1→2→3→4→5→null */}
      {onRankChange && !isOverlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRankChange(application.id)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'absolute top-1 right-1 flex items-center justify-center h-5 w-5 rounded-sm text-xs font-semibold transition-colors',
            application.rank
              ? 'bg-primary/20 text-primary'
              : 'border border-dashed border-muted-foreground/40 text-muted-foreground/60 hover:border-muted-foreground hover:text-muted-foreground'
          )}
          title={
            application.rank
              ? `Rank: ${application.rank} — click to cycle`
              : 'Click to set rank (1-5)'
          }
        >
          {application.rank ?? ''}
        </button>
      )}

      {/* Contacted checkbox — only visible in first stage */}
      {onContactedToggle && isFirstStage && !isOverlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onContactedToggle(application.id)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'absolute top-1 left-1 flex items-center justify-center h-4 w-4 rounded-sm border transition-colors',
            application.contacted_at
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground/40 hover:border-muted-foreground bg-transparent'
          )}
          title={application.contacted_at ? 'Contacted — click to clear' : 'Mark contacted'}
        >
          {application.contacted_at && <Check className="h-3 w-3" />}
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
