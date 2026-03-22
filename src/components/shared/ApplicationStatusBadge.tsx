import { Badge } from '@/components/ui/badge'
import type { ApplicationStatus } from '@/types/database'
import { APPLICATION_STATUS_LABELS } from '@/lib/utils/labels'

const config: Record<ApplicationStatus, { bg: string; color: string }> = {
  active:    { bg: '#0d2b1a', color: '#4ade80' },
  rejected:  { bg: '#2d0d0d', color: '#f87171' },
  withdrawn: { bg: '#1e1e24', color: '#94a3b8' },
  placed:    { bg: '#0d1f38', color: '#60a5fa' },
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { bg, color } = config[status]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {APPLICATION_STATUS_LABELS[status]}
    </Badge>
  )
}
