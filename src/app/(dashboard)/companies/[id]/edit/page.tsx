// Server Component — fetches the company, then renders the form pre-filled.
// CompanyForm handles the actual update and redirect when submitted.

import Link from 'next/link'
import { getCompanyById } from '@/lib/supabase/companies'
import { CompanyForm } from '@/components/companies/CompanyForm'
import { Button } from '@/components/ui/button'

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const company = await getCompanyById(id).catch(() => null)

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-semibold">Company Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This company may have been deleted or the link is incorrect.
        </p>
        <Link href="/companies" className="mt-6">
          <Button variant="outline">Back to Companies</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="py-2">
      <CompanyForm company={company} />
    </div>
  )
}
