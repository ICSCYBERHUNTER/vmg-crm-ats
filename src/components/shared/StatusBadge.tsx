import { Badge } from '@/components/ui/badge'
import type { CandidateStatus } from '@/types/database'

interface StatusBadgeProps {
  status: CandidateStatus
}

const statusConfig: Record<CandidateStatus, { label: string; bg: string; color: string }> = {
  active: {
    label: 'Active',
    bg: '#0c2e1c',
    color: '#34d399',
  },
  passive: {
    label: 'Passive',
    bg: '#1e293b',
    color: '#60a5fa',
  },
  placed: {
    label: 'Placed',
    bg: '#2a1f0d',
    color: '#fbbf24',
  },
  do_not_contact: {
    label: 'Do Not Contact',
    bg: '#2d1215',
    color: '#f87171',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </Badge>
  )
}
