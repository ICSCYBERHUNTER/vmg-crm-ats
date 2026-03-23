'use client'

// Inline "quick create" dialog for adding a new hiring manager contact
// without leaving the Job Opening form.

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createContact } from '@/lib/supabase/contacts-client'
import type { ContactType } from '@/types/database'

const CONTACT_TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: 'decision_maker', label: 'Decision Maker' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'champion', label: 'Champion' },
  { value: 'gatekeeper', label: 'Gatekeeper' },
  { value: 'other', label: 'Other' },
]

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  title: z.string(),
  email: z.string().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: 'Invalid email address' }
  ),
  phone: z.string(),
  contact_type: z.enum(['decision_maker', 'hiring_manager', 'hr', 'champion', 'gatekeeper', 'other'] as const),
})

type FormValues = z.infer<typeof schema>

export interface CreateContactFromJobDialogProps {
  companyId: string
  companyName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactCreated: (contact: {
    id: string
    first_name: string
    last_name: string
    title: string | null
  }) => void
}

export function CreateContactFromJobDialog({
  companyId,
  companyName,
  open,
  onOpenChange,
  onContactCreated,
}: CreateContactFromJobDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '',
      last_name: '',
      title: '',
      email: '',
      phone: '',
      contact_type: 'hiring_manager',
    },
  })

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset()
      setServerError(null)
    }
    onOpenChange(nextOpen)
  }

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      const created = await createContact(companyId, {
        first_name: values.first_name,
        last_name: values.last_name,
        title: values.title || null,
        email: values.email || null,
        phone: values.phone || null,
        contact_type: values.contact_type,
      })
      onContactCreated({
        id: created.id,
        first_name: created.first_name,
        last_name: created.last_name,
        title: created.title,
      })
      reset()
      onOpenChange(false)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create contact.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Company — read-only */}
          <div className="space-y-1.5">
            <Label>Company</Label>
            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {companyName}
            </p>
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input {...register('first_name')} placeholder="Jane" />
              {errors.first_name && (
                <p className="text-xs text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Last Name *</Label>
              <Input {...register('last_name')} placeholder="Smith" />
              {errors.last_name && (
                <p className="text-xs text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input {...register('title')} placeholder="VP of Engineering" />
          </div>

          {/* Contact Type */}
          <div className="space-y-1.5">
            <Label>Contact Type</Label>
            <Controller
              name="contact_type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register('email')} type="email" placeholder="jane@company.com" />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register('phone')} placeholder="555-1234" />
            </div>
          </div>

          {serverError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
