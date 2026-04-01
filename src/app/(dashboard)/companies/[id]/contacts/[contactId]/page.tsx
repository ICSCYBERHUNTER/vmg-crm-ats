// Server Component — Contact detail page, nested under a company.

import Link from 'next/link'
import { Pencil, ExternalLink, Mail, Phone, Star } from 'lucide-react'
import { getContactById, getContactsByCompany } from '@/lib/supabase/contacts'
import { getCompanyById } from '@/lib/supabase/companies'
import { ContactTypeBadge } from '@/components/shared/ContactTypeBadge'
import { InfluenceBadge } from '@/components/shared/InfluenceBadge'
import { DeleteContactButton } from '@/components/contacts/DeleteContactButton'
import { KeyRelationshipToggle } from '@/components/shared/KeyRelationshipToggle'
import { ContactLinkingSection } from '@/components/contacts/ContactLinkingSection'
import { NotesSection } from '@/components/notes/NotesSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function val(v: string | null | undefined): string {
  if (v == null || v === '') return '—'
  return v
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-x-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  )
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string; contactId: string }>
}) {
  const { id: companyId, contactId } = await params

  const [contact, company] = await Promise.all([
    getContactById(contactId).catch(() => null),
    getCompanyById(companyId).catch(() => null),
  ])

  if (!contact || !company) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-semibold">Contact Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This contact may have been deleted or the link is incorrect.
        </p>
        <Link href={`/companies/${companyId}`} className="mt-6">
          <Button variant="outline">Back to Company</Button>
        </Link>
      </div>
    )
  }

  // Fetch direct reports (contacts at same company who report to this contact)
  const allContacts = await getContactsByCompany(companyId).catch(() => [])
  const directReports = allContacts.filter((c) => c.reports_to_id === contactId)

  const fullName = `${contact.first_name} ${contact.last_name}`
  const relative = formatRelativeTime(contact.last_contacted_at)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{fullName}</h1>
            {contact.is_primary && (
              <span className="flex items-center gap-0.5 text-sm text-amber-400">
                <Star className="h-4 w-4 fill-current" />
                Primary
              </span>
            )}
            <ContactTypeBadge contactType={contact.contact_type} />
            {contact.influence_level && (
              <InfluenceBadge level={contact.influence_level} />
            )}
          </div>
          {contact.title && (
            <p className="mt-1 text-sm text-muted-foreground">{contact.title}</p>
          )}
          <Link
            href={`/companies/${companyId}`}
            className="mt-1 text-sm text-primary hover:underline"
          >
            {company.name}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <KeyRelationshipToggle entityType="company_contact" entityId={contactId} />
          {!contact.linked_candidate_id && (
            <ContactLinkingSection
              contactId={contactId}
              contactName={fullName}
              linkedCandidateId={null}
            />
          )}
          <Link href={`/companies/${companyId}/contacts/${contactId}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <DeleteContactButton
            id={contactId}
            companyId={companyId}
            name={fullName}
          />
        </div>
      </div>

      {/* Linked Candidate Indicator */}
      {contact.linked_candidate_id && (
        <ContactLinkingSection
          contactId={contactId}
          contactName={fullName}
          linkedCandidateId={contact.linked_candidate_id}
        />
      )}

      {/* Contact Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row
            label="Email"
            value={
              contact.email ? (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Mail className="h-3 w-3" />
                  {contact.email}
                </a>
              ) : '—'
            }
          />
          <Row
            label="Phone"
            value={
              contact.phone ? (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Phone className="h-3 w-3" />
                  {contact.phone}
                </a>
              ) : '—'
            }
          />
          <Row
            label="LinkedIn"
            value={
              contact.linkedin_url ? (
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  LinkedIn Profile
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : '—'
            }
          />
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader><CardTitle className="text-base">Organization</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row
            label="Reports To"
            value={
              contact.reports_to ? (
                <Link
                  href={`/companies/${companyId}/contacts/${contact.reports_to.id}`}
                  className="text-primary hover:underline"
                >
                  {contact.reports_to.first_name} {contact.reports_to.last_name}
                  {contact.reports_to.title ? ` — ${contact.reports_to.title}` : ''}
                </Link>
              ) : '—'
            }
          />
          <Row
            label="Direct Reports"
            value={
              directReports.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {directReports.map((dr) => (
                    <Link
                      key={dr.id}
                      href={`/companies/${companyId}/contacts/${dr.id}`}
                      className="text-primary hover:underline"
                    >
                      {dr.first_name} {dr.last_name}
                      {dr.title ? ` — ${dr.title}` : ''}
                    </Link>
                  ))}
                </div>
              ) : 'None'
            }
          />
        </CardContent>
      </Card>

      {/* Tracking */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tracking</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row
            label="Last Contacted"
            value={
              contact.last_contacted_at
                ? `${formatDate(contact.last_contacted_at)}${relative ? ` (${relative})` : ''}`
                : '—'
            }
          />
          <Row label="Date Added" value={formatDate(contact.created_at)} />
        </CardContent>
      </Card>

      <NotesSection entityType="contact" entityId={contact.id} />
    </div>
  )
}
