'use client'

// Works for both create (no contact prop) and edit (contact prop provided).
// On create: redirects back to the company detail page.
// On edit:   redirects to the contact detail page.

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { contactSchema, type ContactFormValues } from '@/lib/validations/contact'
import {
  createContact,
  updateContact,
  fetchContactsByCompany,
} from '@/lib/supabase/contacts-client'
import type { CompanyContact, CompanyContactWithReportsTo, ContactType, InfluenceLevel } from '@/types/database'
import { BasicInfoSection, RoleSection, ReportingSection } from './ContactFormSections'

interface ContactFormProps {
  companyId: string
  contact?: CompanyContact
}

export function ContactForm({ companyId, contact }: ContactFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [companyContacts, setCompanyContacts] = useState<CompanyContactWithReportsTo[]>([])

  useEffect(() => {
    fetchContactsByCompany(companyId)
      .then(setCompanyContacts)
      .catch(() => setCompanyContacts([]))
  }, [companyId])

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: contact
      ? {
          first_name: contact.first_name,
          last_name: contact.last_name,
          title: contact.title ?? '',
          email: contact.email ?? '',
          phone: contact.phone ?? '',
          linkedin_url: contact.linkedin_url ?? '',
          contact_type: contact.contact_type,
          is_primary: contact.is_primary,
          reports_to_id: contact.reports_to_id ?? '',
          influence_level: contact.influence_level ?? '',
        }
      : {
          first_name: '',
          last_name: '',
          title: '',
          email: '',
          phone: '',
          linkedin_url: '',
          contact_type: 'other',
          is_primary: false,
          reports_to_id: '',
          influence_level: '',
        },
  })

  const { handleSubmit, formState: { isSubmitting } } = form

  async function onSubmit(values: ContactFormValues) {
    setServerError(null)
    try {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        title: values.title || null,
        email: values.email || null,
        phone: values.phone || null,
        linkedin_url: values.linkedin_url || null,
        contact_type: values.contact_type as ContactType,
        is_primary: values.is_primary,
        reports_to_id: values.reports_to_id || null,
        influence_level: (values.influence_level as InfluenceLevel) || null,
      }

      if (contact) {
        await updateContact(contact.id, companyId, payload)
        router.push(`/companies/${companyId}/contacts/${contact.id}`)
      } else {
        await createContact(companyId, payload)
        router.push(`/companies/${companyId}`)
      }
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    }
  }

  const isEdit = !!contact
  const title = isEdit ? 'Edit Contact' : 'New Contact'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">{title}</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
        <CardContent><BasicInfoSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Role & Influence</CardTitle></CardHeader>
        <CardContent><RoleSection form={form} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Reporting Structure</CardTitle></CardHeader>
        <CardContent>
          <ReportingSection
            form={form}
            contacts={companyContacts}
            currentContactId={contact?.id}
          />
        </CardContent>
      </Card>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEdit ? 'Update Contact' : 'Create Contact'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/companies/${companyId}`)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
