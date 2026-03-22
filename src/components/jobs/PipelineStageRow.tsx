'use client'

import { ArrowUp, ArrowDown, Check, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PipelineStage } from '@/types/database'

interface PipelineStageRowProps {
  stage: PipelineStage
  index: number
  isFirst: boolean
  isLast: boolean
  isEditing: boolean
  editingName: string
  onEditingNameChange: (value: string) => void
  onStartEditing: (stage: PipelineStage) => void
  onSaveEditing: () => void
  onCancelEditing: () => void
  onMove: (index: number, direction: 'up' | 'down') => void
  onDelete: (stage: PipelineStage) => void
}

export function PipelineStageRow({
  stage,
  index,
  isFirst,
  isLast,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEditing,
  onSaveEditing,
  onCancelEditing,
  onMove,
  onDelete,
}: PipelineStageRowProps) {
  return (
    <div
      className={`flex h-12 items-center gap-3 px-3 ${
        !isLast ? 'border-b border-border' : ''
      }`}
    >
      <span className="w-6 shrink-0 text-sm text-muted-foreground text-right">
        {index + 1}.
      </span>

      {isEditing ? (
        <Input
          value={editingName}
          onChange={e => onEditingNameChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onSaveEditing()
            if (e.key === 'Escape') onCancelEditing()
          }}
          className="h-8 flex-1"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm truncate">{stage.name}</span>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isFirst}
          onClick={() => onMove(index, 'up')}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isLast}
          onClick={() => onMove(index, 'down')}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>

        {isEditing ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onSaveEditing}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onCancelEditing}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onStartEditing(stage)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(stage)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
