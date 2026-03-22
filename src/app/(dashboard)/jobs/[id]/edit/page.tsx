// Server Component — fetches job opening and passes it to the form for editing.

import Link from 'next/link'
import { getJobOpeningById } from '@/lib/supabase/job-openings-server'
import { JobOpeningForm } from '@/components/jobs/JobOpeningForm'
import { Button } from '@/components/ui/button'

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const job = await getJobOpeningById(id).catch(() => null)

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-semibold">Job Opening Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This job opening may have been deleted or the link is incorrect.
        </p>
        <Link href="/jobs" className="mt-6">
          <Button variant="outline">Back to Job Openings</Button>
        </Link>
      </div>
    )
  }

  return <JobOpeningForm job={job} />
}
