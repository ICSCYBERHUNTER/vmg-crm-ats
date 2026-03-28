'use client'

// Form field sections for JobOpeningForm.
// Sections receive the react-hook-form object as a prop.

import { useState } from 'react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, AlertTriangle } from 'lucide-react'
import { DatePicker } from '@/components/shared/DatePicker'
import {
  JOB_STATUSES,
  LOCATION_TYPES,
  JOB_SOURCES,
  JOB_PRIORITIES,
  JOB_CATEGORIES,
  JOB_SENIORITY_LEVELS,
  type JobOpeningFormValues,
} from '@/lib/validations/job-opening'
import {
  JOB_STATUS_LABELS,
  LOCATION_TYPE_LABELS,
  JOB_SOURCE_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  SENIORITY_LEVEL_LABELS,
} from '@/lib/utils/labels'
import { US_STATES } from '@/lib/utils/us-states'
import { CreateContactFromJobDialog } from './CreateContactFromJobDialog'

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
  clientCompanies: { id: string; name: string; status: string }[]
  contacts: { id: string; first_name: string; last_name: string }[]
  onCompanyChange: (companyId: string) => void
  watchedCompanyId: string
  onContactCreated: (contact: { id: string; first_name: string; last_name: string; title: string | null }) => void
}

export function BasicInfoSection({
  form,
  clientCompanies,
  contacts,
  onCompanyChange,
  watchedCompanyId,
  onContactCreated,
}: BasicInfoSectionProps) {
  const { register, control, formState: { errors } } = form
  const [createContactOpen, setCreateContactOpen] = useState(false)

  const selectedCompany = clientCompanies.find((c) => c.id === watchedCompanyId)
  const selectedCompanyName = selectedCompany?.name ?? ''
  const isProspect = selectedCompany?.status === 'prospect'

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
                <SelectValue placeholder="Select company...">
                  {field.value
                    ? (clientCompanies.find((c) => c.id === field.value)?.name ?? '')
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clientCompanies.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No client or prospect companies found.
                  </div>
                ) : (
                  clientCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.status === 'prospect' && (
                        <span className="ml-1.5 text-xs text-amber-600">(Prospect)</span>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        {isProspect && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            No fee agreement — this company is still a Prospect
          </div>
        )}
      </Field>

      <div className="space-y-1.5">
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
        {watchedCompanyId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-xs text-primary hover:bg-transparent hover:underline"
            onClick={() => setCreateContactOpen(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add New Contact
          </Button>
        )}
      </div>

      <CreateContactFromJobDialog
        companyId={watchedCompanyId}
        companyName={selectedCompanyName}
        open={createContactOpen}
        onOpenChange={setCreateContactOpen}
        onContactCreated={(contact) => {
          onContactCreated(contact)
          setCreateContactOpen(false)
        }}
      />

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

      <Field label="Category" error={errors.category?.message}>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {JOB_CATEGORIES.map((c) => (
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
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Select seniority..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {JOB_SENIORITY_LEVELS.map((s) => (
                  <SelectItem key={s} value={s}>{SENIORITY_LEVEL_LABELS[s]}</SelectItem>
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
        <Controller
          control={control}
          name="next_step_due_date"
          render={({ field }) => (
            <DatePicker
              value={field.value ? new Date(field.value) : undefined}
              onChange={(date) => field.onChange(date ? date.toISOString().split('T')[0] : '')}
              placeholder="Pick a date"
            />
          )}
        />
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
