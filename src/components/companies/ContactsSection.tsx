import Link from 'next/link'
import { Plus, Star, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContactTypeBadge } from '@/components/shared/ContactTypeBadge'
import { InfluenceBadge } from '@/components/shared/InfluenceBadge'
import type { CompanyContactWithReportsTo } from '@/types/database'

interface ContactsSectionProps {
  companyId: string
  contacts: CompanyContactWithReportsTo[]
}

export function ContactsSection({ companyId, contacts }: ContactsSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Contacts</CardTitle>
          <Badge variant="secondary" className="rounded-full text-xs">
            {contacts.length}
          </Badge>
        </div>
        <Link href={`/companies/${companyId}/contacts/new`}>
          <Button variant="outline" size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Contact
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts added yet.</p>
        ) : (
          <div className="divide-y">
            {contacts.map((contact) => (
              <ContactRow key={contact.id} contact={contact} companyId={companyId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ContactRow({
  contact,
  companyId,
}: {
  contact: CompanyContactWithReportsTo
  companyId: string
}) {
  const fullName = `${contact.first_name} ${contact.last_name}`
  const reportsToName = contact.reports_to
    ? `${contact.reports_to.first_name} ${contact.reports_to.last_name}`
    : null

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 text-sm">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/companies/${companyId}/contacts/${contact.id}`}
            className="font-medium text-primary hover:underline"
          >
            {fullName}
          </Link>
          {contact.is_primary && (
            <span className="flex items-center gap-0.5 text-xs text-amber-400">
              <Star className="h-3 w-3 fill-current" />
              Primary
            </span>
          )}
          <ContactTypeBadge contactType={contact.contact_type} />
          {contact.influence_level && (
            <InfluenceBadge level={contact.influence_level} />
          )}
        </div>
        {contact.title && (
          <span className="text-muted-foreground">{contact.title}</span>
        )}
        {reportsToName && (
          <span className="text-xs text-muted-foreground">
            Reports to {reportsToName}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 text-muted-foreground">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-primary">
            <Mail className="h-3 w-3" />
            {contact.email}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-primary">
            <Phone className="h-3 w-3" />
            {contact.phone}
          </a>
        )}
      </div>
    </div>
  )
}
