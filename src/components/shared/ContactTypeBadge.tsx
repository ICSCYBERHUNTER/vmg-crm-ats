import { Badge } from '@/components/ui/badge'
import type { ContactType } from '@/types/database'
import { CONTACT_TYPE_LABELS } from '@/lib/utils/labels'

const config: Record<ContactType, { bg: string; color: string }> = {
  decision_maker:  { bg: '#2d1215', color: '#f87171' },
  hiring_manager:  { bg: '#2a1f0d', color: '#fbbf24' },
  hr:              { bg: '#172554', color: '#60a5fa' },
  champion:        { bg: '#0c2e1c', color: '#34d399' },
  gatekeeper:      { bg: '#1c1c1f', color: '#71717a' },
  other:           { bg: '#1c1c1f', color: '#71717a' },
}

export function ContactTypeBadge({ contactType }: { contactType: ContactType }) {
  const { bg, color } = config[contactType]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {CONTACT_TYPE_LABELS[contactType]}
    </Badge>
  )
}
