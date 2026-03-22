'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Link2, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { createCandidateFromContact, unlinkCandidateContact } from '@/lib/supabase/linking'

interface ContactLinkingSectionProps {
  contactId: string
  contactName: string
  linkedCandidateId: string | null
}

export function ContactLinkingSection({
  contactId,
  contactName,
  linkedCandidateId,
}: ContactLinkingSectionProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showUnlink, setShowUnlink] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCandidateId, setNewCandidateId] = useState<string | null>(null)

  async function handleCreate() {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw new Error('Not authenticated')

      const candidateId = await createCandidateFromContact(contactId, userData.user.id)
      setNewCandidateId(candidateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create candidate')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUnlink() {
    if (!linkedCandidateId) return
    setIsLoading(true)
    setError(null)
    try {
      await unlinkCandidateContact(linkedCandidateId, contactId)
      setShowUnlink(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink')
    } finally {
      setIsLoading(false)
    }
  }

  // Success state — show navigation options
  if (newCandidateId) {
    return (
      <Dialog open onOpenChange={() => { setNewCandidateId(null); router.refresh() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Candidate Created</DialogTitle>
            <DialogDescription>
              A candidate record has been created for {contactName}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setNewCandidateId(null); router.refresh() }}>
              Stay Here
            </Button>
            <Link href={`/candidates/${newCandidateId}`}>
              <Button>View Candidate</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Linked state — show indicator
  if (linkedCandidateId) {
    return (
      <>
        <div className="flex items-center gap-3 rounded-md border-l-4 border-blue-500 bg-blue-950/30 px-4 py-3">
          <Link2 className="h-4 w-4 shrink-0 text-blue-400" />
          <span className="text-sm">Also a Candidate</span>
          <Link
            href={`/candidates/${linkedCandidateId}`}
            className="ml-auto text-sm text-primary hover:underline"
          >
            View Candidate Record &rarr;
          </Link>
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
      <Button variant="outline" size="sm" onClick={() => setShowConfirm(true)}>
        <UserPlus className="mr-1.5 h-4 w-4" />
        Also Create as Candidate
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Candidate Record</DialogTitle>
            <DialogDescription>
              Create a candidate record for {contactName}? The new candidate will be
              pre-filled with this contact&apos;s information and linked to this contact record.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Candidate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
