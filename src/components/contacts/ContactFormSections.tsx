'use client'

// Form field sections for ContactForm.
// Each section receives the react-hook-form object as a prop.

import { Controller, type UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CONTACT_TYPES, INFLUENCE_LEVELS, type ContactFormValues } from '@/lib/validations/contact'
import { CONTACT_TYPE_LABELS, INFLUENCE_LEVEL_LABELS } from '@/lib/utils/labels'
import type { CompanyContactWithReportsTo } from '@/types/database'

type F = UseFormReturn<ContactFormValues>

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── Section 1: Basic Info ──────────────────────────────────────────────────

export function BasicInfoSection({ form }: { form: F }) {
  const { register, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="First Name *" error={errors.first_name?.message}>
        <Input {...register('first_name')} placeholder="John" />
      </Field>
      <Field label="Last Name *" error={errors.last_name?.message}>
        <Input {...register('last_name')} placeholder="Smith" />
      </Field>
      <Field label="Title" error={errors.title?.message}>
        <Input {...register('title')} placeholder="VP of Engineering" />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input {...register('email')} type="email" placeholder="john@example.com" />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input {...register('phone')} placeholder="555-867-5309" />
      </Field>
      <Field label="LinkedIn URL" error={errors.linkedin_url?.message}>
        <Input {...register('linkedin_url')} placeholder="https://linkedin.com/in/..." />
      </Field>
    </div>
  )
}

// ─── Section 2: Role & Influence ────────────────────────────────────────────

export function RoleSection({ form }: { form: F }) {
  const { control, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Contact Type" error={errors.contact_type?.message}>
        <Controller
          name="contact_type"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Influence Level" error={errors.influence_level?.message}>
        <Controller
          name="influence_level"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger><SelectValue placeholder="Select level..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {INFLUENCE_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{INFLUENCE_LEVEL_LABELS[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Controller
          name="is_primary"
          control={control}
          render={({ field }) => (
            <Checkbox
              id="is_primary"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <div>
          <Label htmlFor="is_primary" className="cursor-pointer">Primary Contact</Label>
          <p className="text-xs text-muted-foreground">
            Designate as the main point of contact at this company
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Section 3: Reporting Structure ─────────────────────────────────────────

interface ReportingSectionProps {
  form: F
  contacts: CompanyContactWithReportsTo[]
  currentContactId?: string
}

export function ReportingSection({ form, contacts, currentContactId }: ReportingSectionProps) {
  const { control, formState: { errors } } = form

  // Filter out the current contact (can't report to yourself)
  const options = contacts.filter((c) => c.id !== currentContactId)

  return (
    <div className="grid grid-cols-1 gap-4">
      <Field label="Reports To" error={errors.reports_to_id?.message}>
        <Controller
          name="reports_to_id"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger><SelectValue placeholder="Select manager..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}{c.title ? ` — ${c.title}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {options.length === 0 && (
          <p className="text-xs text-muted-foreground">No other contacts at this company yet.</p>
        )}
      </Field>
    </div>
  )
}
