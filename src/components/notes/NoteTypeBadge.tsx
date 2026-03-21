import { Badge } from '@/components/ui/badge'
import type { NoteType } from '@/types/database'
import { NOTE_TYPE_LABELS } from '@/lib/validations/note'

const typeConfig: Record<NoteType, string> = {
  general: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100',
  phone_call: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  email: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  interview_feedback: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100',
  insight: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
}

export function NoteTypeBadge({ noteType }: { noteType: NoteType }) {
  return (
    <Badge variant="outline" className={typeConfig[noteType]}>
      {NOTE_TYPE_LABELS[noteType]}
    </Badge>
  )
}
