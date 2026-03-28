import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCompanies } from '@/lib/supabase/companies'
import { CompaniesTable } from '@/components/companies/CompaniesTable'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 25

export default async function CompaniesPage() {
  let companies
  let totalCount

  try {
    const result = await getCompanies(1, PAGE_SIZE)
    companies = result.data
    totalCount = result.count
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load companies. Check your Supabase connection and try refreshing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} compan{totalCount !== 1 ? 'ies' : 'y'} in your database
          </p>
        </div>
        <Link href="/companies/new">
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Company
          </Button>
        </Link>
      </div>

      {totalCount === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="font-medium text-muted-foreground">No companies yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first target company to get started.
          </p>
        </div>
      ) : (
        <CompaniesTable initialData={companies} initialCount={totalCount} pageSize={PAGE_SIZE} />
      )}
    </div>
  )
}
