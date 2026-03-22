import { Badge } from '@/components/ui/badge'
import type { LocationType } from '@/types/database'
import { LOCATION_TYPE_LABELS } from '@/lib/utils/labels'

const config: Record<LocationType, { bg: string; color: string }> = {
  onsite: { bg: '#1e293b', color: '#94a3b8' },
  remote: { bg: '#0d2b1a', color: '#4ade80' },
  hybrid: { bg: '#0d1f38', color: '#60a5fa' },
}

export function LocationTypeBadge({ locationType }: { locationType: LocationType }) {
  const { bg, color } = config[locationType]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {LOCATION_TYPE_LABELS[locationType]}
    </Badge>
  )
}
