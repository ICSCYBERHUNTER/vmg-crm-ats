import { Badge } from '@/components/ui/badge'
import type { CandidateStatus } from '@/types/database'

interface StatusBadgeProps {
  status: CandidateStatus
}

const statusConfig: Record<CandidateStatus, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  passive: {
    label: 'Passive',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  },
  placed: {
    label: 'Placed',
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
  do_not_contact: {
    label: 'Do Not Contact',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}
