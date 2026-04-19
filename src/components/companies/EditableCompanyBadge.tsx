'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { DispositionBadge } from '@/components/shared/DispositionBadge'
import { updateCompany } from '@/lib/supabase/companies-client'
import { PRIORITY_LABELS, DISPOSITION_LABELS } from '@/lib/utils/labels'
import type { Priority, CompanyDisposition } from '@/types/database'
import { cn } from '@/lib/utils'

const PRIORITY_OPTIONS: Priority[] = ['high', 'medium', 'low']
const DISPOSITION_OPTIONS: CompanyDisposition[] = [
  'active',
  'on_hold',
  'not_a_fit',
  'future_target',
  'no_terms_reached',
]

type Props =
  | { companyId: string; field: 'priority'; value: Priority | null }
  | { companyId: string; field: 'disposition'; value: CompanyDisposition | null }

export function EditableCompanyBadge(props: Props) {
  const { companyId, field, value } = props
  const [open, setOpen] = useState(false)
  const [optimisticValue, setOptimisticValue] = useState(value)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const options = field === 'priority' ? PRIORITY_OPTIONS : DISPOSITION_OPTIONS
  const labels = field === 'priority' ? PRIORITY_LABELS : DISPOSITION_LABELS

  const handleSelect = async (newValue: string) => {
    if (newValue === optimisticValue) {
      setOpen(false)
      return
    }

    const previousValue = optimisticValue
    setOptimisticValue(newValue as Priority & CompanyDisposition)
    setOpen(false)

    try {
      await updateCompany(companyId, { [field]: newValue })
      startTransition(() => {
        router.refresh()
      })
      toast.success(`${field === 'priority' ? 'Priority' : 'Disposition'} updated`)
    } catch (err) {
      setOptimisticValue(previousValue)
      toast.error(
        `Failed to update ${field}: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  const renderBadge = () => {
    if (field === 'priority') {
      return optimisticValue ? (
        <PriorityBadge priority={optimisticValue as Priority} />
      ) : (
        <span className="text-sm text-muted-foreground">Set priority</span>
      )
    }
    return optimisticValue ? (
      <DispositionBadge disposition={optimisticValue as CompanyDisposition} />
    ) : (
      <span className="text-sm text-muted-foreground">Set disposition</span>
    )
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
        aria-label={`Edit ${field}`}
      >
        {renderBadge()}
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          {options.map((opt) => (
            <div
              key={opt}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(opt)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSelect(opt)
                }
              }}
              className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
            >
              <span>{labels[opt]}</span>
              {optimisticValue === opt && <Check className="h-4 w-4" />}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
