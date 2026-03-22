import { Badge } from '@/components/ui/badge'
import type { CompanyStatus } from '@/types/database'
import { COMPANY_STATUS_LABELS } from '@/lib/utils/labels'

const config: Record<CompanyStatus, { bg: string; color: string }> = {
  prospect:      { bg: '#1e293b', color: '#60a5fa' },
  client:        { bg: '#0c2e1c', color: '#34d399' },
  former_client: { bg: '#2d1215', color: '#f87171' },
  inactive:      { bg: '#1c1c1f', color: '#71717a' },
}

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  const { bg, color } = config[status]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {COMPANY_STATUS_LABELS[status]}
    </Badge>
  )
}
