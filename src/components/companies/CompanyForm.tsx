'use client'

// Works for both create (no company prop) and edit (company prop provided).
// On create: redirects to the new company's detail page.
// On edit:   redirects back to the company's detail page.

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { companySchema, type CompanyFormValues } from '@/lib/validations/company'
import { createCompany, updateCompany } from '@/lib/supabase/companies-client'
import { stripDomain } from '@/lib/utils/domain'
import type { Company, CompanyType, CompanySource, Priority, ProspectPipelineStage, CompanyDisposition } from '@/types/database'
import {
  BasicInfoSection,
  LocationSection,
  BizDevSection,
  StatusSection,
} from './CompanyFormSections'

interface CompanyFormProps {
  company?: Company
}

export function CompanyForm({ company }: CompanyFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: company
      ? {
          name: company.name,
          domain: company.domain ?? '',
          company_type: company.company_type ?? '',
          industry: company.industry ?? '',
          hq_city: company.hq_city ?? '',
          hq_state: company.hq_state ?? '',
          hq_country: company.hq_country ?? 'US',
          status: company.status,
          prospect_stage: company.prospect_stage ?? '',
          priority: company.priority ?? '',
          why_target: company.why_target ?? '',
          source: company.source ?? '',
          next_step: company.next_step ?? '',
          next_step_due_date: company.next_step_due_date ?? '',
          disposition: company.disposition ?? '',
          fee_agreement_pct: company.fee_agreement_pct?.toString() ?? '',
          became_client_at: company.became_client_at ?? '',
        }
      : {
          name: '',
          domain: '',
          company_type: '',
          industry: '',
          hq_city: '',
          hq_state: '',
          hq_country: 'US',
          status: 'prospect',
          prospect_stage: 'targeted',
          priority: '',
          why_target: '',
          source: '',
          next_step: '',
          next_step_due_date: '',
          disposition: 'active',
          fee_agreement_pct: '',
          became_client_at: '',
        },
  })

  const { handleSubmit, setValue, watch, formState: { isSubmitting } } = form
  const watchedStatus = watch('status')

  // ─── Transition handlers ────────────────────────────────────────────────────

  function handleStatusChange(newStatus: string) {
    if (newStatus === 'prospect') {
      setValue('became_client_at', '')
      setValue('prospect_stage', 'targeted')
      setValue('disposition', 'active')
    } else if (newStatus === 'client') {
      // prospect_stage → closed transition sets became_client_at;
      // direct status change to client keeps became_client_at if already set.
    } else {
      // former_client or inactive
      setValue('prospect_stage', '')
      setValue('disposition', '')
    }
  }

  function handleProspectStageChange(newStage: string) {
    if (newStage === 'closed') {
      setValue('status', 'client')
      setValue('became_client_at', new Date().toISOString().split('T')[0])
      setValue('disposition', '')
    }
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function onSubmit(values: CompanyFormValues) {
    setServerError(null)
    try {
      const payload = {
        name: values.name,
        domain: values.domain ? stripDomain(values.domain) || null : null,
        company_type: (values.company_type as CompanyType) || null,
        industry: values.industry || null,
        hq_city: values.hq_city || null,
        hq_state: values.hq_state || null,
        hq_country: values.hq_country || 'US',
        status: values.status,
        prospect_stage: (values.prospect_stage as ProspectPipelineStage) || null,
        priority: (values.priority as Priority) || null,
        why_target: values.why_target || null,
        source: (values.source as CompanySource) || null,
        next_step: values.next_step || null,
        next_step_due_date: values.next_step_due_date || null,
        disposition: (values.disposition as CompanyDisposition) || null,
        fee_agreement_pct: values.fee_agreement_pct ? parseFloat(values.fee_agreement_pct) : null,
        became_client_at: values.became_client_at || null,
      }

      if (company) {
        await updateCompany(company.id, payload)
        router.push(`/companies/${company.id}`)
      } else {
        const created = await createCompany(payload)
        router.push(`/companies/${created.id}`)
      }
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    }
  }

  const isEdit = !!company

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">{isEdit ? 'Edit Company' : 'New Company'}</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
        <CardContent><BasicInfoSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
        <CardContent><LocationSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Business Development</CardTitle></CardHeader>
        <CardContent><BizDevSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Status &amp; Pipeline</CardTitle></CardHeader>
        <CardContent>
          <StatusSection
            form={form}
            watchedStatus={watchedStatus}
            onStatusChange={handleStatusChange}
            onProspectStageChange={handleProspectStageChange}
          />
        </CardContent>
      </Card>

      {serverError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{serverError}</p>
        </div>
      )}

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEdit ? 'Update Company' : 'Create Company'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
