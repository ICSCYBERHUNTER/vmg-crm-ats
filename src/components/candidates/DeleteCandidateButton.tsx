'use client'

// Client component that handles the delete confirmation and redirect.
// The detail page (Server Component) renders this and passes the candidate id.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteCandidate } from '@/lib/supabase/candidates-client'

interface DeleteCandidateButtonProps {
  id: string
  name: string
}

export function DeleteCandidateButton({ id, name }: DeleteCandidateButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${name}"?\n\nThis cannot be undone.`
    )
    if (!confirmed) return

    setIsDeleting(true)
    setError(null)
    try {
      await deleteCandidate(id)
      router.push('/candidates')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        {isDeleting ? 'Deleting...' : 'Delete'}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
