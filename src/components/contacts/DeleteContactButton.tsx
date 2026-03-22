'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteContact } from '@/lib/supabase/contacts-client'

interface DeleteContactButtonProps {
  id: string
  companyId: string
  name: string
}

export function DeleteContactButton({ id, companyId, name }: DeleteContactButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${name}"?\n\nThis will permanently delete this contact. Any contacts who report to this person will have their reporting relationship cleared.\n\nThis cannot be undone.`
    )
    if (!confirmed) return

    setIsDeleting(true)
    setError(null)
    try {
      await deleteContact(id)
      router.push(`/companies/${companyId}`)
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
