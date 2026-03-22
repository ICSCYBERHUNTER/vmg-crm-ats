'use client'

// Form field sections for JobOpeningForm.
// Sections receive the react-hook-form object as a prop.

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
import {
  JOB_STATUSES,
  LOCATION_TYPES,
  JOB_SOURCES,
  JOB_PRIORITIES,
  type JobOpeningFormValues,
} from '@/lib/validations/job-opening'
import {
  JOB_STATUS_LABELS,
  LOCATION_TYPE_LABELS,
  JOB_SOURCE_LABELS,
  PRIORITY_LABELS,
} from '@/lib/utils/labels'
import { US_STATES } from '@/lib/utils/us-states'

type F = UseFormReturn<JobOpeningFormValues>

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

// ─── Section 1: Basic Info ────────────────────────────────────────────────────

interface BasicInfoSectionProps {
  form: F
  clientCompanies: { id: string; name: string }[]
  contacts: { id: string; first_name: string; last_name: string }[]
  onCompanyChange: (companyId: string) => void
  watchedCompanyId: string
}

export function BasicInfoSection({
  form,
  clientCompanies,
  contacts,
  onCompanyChange,
  watchedCompanyId,
}: BasicInfoSectionProps) {
  const { register, control, formState: { errors } } = form

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Title *" error={errors.title?.message}>
        <Input {...register('title')} placeholder="OT Security Engineer" />
      </Field>

      <Field label="Company *" error={errors.company_id?.message}>
        <Controller
          name="company_id"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(val) => {
                field.onChange(val)
                onCompanyChange(val ?? '')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client company...">
                  {field.value
                    ? (clientCompanies.find((c) => c.id === field.value)?.name ?? '')
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clientCompanies.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No client companies found. A company must have &apos;Client&apos; status to create job openings.
                  </div>
                ) : (
                  clientCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <Field label="Hiring Manager" error={errors.hiring_manager_id?.message}>
        <Controller
          name="hiring_manager_id"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={field.onChange}
              disabled={!watchedCompanyId}
            >
              <SelectTrigger>
                <SelectValue placeholder={watchedCompanyId ? 'Select contact...' : 'Select a company first'}>
                  {field.value
                    ? (() => {
                        const c = contacts.find((ct) => ct.id === field.value)
                        return c ? `${c.last_name}, ${c.first_name}` : undefined
                      })()
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.last_name}, {c.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <Field label="Status *" error={errors.status?.message}>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOB_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{JOB_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <Field label="Priority" error={errors.priority?.message}>
        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Select priority..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {JOB_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
    </div>
  )
}

// ─── Section 2: Job Description ───────────────────────────────────────────────

export function DescriptionSection({ form }: { form: F }) {
  const { register, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4">
      <Field label="Description" error={errors.description?.message}>
        <Textarea
          {...register('description')}
          placeholder="Role overview, responsibilities, team context..."
          className="resize-none"
          rows={6}
        />
      </Field>
      <Field label="Requirements" error={errors.requirements?.message}>
        <Textarea
          {...register('requirements')}
          placeholder="Required skills, experience, certifications..."
          className="resize-none"
          rows={6}
        />
      </Field>
    </div>
  )
}

// ─── Section 3: Location & Logistics ─────────────────────────────────────────

export function LocationSection({ form }: { form: F }) {
  const { register, control, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Location Type" error={errors.location_type?.message}>
        <Controller
          name="location_type"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {LOCATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{LOCATION_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <Field label="Travel %" error={errors.travel_percentage?.message} hint="Enter 0–100">
        <div className="flex items-center gap-2">
          <Input
            {...register('travel_percentage')}
            type="number"
            min={0}
            max={100}
            placeholder="0"
            className="w-full"
          />
          <span className="text-sm text-muted-foreground shrink-0">%</span>
        </div>
      </Field>

      <Field label="City" error={errors.location_city?.message}>
        <Input {...register('location_city')} placeholder="Houston" />
      </Field>

      <Field label="State" error={errors.location_state?.message}>
        <Controller
          name="location_state"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="— Select —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
    </div>
  )
}

// ─── Section 4: Compensation & Fees ──────────────────────────────────────────

export function CompensationSection({ form }: { form: F }) {
  const { register, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="Comp Range Low"
        hint="Annual base salary"
        error={errors.comp_range_low?.message}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">$</span>
          <Input
            {...register('comp_range_low')}
            type="number"
            min={0}
            placeholder="85000"
          />
        </div>
      </Field>

      <Field
        label="Comp Range High"
        hint="Annual base salary"
        error={errors.comp_range_high?.message}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">$</span>
          <Input
            {...register('comp_range_high')}
            type="number"
            min={0}
            placeholder="150000"
          />
        </div>
      </Field>

      <Field
        label="Fee Override %"
        hint="Leave blank to use company's default fee agreement"
        error={errors.fee_percentage_override?.message}
      >
        <Input
          {...register('fee_percentage_override')}
          type="number"
          min={0}
          max={100}
          step={0.01}
          placeholder="20"
        />
      </Field>
    </div>
  )
}

// ─── Section 5: Tracking ──────────────────────────────────────────────────────

export function TrackingSection({ form }: { form: F }) {
  const { register, control, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Source" error={errors.source?.message}>
        <Controller
          name="source"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {JOB_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{JOB_SOURCE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <Field label="Next Step Due Date" error={errors.next_step_due_date?.message}>
        <Input {...register('next_step_due_date')} type="date" />
      </Field>

      <Field label="Next Step" error={errors.next_step?.message}>
        <Input
          {...register('next_step')}
          placeholder="E.g., Send job description, Schedule screening call"
          className="col-span-2"
        />
      </Field>
    </div>
  )
}
