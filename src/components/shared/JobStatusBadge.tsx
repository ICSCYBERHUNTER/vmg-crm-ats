import { Badge } from '@/components/ui/badge'
import type { JobStatus } from '@/types/database'
import { JOB_STATUS_LABELS } from '@/lib/utils/labels'

const config: Record<JobStatus, { bg: string; color: string }> = {
  open:      { bg: '#0d2b1a', color: '#4ade80' },
  on_hold:   { bg: '#2d2000', color: '#fbbf24' },
  filled:    { bg: '#0d1f38', color: '#60a5fa' },
  cancelled: { bg: '#1e1e24', color: '#94a3b8' },
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { bg, color } = config[status]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {JOB_STATUS_LABELS[status]}
    </Badge>
  )
}
