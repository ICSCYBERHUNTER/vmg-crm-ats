// Server Component — fetches company by ID from Supabase.
// params is a Promise in Next.js 16 and must be awaited.

import Link from 'next/link'
import { Pencil, ExternalLink, Building2, Users, Briefcase, MessageSquare, Plus, Linkedin } from 'lucide-react'
import { getCompanyById } from '@/lib/supabase/companies'
import { getContactsByCompany } from '@/lib/supabase/contacts'
import { CompanyStatusBadge } from '@/components/shared/CompanyStatusBadge'
import { PipelineStageBadge } from '@/components/shared/PipelineStageBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { DispositionBadge } from '@/components/shared/DispositionBadge'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { DeleteCompanyButton } from '@/components/companies/DeleteCompanyButton'
import { InterviewPrepSection } from '@/components/companies/InterviewPrepSection'
import { ContactsSection } from '@/components/companies/ContactsSection'
import { CompanyJobOpenings } from '@/components/companies/CompanyJobOpenings'
import { NotesSection } from '@/components/notes/NotesSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Company } from '@/types/database'
import { label, COMPANY_TYPE_LABELS, COMPANY_SOURCE_LABELS } from '@/lib/utils/labels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function val(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  return String(v)
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

function Row({ label: lbl, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-x-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{lbl}</span>
      <span className="break-words">{value}</span>
    </div>
  )
}

function isDueDateOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString())
}

// ─── Section components ───────────────────────────────────────────────────────

function BizDevCard({ c }: { c: Company }) {
  const dueDateText = c.next_step_due_date
    ? new Date(c.next_step_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Business Development</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row
          label="Next Step"
          value={
            <span className="flex flex-wrap items-center gap-2">
              <span>{val(c.next_step)}</span>
              {dueDateText && (
                <span className={isDueDateOverdue(c.next_step_due_date) ? 'text-red-400 font-medium' : 'text-muted-foreground'}>
                  — due {dueDateText}
                </span>
              )}
            </span>
          }
        />
        <Row label="Why Target" value={val(c.why_target)} />
        {c.status === 'prospect' && c.disposition && (
          <Row label="Disposition" value={<DispositionBadge disposition={c.disposition} />} />
        )}
        <Row label="Source" value={label(COMPANY_SOURCE_LABELS, c.source)} />
      </CardContent>
    </Card>
  )
}

function CompanyInfoCard({ c }: { c: Company }) {
  const location = [c.hq_city, c.hq_state, c.hq_country].filter(Boolean).join(', ')
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Company Info</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row label="Company Type" value={label(COMPANY_TYPE_LABELS, c.company_type)} />
        <Row label="Industry" value={val(c.industry)} />
        <Row label="HQ Location" value={location || '—'} />
      </CardContent>
    </Card>
  )
}

function ClientDetailsCard({ c }: { c: Company }) {
  const showClientSection = c.status === 'client' || c.fee_agreement_pct != null
  if (!showClientSection) return null
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Client Details</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row
          label="Fee Agreement"
          value={c.fee_agreement_pct != null ? `${c.fee_agreement_pct}%` : '—'}
        />
        <Row label="Became Client" value={formatDate(c.became_client_at)} />
      </CardContent>
    </Card>
  )
}

function TrackingCard({ c }: { c: Company }) {
  const relative = formatRelativeTime(c.last_contacted_at)
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tracking</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row
          label="Last Contacted"
          value={c.last_contacted_at ? `${formatDate(c.last_contacted_at)}${relative ? ` (${relative})` : ''}` : '—'}
        />
        <Row label="Date Added" value={formatDate(c.created_at)} />
      </CardContent>
    </Card>
  )
}

function ThesisField({ label: lbl, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{lbl}</p>
      {value ? (
        <p className="text-sm whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">Not yet documented</p>
      )}
    </div>
  )
}

function AccountThesisCard({ c }: { c: Company }) {
  const fields = [c.what_they_do, c.target_customer_profile, c.company_size, c.key_products_services]
  const filledCount = fields.filter(Boolean).length
  const allEmpty = filledCount === 0

  return (
    <CollapsibleSection
      title="Account Thesis"
      icon={<Building2 className="h-4 w-4" />}
      count={filledCount}
      defaultOpen={false}
    >
      {allEmpty ? (
        <p className="text-sm italic text-muted-foreground">
          No account thesis documented yet. Edit this company to add insights.
        </p>
      ) : (
        <div>
          {[
            { label: 'What they do', value: c.what_they_do },
            { label: 'Target customer', value: c.target_customer_profile },
            { label: 'Company size', value: c.company_size },
            { label: 'Key products', value: c.key_products_services },
          ]
            .filter(({ value }) => value)
            .map(({ label, value }, i) => (
              <div key={label}>
                {i > 0 && <div className="border-t border-border pt-5 mb-5" />}
                <div className="grid gap-x-3" style={{ gridTemplateColumns: '140px 1fr' }}>
                  <span className="text-sm font-medium text-blue-400" style={{ paddingTop: '2px' }}>
                    {label}
                  </span>
                  <span className="text-sm text-foreground leading-relaxed">{value}</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [company, contacts] = await Promise.all([
    getCompanyById(id).catch(() => null),
    getContactsByCompany(id).catch(() => []),
  ])

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-semibold">Company Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This company may have been deleted or the link is incorrect.
        </p>
        <Link href="/companies" className="mt-6">
          <Button variant="outline">Back to Companies</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <CompanyStatusBadge status={company.status} />
            {company.status === 'prospect' && company.prospect_stage && (
              <PipelineStageBadge stage={company.prospect_stage} />
            )}
            {company.priority && <PriorityBadge priority={company.priority} />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {company.domain && (
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {company.domain}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {company.linkedin_url && (
              <a
                href={company.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Linkedin className="h-3.5 w-3.5" />
                LinkedIn
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/companies/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <DeleteCompanyButton id={id} name={company.name} />
        </div>
      </div>

      <BizDevCard c={company} />
      <CompanyInfoCard c={company} />
      <ClientDetailsCard c={company} />
      <AccountThesisCard c={company} />
      <InterviewPrepSection companyId={company.id} companyName={company.name} />

      <CollapsibleSection
        title="Contacts"
        icon={<Users className="h-4 w-4" />}
        count={contacts.length}
        defaultOpen={false}
        headerAction={
          <Link href={`/companies/${id}/contacts/new`}>
            <Button variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Contact
            </Button>
          </Link>
        }
      >
        <ContactsSection companyId={id} contacts={contacts} />
      </CollapsibleSection>

      {company.status === 'client' && (
        <CollapsibleSection
          title="Job Openings"
          icon={<Briefcase className="h-4 w-4" />}
          defaultOpen={false}
          headerAction={
            <Link href="/jobs/new">
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Job Opening
              </Button>
            </Link>
          }
        >
          <CompanyJobOpenings companyId={company.id} />
        </CollapsibleSection>
      )}

      <TrackingCard c={company} />

      <CollapsibleSection
        title="Notes"
        icon={<MessageSquare className="h-4 w-4" />}
        defaultOpen={false}
      >
        <NotesSection entityType="company" entityId={company.id} />
      </CollapsibleSection>
    </div>
  )
}
