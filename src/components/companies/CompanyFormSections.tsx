'use client'

// Form field sections for CompanyForm.
// Sections receive the react-hook-form object as a prop.
// Splitting keeps CompanyForm.tsx under 200 lines.

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
  COMPANY_TYPES,
  COMPANY_SOURCES,
  PRIORITIES,
  PROSPECT_STAGES,
  DISPOSITIONS,
  type CompanyFormValues,
} from '@/lib/validations/company'
import { US_STATES } from '@/lib/utils/us-states'
import {
  COMPANY_TYPE_LABELS,
  COMPANY_SOURCE_LABELS,
  PRIORITY_LABELS,
  PROSPECT_STAGE_LABELS,
  DISPOSITION_LABELS,
} from '@/lib/utils/labels'

type F = UseFormReturn<CompanyFormValues>

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

export function BasicInfoSection({ form }: { form: F }) {
  const { register, control, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Company Name *" error={errors.name?.message}>
        <Input {...register('name')} placeholder="Dragos Inc." />
      </Field>
      <Field
        label="Domain / Website"
        hint="Enter URL — we'll extract the domain automatically"
        error={errors.domain?.message}
      >
        <Input {...register('domain')} placeholder="https://www.dragos.com" />
      </Field>
      <Field label="Company Type" error={errors.company_type?.message}>
        <Controller
          name="company_type"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {COMPANY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{COMPANY_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Industry" error={errors.industry?.message}>
        <Input {...register('industry')} placeholder="OT / ICS Security" />
      </Field>
    </div>
  )
}

// ─── Section 2: Location ──────────────────────────────────────────────────────

export function LocationSection({ form }: { form: F }) {
  const { register, control, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Field label="City" error={errors.hq_city?.message}>
        <Input {...register('hq_city')} placeholder="Houston" />
      </Field>
      <Field label="State" error={errors.hq_state?.message}>
        <Controller
          name="hq_state"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
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
      <Field label="Country" error={errors.hq_country?.message}>
        <Input {...register('hq_country')} placeholder="US" />
      </Field>
    </div>
  )
}

// ─── Section 3: Business Development ─────────────────────────────────────────

export function BizDevSection({ form }: { form: F }) {
  const { register, control, formState: { errors } } = form
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Priority" error={errors.priority?.message}>
        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger><SelectValue placeholder="Select priority..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
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
                {COMPANY_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{COMPANY_SOURCE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Why Target" error={errors.why_target?.message}>
        <Textarea
          {...register('why_target')}
          placeholder="Why are we targeting this company? E.g., Recently hired ICS Security Lead, using competitor, recently funded"
          className="col-span-2 resize-none"
          rows={3}
        />
      </Field>
      <Field label="Next Step" error={errors.next_step?.message}>
        <Input
          {...register('next_step')}
          placeholder="E.g., Identify decision maker, Send intro email, Schedule call"
        />
      </Field>
      <Field label="Next Step Due Date" error={errors.next_step_due_date?.message}>
        <Input {...register('next_step_due_date')} type="date" />
      </Field>
    </div>
  )
}

// ─── Section 4: Status & Pipeline ────────────────────────────────────────────
// watchedStatus is passed from CompanyForm so conditional visibility is
// controlled by the parent without duplicating watch() calls.

interface StatusSectionProps {
  form: F
  watchedStatus: string
  onStatusChange: (newStatus: string) => void
  onProspectStageChange: (newStage: string) => void
}

export function StatusSection({
  form,
  watchedStatus,
  onStatusChange,
  onProspectStageChange,
}: StatusSectionProps) {
  const { register, control, formState: { errors } } = form
  const isProspect = watchedStatus === 'prospect'
  const isClient = watchedStatus === 'client'

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Status *" error={errors.status?.message}>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val) => {
                field.onChange(val)
                onStatusChange(val ?? '')
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="former_client">Former Client</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      {isProspect && (
        <Field label="Pipeline Stage" error={errors.prospect_stage?.message}>
          <Controller
            name="prospect_stage"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={(val) => {
                  field.onChange(val)
                  onProspectStageChange(val ?? '')
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select stage..." /></SelectTrigger>
                <SelectContent>
                  {PROSPECT_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{PROSPECT_STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      )}

      {isProspect && (
        <Field label="Disposition" error={errors.disposition?.message}>
          <Controller
            name="disposition"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                <SelectTrigger><SelectValue placeholder="Select disposition..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {DISPOSITIONS.map((d) => (
                    <SelectItem key={d} value={d}>{DISPOSITION_LABELS[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      )}

      {isClient && (
        <Field label="Fee Agreement (%)" error={errors.fee_agreement_pct?.message}>
          <Input
            {...register('fee_agreement_pct')}
            type="number"
            min={0}
            max={100}
            step={0.01}
            placeholder="20"
          />
        </Field>
      )}
    </div>
  )
}
