'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/shared/DatePicker'
import { createFollowUp } from '@/lib/supabase/follow-ups'

// Quick "Add task" on a prospect card. Creates a company follow-up, which the
// worklist reads as that prospect's "next step" -- so adding one here clears the
// "No next step" flag and re-sorts the card on refresh.
export function ProspectAddTask({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function handleAdd() {
    if (!title.trim() || !dueDate || submitting) return
    setSubmitting(true)
    try {
      await createFollowUp({
        entity_type: 'company',
        entity_id: companyId,
        title: title.trim(),
        due_date: format(dueDate, 'yyyy-MM-dd'),
      })
      setTitle('')
      setDueDate(undefined)
      setOpen(false)
      toast.success('Task added')
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(`Failed to add task: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Add task"
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        Add task
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Task title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
            className="h-8 text-sm"
            autoFocus
          />
          <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date" />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!title.trim() || !dueDate || submitting}
            className="h-8"
          >
            Add task
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
