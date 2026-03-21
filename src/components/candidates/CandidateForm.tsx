'use client'

// Works for both create (no candidate prop) and edit (candidate prop provided).
// On create: redirects to the new candidate's detail page.
// On edit:   redirects back to the candidate's detail page.

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { candidateSchema, type CandidateFormValues } from '@/lib/validations/candidate'
import { createCandidate, updateCandidate } from '@/lib/supabase/candidates-client'
import type { Candidate, CandidateCategory, CandidateSource } from '@/types/database'
import {
  ContactSection,
  ProfessionalSection,
  CompensationSection,
  LocationSection,
  RecruitingSection,
} from './CandidateFormSections'

interface CandidateFormProps {
  candidate?: Candidate
}

export function CandidateForm({ candidate }: CandidateFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateSchema),
    defaultValues: candidate
      ? {
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          status: candidate.status,
          willing_to_relocate: candidate.willing_to_relocate,
          email: candidate.email ?? '',
          phone: candidate.phone ?? '',
          linkedin_url: candidate.linkedin_url ?? '',
          current_title: candidate.current_title ?? '',
          current_company: candidate.current_company ?? '',
          category: candidate.category ?? '',
          years_experience: candidate.years_experience?.toString() ?? '',
          skills: candidate.skills ?? '',
          current_compensation: candidate.current_compensation?.toString() ?? '',
          desired_compensation: candidate.desired_compensation?.toString() ?? '',
          location_city: candidate.location_city ?? '',
          location_state: candidate.location_state ?? '',
          location_country: candidate.location_country ?? 'USA',
          relocation_preferences: candidate.relocation_preferences ?? '',
          source: candidate.source ?? '',
        }
      : {
          first_name: '',
          last_name: '',
          status: 'active',
          willing_to_relocate: 'unknown',
          email: '',
          phone: '',
          linkedin_url: '',
          current_title: '',
          current_company: '',
          category: '',
          years_experience: '',
          skills: '',
          current_compensation: '',
          desired_compensation: '',
          location_city: '',
          location_state: '',
          location_country: 'USA',
          relocation_preferences: '',
          source: '',
        },
  })

  const { handleSubmit, formState: { isSubmitting } } = form

  async function onSubmit(values: CandidateFormValues) {
    setServerError(null)
    try {
      // Convert empty strings to null and string numbers to real numbers.
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        status: values.status,
        willing_to_relocate: values.willing_to_relocate,
        email: values.email || null,
        phone: values.phone || null,
        linkedin_url: values.linkedin_url || null,
        current_title: values.current_title || null,
        current_company: values.current_company || null,
        category: (values.category as CandidateCategory) || null,
        years_experience: values.years_experience ? parseInt(values.years_experience, 10) : null,
        skills: values.skills || null,
        current_compensation: values.current_compensation ? parseFloat(values.current_compensation) : null,
        desired_compensation: values.desired_compensation ? parseFloat(values.desired_compensation) : null,
        location_city: values.location_city || null,
        location_state: values.location_state || null,
        location_country: values.location_country || 'USA',
        relocation_preferences: values.relocation_preferences || null,
        source: (values.source as CandidateSource) || null,
      }

      if (candidate) {
        await updateCandidate(candidate.id, payload)
        router.push(`/candidates/${candidate.id}`)
      } else {
        const created = await createCandidate(payload)
        router.push(`/candidates/${created.id}`)
      }
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    }
  }

  const isEdit = !!candidate
  const title = isEdit ? 'Edit Candidate' : 'New Candidate'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">{title}</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
        <CardContent><ContactSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Professional Info</CardTitle></CardHeader>
        <CardContent><ProfessionalSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Compensation</CardTitle></CardHeader>
        <CardContent><CompensationSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
        <CardContent><LocationSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recruiting</CardTitle></CardHeader>
        <CardContent><RecruitingSection form={form} /></CardContent>
      </Card>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEdit ? 'Update Candidate' : 'Create Candidate'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
