'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import {
  searchUnlinkedCandidates,
  type UnlinkedCandidateResult,
} from '@/lib/supabase/candidates-client'
import { createContactFromCandidate } from '@/lib/supabase/linking'
import type { ContactType } from '@/types/database'

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'decision_maker', label: 'Decision Maker' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'champion', label: 'Champion' },
  { value: 'gatekeeper', label: 'Gatekeeper' },
]

interface LinkCandidateButtonProps {
  companyId: string
}

export function LinkCandidateButton({ companyId }: LinkCandidateButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<UnlinkedCandidateResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<UnlinkedCandidateResult | null>(null)
  const [contactType, setContactType] = useState<ContactType | ''>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successName, setSuccessName] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchTerm('')
      setResults([])
      setSelected(null)
      setContactType('')
      setError(null)
      setSuccessName(null)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchTerm.trim() || selected) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const found = await searchUnlinkedCandidates(searchTerm)
        setResults(found)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchTerm, selected])

  async function handleLink() {
    if (!selected || !contactType) return
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw new Error('Not authenticated')

      // Create the contact + bidirectional link using existing RPC
      const contactId = await createContactFromCandidate(selected.id, companyId, userData.user.id)

      // Set the contact_type the user selected (RPC defaults to a generic value)
      const { error: updateError } = await supabase
        .from('company_contacts')
        .update({ contact_type: contactType })
        .eq('id', contactId)

      if (updateError) throw new Error(updateError.message)

      setSuccessName(selected.full_name)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link candidate')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="mr-1.5 h-4 w-4" />
        Link Candidate
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link existing candidate as contact</DialogTitle>
            <DialogDescription>
              Search for a candidate to add as a contact. Their info will be copied from their candidate record.
            </DialogDescription>
          </DialogHeader>

          {successName ? (
            <p className="text-sm text-green-500">Linked {successName} as contact.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Search input */}
              <div className="flex flex-col gap-1.5">
                <Label>Search candidates by name</Label>
                <Input
                  placeholder="Search candidates by name..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSelected(null)
                    setSearchTerm(e.target.value)
                  }}
                  autoFocus
                />
              </div>

              {/* Results list */}
              {searchTerm.trim() && !selected && (
                <div className="border border-border rounded-md overflow-hidden">
                  {searching ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No unlinked candidates found.
                    </p>
                  ) : (
                    results.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                        onClick={() => {
                          setSelected(c)
                          setSearchTerm(c.full_name)
                        }}
                      >
                        <span className="font-medium">{c.full_name}</span>
                        {(c.current_title || c.current_company) && (
                          <span className="text-muted-foreground ml-2">
                            {[c.current_title, c.current_company]
                              .filter(Boolean)
                              .join(' at ')}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected candidate preview */}
              {selected && (
                <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm flex flex-col gap-1">
                  <p className="font-medium">{selected.full_name}</p>
                  {(selected.current_title || selected.current_company) && (
                    <p className="text-muted-foreground">
                      {[selected.current_title, selected.current_company]
                        .filter(Boolean)
                        .join(' at ')}
                    </p>
                  )}
                  {selected.email && <p>{selected.email}</p>}
                  {selected.phone && <p>{selected.phone}</p>}
                  {selected.linkedin_url && (
                    <p className="text-blue-400 truncate">{selected.linkedin_url}</p>
                  )}
                </div>
              )}

              {/* Contact type picker — only shown after a candidate is selected */}
              {selected && (
                <div className="flex flex-col gap-1.5">
                  <Label>Contact Type</Label>
                  <Select
                    value={contactType}
                    onValueChange={(v) => setContactType(v as ContactType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              {successName ? 'Close' : 'Cancel'}
            </Button>
            {!successName && (
              <Button
                onClick={handleLink}
                disabled={!selected || !contactType || isLoading}
              >
                {isLoading ? 'Linking...' : 'Link as Contact'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
