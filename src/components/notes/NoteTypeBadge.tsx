import { Badge } from '@/components/ui/badge'
import type { NoteType } from '@/types/database'
import { NOTE_TYPE_LABELS } from '@/lib/validations/note'

const typeConfig: Record<NoteType, { bg: string; color: string }> = {
  general:            { bg: '#1c1c1f', color: '#8a8a95' },
  phone_call:         { bg: '#1e293b', color: '#60a5fa' },
  email:              { bg: '#0c2e1c', color: '#34d399' },
  interview_feedback: { bg: '#1e1636', color: '#a78bfa' },
  insight:            { bg: '#2a1f0d', color: '#fbbf24' },
  interview_prep:     { bg: '#0d2a1f', color: '#2dd4bf' },
}

export function NoteTypeBadge({ noteType }: { noteType: NoteType }) {
  const config = typeConfig[noteType]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {NOTE_TYPE_LABELS[noteType]}
    </Badge>
  )
}
