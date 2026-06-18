'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessageSquarePlus } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from '@/lib/utils/labels'
import { createActivity } from '@/lib/supabase/activities'
import type { ActivityType } from '@/types/database'

// Quick "Log a touch" on a prospect card. Records an activity on the company,
// which (via createActivity) updates last_contacted_at and auto-advances a
// researching/targeted prospect to Contacted -- so the card's "Never contacted"
// flag clears and it re-sorts on refresh.
export function ProspectLogTouch({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)
  const [activityType, setActivityType] = useState<ActivityType>('phone_call')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function handleLog() {
    if (!description.trim() || submitting) return
    setSubmitting(true)
    try {
      await createActivity({
        entity_type: 'company',
        entity_id: companyId,
        activity_type: activityType,
        description: description.trim(),
        activity_date: new Date().toISOString(),
      })
      setDescription('')
      setActivityType('phone_call')
      setOpen(false)
      toast.success('Touch logged')
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(`Failed to log touch: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Log a touch"
      >
        <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
        Log touch
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-2">
          <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ACTIVITY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? (e.g. left voicemail)"
            rows={2}
            className="resize-none text-sm"
            autoFocus
          />
          <Button size="sm" onClick={handleLog} disabled={!description.trim() || submitting} className="h-8">
            {submitting ? 'Logging...' : 'Log touch'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
