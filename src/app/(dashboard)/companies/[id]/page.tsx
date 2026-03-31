// Server Component — fetches company by ID from Supabase.
// params is a Promise in Next.js 16 and must be awaited.

import Link from 'next/link'
import { Pencil, ExternalLink, Building2, Users, Briefcase, MessageSquare, Plus, Linkedin } from 'lucide-react'
import { FollowUpTasks } from '@/components/shared/FollowUpTasks'
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
import { LinkCandidateButton } from '@/components/companies/LinkCandidateButton'
import { CompanyJobOpenings } from '@/components/companies/CompanyJobOpenings'
import { NotesSection } from '@/components/notes/NotesSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Company } from '@/types/database'
import { label, COMPANY_TYPE_LABELS, COMPANY_SOURCE_LABELS } from '@/lib/utils/labels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function isDueDateOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString())
}

// ─── Sidebar-label row helper ─────────────────────────────────────────────────

function SidebarRow({ label: lbl, value, index }: { label: string; value: React.ReactNode; index: number }) {
  return (
    <div>
      {index > 0 && <div className="border-t border-border pt-5 mb-5" />}
      <div className="grid gap-x-3" style={{ gridTemplateColumns: '140px 1fr' }}>
        <span className="text-sm font-medium text-blue-400" style={{ paddingTop: '2px' }}>
          {lbl}
        </span>
        <span className="text-sm text-foreground leading-relaxed">{value}</span>
      </div>
    </div>
  )
}

// ─── Stat block helper ────────────────────────────────────────────────────────

function StatBlock({ label: lbl, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3">
      <p className="text-xs text-zinc-500">{lbl}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  )
}

// ─── Business Development card ────────────────────────────────────────────────

function BizDevCard({ c }: { c: Company }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Business Development</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-muted-foreground mb-3">Tasks</p>
        <FollowUpTasks entityType="company" entityId={c.id} />

        {c.why_target && (
          <>
            <div className="border-b border-border mb-4 pb-4 mt-4" />
            <SidebarRow label="Why Target" value={c.why_target} index={0} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Company Snapshot card ────────────────────────────────────────────────────

function CompanySnapshotCard({ c }: { c: Company }) {
  const rows: { label: string; value: string }[] = []

  if (c.target_buyer) rows.push({ label: 'Target Buyer', value: c.target_buyer })
  if (c.growth_stage) rows.push({ label: 'Growth Stage', value: c.growth_stage })
  if (c.hiring_signal) rows.push({ label: 'Hiring Signal', value: c.hiring_signal })

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Company Snapshot</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No company snapshot info yet.</p>
        ) : (
          <div>
            {rows.map((row, i) => (
              <SidebarRow key={row.label} label={row.label} value={row.value} index={i} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Account Thesis section ───────────────────────────────────────────────────

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

  const location = [company.hq_city, company.hq_state, company.hq_country].filter(Boolean).join(', ')
  const lastContactedDisplay = company.last_contacted_at
    ? `${formatDate(company.last_contacted_at)}${formatRelativeTime(company.last_contacted_at) ? ` (${formatRelativeTime(company.last_contacted_at)})` : ''}`
    : '—'

  return (
    <div className="flex flex-col gap-6">
      {/* C1 — Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <CompanyStatusBadge status={company.status} />
            {company.status === 'prospect' && company.prospect_stage && (
              <PipelineStageBadge stage={company.prospect_stage} />
            )}
            {company.priority && <PriorityBadge priority={company.priority} />}
            {company.disposition && <DispositionBadge disposition={company.disposition} />}
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

      {/* C2 — Stat Blocks Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBlock label="Company Type" value={label(COMPANY_TYPE_LABELS, company.company_type)} />
        <StatBlock label="Industry" value={company.industry || '—'} />
        <StatBlock label="HQ" value={location || '—'} />
        <StatBlock label="Fee Agreement" value={company.fee_agreement_pct != null ? `${company.fee_agreement_pct}%` : '—'} />
        <StatBlock label="Last Contacted" value={lastContactedDisplay} />
        <StatBlock label="Source" value={company.source ? label(COMPANY_SOURCE_LABELS, company.source) : '—'} />
      </div>

      {/* C3 — Two-Column Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BizDevCard c={company} />
        <CompanySnapshotCard c={company} />
      </div>

      {/* C4 — Collapsible Sections */}
      <AccountThesisCard c={company} />
      <InterviewPrepSection companyId={company.id} companyName={company.name} />

      <CollapsibleSection
        title="Contacts"
        icon={<Users className="h-4 w-4" />}
        count={contacts.length}
        defaultOpen={false}
        headerAction={
          <div className="flex items-center gap-2">
            <LinkCandidateButton companyId={id} />
            <Link href={`/companies/${id}/contacts/new`}>
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Contact
              </Button>
            </Link>
          </div>
        }
      >
        <ContactsSection companyId={id} contacts={contacts} />
      </CollapsibleSection>

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
