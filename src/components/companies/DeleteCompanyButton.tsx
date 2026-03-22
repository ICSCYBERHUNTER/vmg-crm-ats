'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteCompany } from '@/lib/supabase/companies-client'

interface DeleteCompanyButtonProps {
  id: string
  name: string
}

export function DeleteCompanyButton({ id, name }: DeleteCompanyButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const confirmed = window.confirm(`Delete "${name}"?\n\nThis cannot be undone.`)
    if (!confirmed) return

    setIsDeleting(true)
    setError(null)
    try {
      await deleteCompany(id)
      router.push('/companies')
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
