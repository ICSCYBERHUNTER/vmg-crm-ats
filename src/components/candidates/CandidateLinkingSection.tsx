'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Link2, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'
import { CompanyStatusBadge } from '@/components/shared/CompanyStatusBadge'
import { createClient } from '@/lib/supabase/client'
import { fetchCompanies } from '@/lib/supabase/companies-client'
import { createContactFromCandidate, unlinkCandidateContact } from '@/lib/supabase/linking'
import type { Company } from '@/types/database'

interface CandidateLinkingSectionProps {
  candidateId: string
  candidateName: string
  linkedContactId: string | null
}

export function CandidateLinkingSection({
  candidateId,
  candidateName,
  linkedContactId,
}: CandidateLinkingSectionProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [showUnlink, setShowUnlink] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newContactId, setNewContactId] = useState<string | null>(null)
  const [newCompanyId, setNewCompanyId] = useState<string | null>(null)

  // Linked contact info (fetched when linkedContactId is set)
  const [linkedInfo, setLinkedInfo] = useState<{
    companyId: string
    companyName: string
  } | null>(null)
  const [linkedLoading, setLinkedLoading] = useState(false)

  useEffect(() => {
    if (!linkedContactId) return
    setLinkedLoading(true)
    const supabase = createClient()
    supabase
      .from('company_contacts')
      .select('id, company_id, companies(id, name)')
      .eq('id', linkedContactId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (!fetchError && data) {
          const company = data.companies as unknown as { id: string; name: string }
          setLinkedInfo({
            companyId: company.id,
            companyName: company.name,
          })
        }
        setLinkedLoading(false)
      })
  }, [linkedContactId])

  async function handleUnlink() {
    if (!linkedContactId) return
    setIsLoading(true)
    setError(null)
    try {
      await unlinkCandidateContact(candidateId, linkedContactId)
      setShowUnlink(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink')
    } finally {
      setIsLoading(false)
    }
  }

  // Success state
  if (newContactId && newCompanyId) {
    return (
      <Dialog open onOpenChange={() => { setNewContactId(null); setNewCompanyId(null); router.refresh() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Created</DialogTitle>
            <DialogDescription>
              A contact record has been created for {candidateName}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setNewContactId(null); setNewCompanyId(null); router.refresh() }}>
              Stay Here
            </Button>
            <Link href={`/companies/${newCompanyId}/contacts/${newContactId}`}>
              <Button>View Contact</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Linked state
  if (linkedContactId) {
    if (linkedLoading) {
      return <Skeleton className="h-12 w-full" />
    }

    return (
      <>
        <div className="flex items-center gap-3 rounded-md border-l-4 border-blue-500 bg-blue-950/30 px-4 py-3">
          <Link2 className="h-4 w-4 shrink-0 text-blue-400" />
          <span className="text-sm">
            Also a Client Contact{linkedInfo ? ` at ${linkedInfo.companyName}` : ''}
          </span>
          {linkedInfo && (
            <Link
              href={`/companies/${linkedInfo.companyId}/contacts/${linkedContactId}`}
              className="ml-auto text-sm text-primary hover:underline"
            >
              View Contact Record &rarr;
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
            onClick={() => setShowUnlink(true)}
          >
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Dialog open={showUnlink} onOpenChange={setShowUnlink}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unlink Records?</DialogTitle>
              <DialogDescription>
                Remove the link between this candidate and contact record? Both records
                will continue to exist — only the connection between them will be removed.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnlink(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleUnlink} disabled={isLoading}>
                {isLoading ? 'Unlinking...' : 'Unlink'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Unlinked state — show create button
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
        <Building2 className="mr-1.5 h-4 w-4" />
        Also Create as Client Contact
      </Button>

      <CompanySelectModal
        open={showModal}
        candidateId={candidateId}
        candidateName={candidateName}
        isLoading={isLoading}
        error={error}
        onClose={() => { setShowModal(false); setError(null) }}
        onConfirm={async (companyId) => {
          setIsLoading(true)
          setError(null)
          try {
            const supabase = createClient()
            const { data: userData, error: userError } = await supabase.auth.getUser()
            if (userError || !userData.user) throw new Error('Not authenticated')

            const contactId = await createContactFromCandidate(candidateId, companyId, userData.user.id)
            setNewContactId(contactId)
            setNewCompanyId(companyId)
            setShowModal(false)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create contact')
          } finally {
            setIsLoading(false)
          }
        }}
      />
    </>
  )
}

// ─── Company Select Modal ──────────────────────────────────────────────────

interface CompanySelectModalProps {
  open: boolean
  candidateId: string
  candidateName: string
  isLoading: boolean
  error: string | null
  onClose: () => void
  onConfirm: (companyId: string) => void
}

function CompanySelectModal({
  open,
  candidateName,
  isLoading,
  error,
  onClose,
  onConfirm,
}: CompanySelectModalProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSelectedCompanyId(null)
      return
    }
    setCompaniesLoading(true)
    fetchCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]))
      .finally(() => setCompaniesLoading(false))
  }, [open])

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a Company</DialogTitle>
          <DialogDescription>
            Which company should {candidateName} be added to as a contact?
          </DialogDescription>
        </DialogHeader>

        {companiesLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Command className="rounded-lg border">
            <CommandInput placeholder="Type to search..." />
            <CommandList>
              <CommandEmpty>No companies found.</CommandEmpty>
              <CommandGroup>
                {companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={company.name}
                    data-checked={selectedCompanyId === company.id || undefined}
                    onSelect={() => setSelectedCompanyId(company.id)}
                  >
                    <span className="flex-1">{company.name}</span>
                    <CompanyStatusBadge status={company.status} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedCompanyId && onConfirm(selectedCompanyId)}
            disabled={!selectedCompanyId || isLoading}
          >
            {isLoading
              ? 'Creating...'
              : selectedCompany
                ? `Create Contact at ${selectedCompany.name}`
                : 'Select a company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
