'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { noteSchema, NOTE_TYPES, NOTE_TYPE_LABELS, type NoteFormValues } from '@/lib/validations/note'
import { createNote } from '@/lib/supabase/notes'
import type { NoteEntityType, NoteType } from '@/types/database'

interface NoteFormProps {
  entityType: NoteEntityType
  entityId: string
  onNoteAdded: () => void
}

export function NoteForm({ entityType, entityId, onNoteAdded }: NoteFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [contactDate, setContactDate] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      content: '',
      note_type: 'general',
      is_private: false,
    },
  })

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = form

  async function onSubmit(values: NoteFormValues) {
    setServerError(null)
    try {
      await createNote({
        entity_type: entityType,
        entity_id: entityId,
        content: values.content,
        note_type: values.note_type as NoteType,
        is_private: values.is_private,
        contactDate,
      })
      reset()
      const now = new Date()
      setContactDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      onNoteAdded()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to add note.')
    }
  }

  const today = new Date()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="note-content">Add a Note</Label>
        <Textarea
          id="note-content"
          {...register('content')}
          placeholder="Type your note here..."
          rows={3}
          className="resize-none"
        />
        {errors.content && (
          <p className="text-xs text-destructive">{errors.content.message}</p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Controller
            name="note_type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {NOTE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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
              {format(contactDate, 'MMM d, yyyy')}
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={contactDate}
                onSelect={(date) => {
                  if (date) {
                    setContactDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))
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
            {...register('is_private')}
            className="h-4 w-4 rounded border-gray-300"
          />
          Private
        </label>

        <Button type="submit" disabled={isSubmitting} className="ml-auto">
          {isSubmitting ? 'Adding...' : 'Add Note'}
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
