'use client'

import { useState, useEffect, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { Candidate } from '@/types/database'
import { getCandidatesFiltered } from '@/lib/supabase/candidates-client'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CandidateFilterBar } from '@/components/candidates/CandidateFilterBar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

function formatDate(value: string | null): string {
  if (!value) return 'Never'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const columnHelper = createColumnHelper<Candidate>()

const columns = [
  columnHelper.accessor((row) => `${row.first_name} ${row.last_name}`, {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link href={`/candidates/${row.original.id}`} className="font-medium hover:underline">
        {row.original.first_name} {row.original.last_name}
      </Link>
    ),
  }),
  columnHelper.accessor('current_title', {
    header: 'Title',
    cell: ({ getValue }) => getValue() ?? '—',
  }),
  columnHelper.accessor('current_company', {
    header: 'Company',
    cell: ({ getValue }) => getValue() ?? '—',
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  }),
  columnHelper.accessor(
    (row) => [row.location_city, row.location_state].filter(Boolean).join(', '),
    {
      id: 'location',
      header: 'Location',
      cell: ({ getValue }) => (getValue() as string) || '—',
      enableSorting: false,
    }
  ),
  columnHelper.accessor('last_contacted_at', {
    header: 'Last Contacted',
    cell: ({ getValue }) => formatDate(getValue()),
    enableSorting: false,
  }),
]

interface CandidatesTableProps {
  initialData: Candidate[]
  totalCount: number
}

export function CandidatesTable({ initialData, totalCount }: CandidatesTableProps) {
  const [data, setData] = useState<Candidate[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  // Dropdown filters — trigger fetch immediately
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [seniority, setSeniority] = useState('')
  const [region, setRegion] = useState('')

  // Text inputs — debounced
  const [skillsInput, setSkillsInput] = useState('')
  const [skills, setSkills] = useState('')

  const isInitialMount = useRef(true)

  // Debounce skills
  useEffect(() => {
    const t = setTimeout(() => setSkills(skillsInput), 300)
    return () => clearTimeout(t)
  }, [skillsInput])

  // Fetch on filter change (skip initial mount — use server-fetched initialData)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setLoading(true)
    getCandidatesFiltered({
      status: status || undefined,
      category: category || undefined,
      seniority: seniority || undefined,
      region: region || undefined,
      skills: skills || undefined,
    })
      .then((result) => { setData(result); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, category, seniority, region, skills])

  const hasFilters = !!(status || category || seniority || region || skillsInput)

  function clearFilters() {
    setStatus(''); setCategory(''); setSeniority(''); setRegion('')
    setSkillsInput('')
  }

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  return (
    <div className="space-y-4">
      <CandidateFilterBar
        status={status} category={category} seniority={seniority}
        region={region} skillsInput={skillsInput}
        hasFilters={hasFilters}
        onStatusChange={setStatus} onCategoryChange={setCategory}
        onSeniorityChange={setSeniority} onRegionChange={setRegion}
        onSkillsChange={setSkillsInput}
        onClear={clearFilters}
      />

      {/* Result count */}
      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? `Showing ${data.length} of ${totalCount} candidates (filtered)`
          : `${data.length} candidate${data.length !== 1 ? 's' : ''}`}
      </p>

      <div className={`rounded-md border transition-opacity ${loading ? 'opacity-50' : ''}`}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs uppercase tracking-wide text-muted-foreground">
                    {header.column.getCanSort() ? (
                      <button className="flex items-center gap-1 hover:text-foreground" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? <ChevronUp className="h-3 w-3" />
                          : header.column.getIsSorted() === 'desc' ? <ChevronDown className="h-3 w-3" />
                          : <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {hasFilters ? 'No candidates match these filters.' : 'No candidates yet.'}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
        </div>
      </div>
    </div>
  )
}
