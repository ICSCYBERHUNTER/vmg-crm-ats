import { Badge } from '@/components/ui/badge'
import type { InfluenceLevel } from '@/types/database'
import { INFLUENCE_LEVEL_LABELS } from '@/lib/utils/labels'

const config: Record<InfluenceLevel, { bg: string; color: string }> = {
  high:   { bg: '#2d1215', color: '#f87171' },
  medium: { bg: '#2a1f0d', color: '#fbbf24' },
  low:    { bg: '#1e293b', color: '#94a3b8' },
}

export function InfluenceBadge({ level }: { level: InfluenceLevel }) {
  const { bg, color } = config[level]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {INFLUENCE_LEVEL_LABELS[level]}
    </Badge>
  )
}
