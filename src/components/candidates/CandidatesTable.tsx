'use client'

import { useState, useEffect, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
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
  initialCount: number
  pageSize: number
}

export function CandidatesTable({ initialData, initialCount, pageSize }: CandidatesTableProps) {
  const [data, setData] = useState<Candidate[]>(initialData)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [page, setPage] = useState(1)

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

  // Fetch on filter or page change (skip initial mount — use server-fetched initialData)
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
      page,
      pageSize,
    })
      .then(({ data: rows, count }) => {
        setData(rows)
        setTotalCount(count)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [status, category, seniority, region, skills, page, pageSize])

  const hasFilters = !!(status || category || seniority || region || skillsInput)

  function clearFilters() {
    setStatus(''); setCategory(''); setSeniority(''); setRegion('')
    setSkillsInput('')
    setPage(1)
  }

  // Filter change helpers — reset page to 1 alongside filter change
  function handleStatusChange(v: string) { setStatus(v); setPage(1) }
  function handleCategoryChange(v: string) { setCategory(v); setPage(1) }
  function handleSeniorityChange(v: string) { setSeniority(v); setPage(1) }
  function handleRegionChange(v: string) { setRegion(v); setPage(1) }
  function handleSkillsChange(v: string) { setSkillsInput(v); setPage(1) }

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)

  return (
    <div className="space-y-4">
      <CandidateFilterBar
        status={status} category={category} seniority={seniority}
        region={region} skillsInput={skillsInput}
        hasFilters={hasFilters}
        onStatusChange={handleStatusChange} onCategoryChange={handleCategoryChange}
        onSeniorityChange={handleSeniorityChange} onRegionChange={handleRegionChange}
        onSkillsChange={handleSkillsChange}
        onClear={clearFilters}
      />

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
          {totalCount === 0
            ? 'No candidates'
            : `Showing ${rangeStart}–${rangeEnd} of ${totalCount} candidate${totalCount !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1 || loading}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
