'use client'

// Works for both create (no job prop) and edit (job prop provided).
// On create: redirects to the new job's detail page.
// On edit:   redirects back to the job's detail page.

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { jobOpeningSchema, type JobOpeningFormValues } from '@/lib/validations/job-opening'
import {
  createJobOpening,
  updateJobOpening,
  fetchClientCompanies,
  fetchCompanyContacts,
} from '@/lib/supabase/job-openings'
import type { JobOpening, JobStatus, LocationType, JobSource, Priority } from '@/types/database'
import {
  BasicInfoSection,
  DescriptionSection,
  LocationSection,
  CompensationSection,
  TrackingSection,
} from './JobOpeningFormSections'

interface JobOpeningFormProps {
  job?: JobOpening
}

export function JobOpeningForm({ job }: JobOpeningFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [clientCompanies, setClientCompanies] = useState<{ id: string; name: string }[]>([])
  const [contacts, setContacts] = useState<{ id: string; first_name: string; last_name: string }[]>([])

  const form = useForm<JobOpeningFormValues>({
    resolver: zodResolver(jobOpeningSchema),
    defaultValues: job
      ? {
          title: job.title,
          company_id: job.company_id,
          hiring_manager_id: job.hiring_manager_id ?? '',
          status: job.status,
          priority: job.priority ?? '',
          description: job.description ?? '',
          requirements: job.requirements ?? '',
          location_type: job.location_type ?? '',
          location_city: job.location_city ?? '',
          location_state: job.location_state ?? '',
          travel_percentage: job.travel_percentage?.toString() ?? '',
          comp_range_low: job.comp_range_low?.toString() ?? '',
          comp_range_high: job.comp_range_high?.toString() ?? '',
          fee_percentage_override: job.fee_percentage_override?.toString() ?? '',
          source: job.source ?? '',
          next_step: job.next_step ?? '',
          next_step_due_date: job.next_step_due_date ?? '',
        }
      : {
          title: '',
          company_id: '',
          hiring_manager_id: '',
          status: 'open',
          priority: '',
          description: '',
          requirements: '',
          location_type: '',
          location_city: '',
          location_state: '',
          travel_percentage: '',
          comp_range_low: '',
          comp_range_high: '',
          fee_percentage_override: '',
          source: '',
          next_step: '',
          next_step_due_date: '',
        },
  })

  const { handleSubmit, setValue, watch, formState: { isSubmitting } } = form
  const watchedCompanyId = watch('company_id')

  // Load client companies on mount
  useEffect(() => {
    fetchClientCompanies()
      .then(setClientCompanies)
      .catch(() => setClientCompanies([]))
  }, [])

  // Load contacts when company changes (or on edit mount)
  useEffect(() => {
    if (!watchedCompanyId) {
      setContacts([])
      return
    }
    fetchCompanyContacts(watchedCompanyId)
      .then(setContacts)
      .catch(() => setContacts([]))
  }, [watchedCompanyId])

  function handleCompanyChange(companyId: string) {
    setValue('hiring_manager_id', '')
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function onSubmit(values: JobOpeningFormValues) {
    setServerError(null)
    try {
      const payload = {
        title: values.title,
        company_id: values.company_id,
        hiring_manager_id: values.hiring_manager_id || null,
        status: values.status as JobStatus,
        priority: (values.priority as Priority) || null,
        description: values.description || null,
        requirements: values.requirements || null,
        location_type: (values.location_type as LocationType) || null,
        location_city: values.location_city || null,
        location_state: values.location_state || null,
        travel_percentage: values.travel_percentage ? parseInt(values.travel_percentage, 10) : null,
        comp_range_low: values.comp_range_low ? parseInt(values.comp_range_low, 10) : null,
        comp_range_high: values.comp_range_high ? parseInt(values.comp_range_high, 10) : null,
        fee_percentage_override: values.fee_percentage_override ? parseFloat(values.fee_percentage_override) : null,
        source: (values.source as JobSource) || null,
        next_step: values.next_step || null,
        next_step_due_date: values.next_step_due_date || null,
      }

      if (job) {
        await updateJobOpening(job.id, payload)
        router.push(`/jobs/${job.id}`)
      } else {
        const created = await createJobOpening(payload)
        router.push(`/jobs/${created.id}`)
      }
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    }
  }

  const isEdit = !!job

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">{isEdit ? 'Edit Job Opening' : 'New Job Opening'}</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
        <CardContent>
          <BasicInfoSection
            form={form}
            clientCompanies={clientCompanies}
            contacts={contacts}
            onCompanyChange={handleCompanyChange}
            watchedCompanyId={watchedCompanyId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Job Description</CardTitle></CardHeader>
        <CardContent><DescriptionSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Location &amp; Logistics</CardTitle></CardHeader>
        <CardContent><LocationSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Compensation &amp; Fees</CardTitle></CardHeader>
        <CardContent><CompensationSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tracking</CardTitle></CardHeader>
        <CardContent><TrackingSection form={form} /></CardContent>
      </Card>

      {serverError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{serverError}</p>
        </div>
      )}

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEdit ? 'Update Job Opening' : 'Create Job Opening'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
