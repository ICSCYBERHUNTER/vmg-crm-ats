'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import type { Candidate } from '@/types/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

function ensureHttps(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs px-2 py-0.5 border border-border rounded text-muted-foreground hover:bg-muted shrink-0"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ─── Row layout ──────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-x-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 min-w-0">{children}</div>
    </div>
  )
}

// ─── Contact Card ────────────────────────────────────────────────────────────

export function ContactCard({ candidate: c }: { candidate: Candidate }) {
  const city = [c.location_city, c.location_state].filter(Boolean).join(', ')

  return (
    <CollapsibleSection title="Contact Info" defaultOpen={false}>
      <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        <div className="divide-y">
          <Row label="Email">
            {c.email ? (
              <>
                <span className="break-all">{c.email}</span>
                <CopyButton text={c.email} />
              </>
            ) : (
              <span>—</span>
            )}
          </Row>
          <Row label="Phone">
            {c.phone ? (
              <>
                <span>{formatPhone(c.phone)}</span>
                <CopyButton text={c.phone} />
              </>
            ) : (
              <span>—</span>
            )}
          </Row>
          <Row label="LinkedIn">
            {c.linkedin_url ? (
              <a
                href={ensureHttps(c.linkedin_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 border border-blue-400/30 rounded-md px-3 py-1 hover:bg-blue-400/10 inline-flex items-center gap-1.5"
              >
                LinkedIn profile
                <ExternalLink size={14} />
              </a>
            ) : (
              <span>—</span>
            )}
          </Row>
        </div>
        <div className="divide-y">
          <Row label="City / State">
            <span>{city || '—'}</span>
          </Row>
          <Row label="Country">
            <span>{c.location_country || '—'}</span>
          </Row>
          <Row label="Willing to Relocate">
            <span>{c.willing_to_relocate || '—'}</span>
          </Row>
          <Row label="Relocation Preferences">
            <span className="break-words">{c.relocation_preferences || '—'}</span>
          </Row>
        </div>
      </div>
    </CollapsibleSection>
  )
}
