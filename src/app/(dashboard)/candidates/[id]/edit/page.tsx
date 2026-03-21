// Server Component — fetches the candidate, then renders the form pre-filled.
// CandidateForm handles the actual update and redirect when submitted.

import Link from 'next/link'
import { getCandidateById } from '@/lib/supabase/candidates'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import { Button } from '@/components/ui/button'

export default async function EditCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const candidate = await getCandidateById(id).catch(() => null)

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-semibold">Candidate Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This candidate may have been deleted or the link is incorrect.
        </p>
        <Link href="/candidates" className="mt-6">
          <Button variant="outline">Back to Candidates</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="py-2">
      <CandidateForm candidate={candidate} />
    </div>
  )
}
