'use client'

// Form field sections for CandidateForm.
// Each section receives the react-hook-form object as a prop and renders
// its own fields. Splitting this out keeps CandidateForm.tsx under 200 lines.

import { Controller, type UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CANDIDATE_CATEGORIES, CANDIDATE_SOURCES, SENIORITY_LEVELS, type CandidateFormValues } from '@/lib/validations/candidate'
import { CATEGORY_LABELS, SENIORITY_LEVEL_LABELS } from '@/lib/utils/labels'

type F = UseFormReturn<CandidateFormValues>

// Small helper: wraps a label, an input, and an inline error message.
function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── Section 1: Contact Info ─────────────────────────────────────────────────

export function ContactSection({ form }: { form: F }) {
  const { register, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="First Name *" error={errors.first_name?.message}>
        <Input {...register('first_name')} placeholder="Jane" />
      </Field>
      <Field label="Last Name *" error={errors.last_name?.message}>
        <Input {...register('last_name')} placeholder="Smith" />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input {...register('email')} type="email" placeholder="jane@example.com" />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input {...register('phone')} placeholder="555-867-5309" />
      </Field>
      <Field label="LinkedIn URL" error={errors.linkedin_url?.message} >
        <Input {...register('linkedin_url')} placeholder="https://linkedin.com/in/..." className="sm:col-span-2" />
      </Field>
    </div>
  )
}

// ─── Section 2: Professional Info ────────────────────────────────────────────

export function ProfessionalSection({ form }: { form: F }) {
  const { register, control, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Current Title" error={errors.current_title?.message}>
        <Input {...register('current_title')} placeholder="Account Executive" />
      </Field>
      <Field label="Current Company" error={errors.current_company?.message}>
        <Input {...register('current_company')} placeholder="Acme Corp" />
      </Field>
      <Field label="Category" error={errors.category?.message}>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {CANDIDATE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Seniority Level" error={errors.seniority_level?.message}>
        <Controller
          name="seniority_level"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger><SelectValue placeholder="Select seniority..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {SENIORITY_LEVELS.map((s) => (
                  <SelectItem key={s} value={s}>{SENIORITY_LEVEL_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Years of Experience" error={errors.years_experience?.message}>
        <Input {...register('years_experience')} type="number" min={0} placeholder="5" />
      </Field>
      <Field label="Skills" error={errors.skills?.message}>
        <Textarea
          {...register('skills')}
          placeholder="OT protocols, Purdue Model, network segmentation..."
          className="sm:col-span-2 resize-none"
          rows={3}
        />
      </Field>
    </div>
  )
}

// ─── Section 3: Compensation ──────────────────────────────────────────────────

export function CompensationSection({ form }: { form: F }) {
  const { register, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Current Compensation ($)" error={errors.current_compensation?.message}>
        <Input {...register('current_compensation')} type="number" min={0} placeholder="120000" />
      </Field>
      <Field label="Desired Compensation ($)" error={errors.desired_compensation?.message}>
        <Input {...register('desired_compensation')} type="number" min={0} placeholder="145000" />
      </Field>
    </div>
  )
}

// ─── Section 4: Location ──────────────────────────────────────────────────────

export function LocationSection({ form }: { form: F }) {
  const { register, control, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="City" error={errors.location_city?.message}>
        <Input {...register('location_city')} placeholder="Austin" />
      </Field>
      <Field label="State" error={errors.location_state?.message}>
        <Input {...register('location_state')} placeholder="TX" />
      </Field>
      <Field label="Country" error={errors.location_country?.message}>
        <Input {...register('location_country')} placeholder="USA" />
      </Field>
      <Field label="Willing to Relocate" error={errors.willing_to_relocate?.message}>
        <Controller
          name="willing_to_relocate"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="flexible">Flexible</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Relocation Preferences" error={errors.relocation_preferences?.message}>
        <Textarea
          {...register('relocation_preferences')}
          placeholder="Open to Southeast US only..."
          className="sm:col-span-2 resize-none"
          rows={2}
        />
      </Field>
    </div>
  )
}

// ─── Section 5: Recruiting ────────────────────────────────────────────────────

export function RecruitingSection({ form }: { form: F }) {
  const { control, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Status *" error={errors.status?.message}>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="passive">Passive</SelectItem>
                <SelectItem value="placed">Placed</SelectItem>
                <SelectItem value="do_not_contact">Do Not Contact</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Source" error={errors.source?.message}>
        <Controller
          name="source"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {CANDIDATE_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
    </div>
  )
}
