import { JobOpeningForm } from '@/components/jobs/JobOpeningForm'

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string }>
}) {
  const { company_id } = await searchParams
  return <JobOpeningForm lockedCompanyId={company_id ?? null} />
}
