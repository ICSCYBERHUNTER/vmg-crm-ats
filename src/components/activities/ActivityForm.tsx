'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from '@/lib/utils/labels'
import { createActivity } from '@/lib/supabase/activities'
import type { ActivityEntityType, ActivityType } from '@/types/database'

interface ActivityFormProps {
  entityType: ActivityEntityType
  entityId: string
  onActivityAdded: () => void
}

export function ActivityForm({ entityType, entityId, onActivityAdded }: ActivityFormProps) {
  const [activityType, setActivityType] = useState<ActivityType>('phone_call')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [activityDate, setActivityDate] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })

  const today = new Date()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return

    setServerError(null)
    setSubmitting(true)
    try {
      await createActivity({
        entity_type: entityType,
        entity_id: entityId,
        activity_type: activityType,
        description: description.trim(),
        activity_date: activityDate.toISOString(),
        is_private: isPrivate,
      })
      setDescription('')
      setIsPrivate(false)
      setActivityType('phone_call')
      const now = new Date()
      setActivityDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      onActivityAdded()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to log activity.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="activity-description">Log Activity</Label>
        <Textarea
          id="activity-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the activity..."
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={activityType}
            onValueChange={(v) => setActivityType(v as ActivityType)}
          >
            <SelectTrigger className="w-[180px]">
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
        </div>

        <div className="space-y-1.5">
          <Label>Date</Label>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger
              className={cn(
                'flex h-9 w-[148px] items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              {format(activityDate, 'MMM d, yyyy')}
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={activityDate}
                onSelect={(date) => {
                  if (date) {
                    setActivityDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))
                  }
                  setDatePickerOpen(false)
                }}
                disabled={(date) => date > today}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Private
        </label>

        <Button type="submit" disabled={submitting || !description.trim()} className="ml-auto">
          {submitting ? 'Logging...' : 'Log Activity'}
        </Button>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}
    </form>
  )
}
