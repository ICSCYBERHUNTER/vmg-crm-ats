'use client'

import { MoreHorizontal } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CandidateLinkingSection } from './CandidateLinkingSection'
import { DeleteCandidateButton } from './DeleteCandidateButton'

interface CandidateMoreActionsMenuProps {
  candidateId: string
  candidateName: string
  linkedContactId: string | null
}

export function CandidateMoreActionsMenu({
  candidateId,
  candidateName,
  linkedContactId,
}: CandidateMoreActionsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
          <MoreHorizontal className="h-4 w-4" />
          More Actions
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        {!linkedContactId && (
          <CandidateLinkingSection
            candidateId={candidateId}
            candidateName={candidateName}
            linkedContactId={null}
            triggerVariant="menu-item"
          />
        )}
        <DeleteCandidateButton
          id={candidateId}
          name={candidateName}
          renderAsMenuItem
        />
      </PopoverContent>
    </Popover>
  )
}
