'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  type SortingFn,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle } from 'lucide-react'
import type { JobOpening } from '@/types/database'
import { JobStatusBadge } from '@/components/shared/JobStatusBadge'
import { LocationTypeBadge } from '@/components/shared/LocationTypeBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCompRange } from '@/lib/utils/labels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

const prioritySortFn: SortingFn<JobOpening> = (rowA, rowB) => {
  const a = PRIORITY_ORDER[rowA.original.priority ?? ''] ?? 3
  const b = PRIORITY_ORDER[rowB.original.priority ?? ''] ?? 3
  return a - b
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function LocationCell({ job }: { job: JobOpening }) {
  if (job.location_type === 'remote') {
    return <LocationTypeBadge locationType="remote" />
  }
  const parts = [job.location_city, job.location_state].filter(Boolean).join(', ')
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      {parts && <span className="text-sm">{parts}</span>}
      {job.location_type && <LocationTypeBadge locationType={job.location_type} />}
    </span>
  )
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<JobOpening>()

const columns = [
  columnHelper.accessor('title', {
    header: 'Title',
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
  }),
  columnHelper.display({
    id: 'company',
    header: 'Company',
    enableSorting: false,
    cell: ({ row }) => {
      const { company_name, company_status } = row.original
      return (
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{company_name ?? '—'}</span>
          {company_status === 'prospect' && (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )}
        </span>
      )
    },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <JobStatusBadge status={getValue()} />,
  }),
  columnHelper.accessor('priority', {
    header: 'Priority',
    sortingFn: prioritySortFn,
    cell: ({ getValue }) => {
      const v = getValue()
      return v ? <PriorityBadge priority={v} /> : <span className="text-muted-foreground">—</span>
    },
  }),
  columnHelper.display({
    id: 'location',
    header: 'Location',
    enableSorting: false,
    cell: ({ row }) => <LocationCell job={row.original} />,
  }),
  columnHelper.display({
    id: 'comp_range',
    header: 'Comp Range',
    enableSorting: false,
    cell: ({ row }) => {
      const { comp_range_low, comp_range_high } = row.original
      const text = formatCompRange(comp_range_low, comp_range_high)
      return <span className="text-muted-foreground">{text}</span>
    },
  }),
  columnHelper.accessor('opened_at', {
    header: 'Opened',
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{formatDate(getValue())}</span>
    ),
  }),
]

// ─── Table component ──────────────────────────────────────────────────────────

export function JobOpeningsTable({ data }: { data: JobOpening[] }) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'priority', desc: false },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: 'status', value: 'open' },
  ])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const statusFilter = (table.getColumn('status')?.getFilterValue() as string) ?? 'open'
  const priorityFilter = (table.getColumn('priority')?.getFilterValue() as string) ?? 'all'

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={statusFilter}
          onValueChange={(v) => table.getColumn('status')?.setFilterValue(v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={(v) => table.getColumn('priority')?.setFilterValue(v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
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
                  No job openings match this filter.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => router.push(`/jobs/${row.original.id}`)}
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
          {table.getFilteredRowModel().rows.length} job opening{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
