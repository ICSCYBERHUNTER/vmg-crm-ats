import { Badge } from '@/components/ui/badge'
import type { JobSource } from '@/types/database'
import { JOB_SOURCE_LABELS } from '@/lib/utils/labels'

const config: Record<JobSource, { bg: string; color: string }> = {
  existing_client:  { bg: '#0d2b1a', color: '#4ade80' },
  repeat_business:  { bg: '#1a2b0d', color: '#86efac' },
  referral:         { bg: '#0d1f38', color: '#60a5fa' },
  inbound:          { bg: '#2d1215', color: '#f87171' },
  outreach:         { bg: '#2a1f0d', color: '#fbbf24' },
}

export function JobSourceBadge({ source }: { source: JobSource }) {
  const { bg, color } = config[source]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {JOB_SOURCE_LABELS[source]}
    </Badge>
  )
}
