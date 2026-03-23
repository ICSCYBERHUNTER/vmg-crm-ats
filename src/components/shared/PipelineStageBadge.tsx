import { Badge } from '@/components/ui/badge'
import type { ProspectPipelineStage } from '@/types/database'
import { PROSPECT_STAGE_LABELS } from '@/lib/utils/labels'

const config: Record<ProspectPipelineStage, { bg: string; color: string }> = {
  researching:     { bg: '#1e1636', color: '#c084fc' },
  targeted:        { bg: '#1e293b', color: '#94a3b8' },
  contacted:       { bg: '#172554', color: '#60a5fa' },
  negotiating_fee: { bg: '#2a1f0d', color: '#fbbf24' },
  closed:          { bg: '#0c2e1c', color: '#34d399' },
}

export function PipelineStageBadge({ stage }: { stage: ProspectPipelineStage }) {
  const { bg, color } = config[stage]
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {PROSPECT_STAGE_LABELS[stage]}
    </Badge>
  )
}
