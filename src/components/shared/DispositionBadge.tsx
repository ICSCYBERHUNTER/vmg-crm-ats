import { Badge } from '@/components/ui/badge'
import type { CompanyDisposition } from '@/types/database'
import { DISPOSITION_LABELS } from '@/lib/utils/labels'

const config: Record<CompanyDisposition, { bg: string; color: string }> = {
  active:           { bg: '#0c2e1c', color: '#34d399' },
  on_hold:          { bg: '#2a1f0d', color: '#fbbf24' },
  not_a_fit:        { bg: '#2d1215', color: '#f87171' },
  future_target:    { bg: '#172554', color: '#60a5fa' },
  no_terms_reached: { bg: '#1c1c1f', color: '#71717a' },
}

export function DispositionBadge({ disposition }: { disposition: CompanyDisposition }) {
  const { bg, color } = config[disposition]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {DISPOSITION_LABELS[disposition]}
    </Badge>
  )
}
