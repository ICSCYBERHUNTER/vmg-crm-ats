import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCandidates, getCandidatesCount } from '@/lib/supabase/candidates'
import { CandidatesTable } from '@/components/candidates/CandidatesTable'
import { Button } from '@/components/ui/button'

export default async function CandidatesPage() {
  let candidates
  let totalCount

  try {
    ;[candidates, totalCount] = await Promise.all([
      getCandidates(),
      getCandidatesCount(),
    ])
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Candidates</h1>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">
            Failed to load candidates. Check your Supabase connection and try refreshing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Candidates</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} candidate{totalCount !== 1 ? 's' : ''} in your database
          </p>
        </div>
        <Link href="/candidates/new">
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Candidate
          </Button>
        </Link>
      </div>

      {totalCount === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="font-medium text-muted-foreground">No candidates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first candidate to get started.
          </p>
        </div>
      ) : (
        <CandidatesTable initialData={candidates} totalCount={totalCount} />
      )}
    </div>
  )
}
