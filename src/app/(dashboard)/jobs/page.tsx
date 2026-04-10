import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getJobOpenings } from '@/lib/supabase/job-openings-server'
import { JobOpeningsTable } from '@/components/jobs/JobOpeningsTable'
import { Button } from '@/components/ui/button'

export default async function JobsPage() {
  let jobs

  try {
    jobs = await getJobOpenings()
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Job Openings</h1>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load job openings. Check your Supabase connection and try refreshing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job Openings</h1>
          <p className="text-sm text-muted-foreground">
            {jobs.length} job opening{jobs.length !== 1 ? 's' : ''} in your database
          </p>
        </div>
        <Link href="/jobs/new">
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Job Opening
          </Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="font-medium text-muted-foreground">No job openings yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first job opening to start tracking your pipeline.
          </p>
        </div>
      ) : (
        <JobOpeningsTable data={jobs} />
      )}
    </div>
  )
}
