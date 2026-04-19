'use client'

import { ExternalLink, Mail, Phone } from 'lucide-react'
import { CopyButton } from '@/components/shared/CopyButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-x-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 min-w-0">{children}</div>
    </div>
  )
}

interface ContactInfoCardProps {
  email: string | null
  phone: string | null
  linkedinUrl: string | null
}

export function ContactInfoCard({ email, phone, linkedinUrl }: ContactInfoCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <Row
          label="Email"
          children={
            email ? (
              <>
                <a href={`mailto:${email}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Mail className="h-3 w-3" />
                  {email}
                </a>
                <CopyButton text={email} />
              </>
            ) : '—'
          }
        />
        <Row
          label="Phone"
          children={
            phone ? (
              <>
                <a href={`tel:${phone}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Phone className="h-3 w-3" />
                  {phone}
                </a>
                <CopyButton text={phone} />
              </>
            ) : '—'
          }
        />
        <Row
          label="LinkedIn"
          children={
            linkedinUrl ? (
              <a
                href={linkedinUrl}
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
  )
}
