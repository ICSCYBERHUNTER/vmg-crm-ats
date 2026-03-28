'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type SortingFn,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { Company } from '@/types/database'
import { getCompaniesFiltered } from '@/lib/supabase/companies-client'
import { CompanyStatusBadge } from '@/components/shared/CompanyStatusBadge'
import { PipelineStageBadge } from '@/components/shared/PipelineStageBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { label, COMPANY_TYPE_LABELS } from '@/lib/utils/labels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

const prioritySortFn: SortingFn<Company> = (rowA, rowB) => {
  const a = PRIORITY_ORDER[rowA.original.priority ?? ''] ?? 3
  const b = PRIORITY_ORDER[rowB.original.priority ?? ''] ?? 3
  return a - b
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 60) return '1 month ago'
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Company>()

const columns = [
  columnHelper.accessor('name', {
    header: 'Company',
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
  }),
  columnHelper.accessor('priority', {
    header: 'Priority',
    sortingFn: prioritySortFn,
    cell: ({ getValue }) => {
      const v = getValue()
      return v ? <PriorityBadge priority={v} /> : <span className="text-muted-foreground">—</span>
    },
  }),
  columnHelper.accessor('company_type', {
    header: 'Type',
    cell: ({ getValue }) => label(COMPANY_TYPE_LABELS, getValue()),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <CompanyStatusBadge status={getValue()} />,
  }),
  columnHelper.accessor('prospect_stage', {
    header: 'Stage',
    enableSorting: false,
    cell: ({ getValue }) => {
      const v = getValue()
      return v ? <PipelineStageBadge stage={v} /> : null
    },
  }),
  columnHelper.accessor('last_contacted_at', {
    header: 'Last Contact',
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{formatRelativeTime(getValue())}</span>
    ),
  }),
]

// ─── Table component ──────────────────────────────────────────────────────────

interface CompaniesTableProps {
  initialData: Company[]
  initialCount: number
  pageSize: number
}

export function CompaniesTable({ initialData, initialCount, pageSize }: CompaniesTableProps) {
  const router = useRouter()
  const [data, setData] = useState<Company[]>(initialData)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'priority', desc: false },
    { id: 'name', desc: false },
  ])
  const [page, setPage] = useState(1)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')

  const isInitialMount = useRef(true)

  // Fetch on filter or page change (skip initial mount — use server-fetched initialData)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setLoading(true)
    getCompaniesFiltered({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      prospectStage: stageFilter !== 'all' ? stageFilter : undefined,
      page,
      pageSize,
    })
      .then(({ data: rows, count }) => {
        setData(rows)
        setTotalCount(count)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [statusFilter, priorityFilter, stageFilter, page, pageSize])

  // Filter change helpers — reset page to 1 alongside filter change
  function handleStatusChange(v: string | null) { setStatusFilter(v ?? 'all'); setPage(1) }
  function handlePriorityChange(v: string | null) { setPriorityFilter(v ?? 'all'); setPage(1) }
  function handleStageChange(v: string | null) { setStageFilter(v ?? 'all'); setPage(1) }

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
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="former_client">Former Client</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={handlePriorityChange}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={handleStageChange}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Pipeline Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="researching">Researching</SelectItem>
            <SelectItem value="targeted">Targeted</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="negotiating_fee">Negotiating Fee</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className={`rounded-md border transition-opacity ${loading ? 'opacity-50' : ''}`}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs uppercase tracking-wide text-muted-foreground">
                    {header.column.getCanSort() ? (
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                        )}
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
                  No companies match this filter.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => router.push(`/companies/${row.original.id}`)}
                >
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount === 0
            ? 'No companies'
            : `Showing ${rangeStart}–${rangeEnd} of ${totalCount} compan${totalCount !== 1 ? 'ies' : 'y'}`}
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
