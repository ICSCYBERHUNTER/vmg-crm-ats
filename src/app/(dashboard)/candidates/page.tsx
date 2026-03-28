import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'
import { getCandidates } from '@/lib/supabase/candidates'
import { CandidatesTable } from '@/components/candidates/CandidatesTable'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 25

export default async function CandidatesPage() {
  let candidates
  let totalCount

  try {
    const result = await getCandidates(1, PAGE_SIZE)
    candidates = result.data
    totalCount = result.count
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
        <div className="flex items-center gap-2">
          <Link href="/candidates/import">
            <Button variant="outline" size="sm">
              <Upload className="mr-1.5 h-4 w-4" />
              Upload Resume
            </Button>
          </Link>
          <Link href="/candidates/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New Candidate
            </Button>
          </Link>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="font-medium text-muted-foreground">No candidates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first candidate to get started.
          </p>
        </div>
      ) : (
        <CandidatesTable initialData={candidates} initialCount={totalCount} pageSize={PAGE_SIZE} />
      )}
    </div>
  )
}
