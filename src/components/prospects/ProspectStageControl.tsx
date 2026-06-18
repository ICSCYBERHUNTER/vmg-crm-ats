'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { PipelineStageBadge } from '@/components/shared/PipelineStageBadge'
import { updateCompany } from '@/lib/supabase/companies-client'
import { PROSPECT_STAGE_LABELS } from '@/lib/utils/labels'
import type { ProspectPipelineStage } from '@/types/database'
import { cn } from '@/lib/utils'

const STAGE_OPTIONS: ProspectPipelineStage[] = [
  'researching',
  'targeted',
  'contacted',
  'negotiating_fee',
  'closed',
]

// Inline stage picker for the Prospects worklist. Updating prospect_stage fires
// the track_prospect_stage_change DB trigger, which records history and resets
// prospect_stage_entered_at — so this control just writes the new stage.
export function ProspectStageControl({
  companyId,
  stage,
}: {
  companyId: string
  stage: ProspectPipelineStage | null
}) {
  const [open, setOpen] = useState(false)
  const [optimisticStage, setOptimisticStage] = useState(stage)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSelect = async (next: ProspectPipelineStage) => {
    if (next === optimisticStage) {
      setOpen(false)
      return
    }
    const previous = optimisticStage
    setOptimisticStage(next)
    setOpen(false)
    try {
      await updateCompany(companyId, { prospect_stage: next })
      startTransition(() => router.refresh())
      toast.success(`Moved to ${PROSPECT_STAGE_LABELS[next]}`)
    } catch (err) {
      setOptimisticStage(previous)
      toast.error(`Failed to move stage: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'cursor-pointer rounded-md transition-opacity hover:opacity-80',
          isPending && 'opacity-50'
        )}
        disabled={isPending}
        aria-label="Change stage"
      >
        {optimisticStage ? (
          <PipelineStageBadge stage={optimisticStage} />
        ) : (
          <span className="text-sm text-muted-foreground">Set stage</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col">
          {STAGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelect(opt)}
              className="flex items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm cursor-pointer hover:bg-accent"
            >
              <span>{PROSPECT_STAGE_LABELS[opt]}</span>
              {optimisticStage === opt && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
