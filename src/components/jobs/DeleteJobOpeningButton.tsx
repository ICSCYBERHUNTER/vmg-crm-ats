'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteJobOpening } from '@/lib/supabase/job-openings'

interface DeleteJobOpeningButtonProps {
  id: string
  title: string
}

export function DeleteJobOpeningButton({ id, title }: DeleteJobOpeningButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${title}"?\n\nThis will permanently delete this job opening and all associated pipeline stages and candidate applications. This action cannot be undone.`
    )
    if (!confirmed) return

    setIsDeleting(true)
    setError(null)
    try {
      await deleteJobOpening(id)
      router.push('/jobs')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
        <Trash2 className="mr-1.5 h-4 w-4" />
        {isDeleting ? 'Deleting...' : 'Delete'}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
