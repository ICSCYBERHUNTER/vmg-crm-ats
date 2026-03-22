import { Badge } from '@/components/ui/badge'
import type { Priority } from '@/types/database'
import { PRIORITY_LABELS } from '@/lib/utils/labels'

const config: Record<Priority, { bg: string; color: string }> = {
  high:   { bg: '#2d1215', color: '#f87171' },
  medium: { bg: '#2a1f0d', color: '#fbbf24' },
  low:    { bg: '#1e293b', color: '#94a3b8' },
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { bg, color } = config[priority]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}
