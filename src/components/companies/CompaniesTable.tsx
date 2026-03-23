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
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { Company } from '@/types/database'
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

function DueDate({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-muted-foreground">—</span>
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (date < today) return <span className="font-medium text-red-400">{formatted}</span>
  if (date.getTime() === today.getTime()) return <span className="font-medium text-amber-400">{formatted}</span>
  return <span>{formatted}</span>
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
  columnHelper.accessor('next_step', {
    header: 'Next Step',
    enableSorting: false,
    cell: ({ getValue }) => {
      const v = getValue()
      if (!v) return <span className="text-muted-foreground">—</span>
      return <span className="max-w-[200px] truncate block" title={v}>{v}</span>
    },
  }),
  columnHelper.accessor('next_step_due_date', {
    header: 'Due',
    cell: ({ getValue }) => <DueDate dateStr={getValue()} />,
  }),
  columnHelper.accessor('last_contacted_at', {
    header: 'Last Contact',
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{formatRelativeTime(getValue())}</span>
    ),
  }),
  columnHelper.accessor(
    (row) => [row.hq_city, row.hq_state].filter(Boolean).join(', '),
    {
      id: 'location',
      header: 'Location',
      enableSorting: false,
      cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span>,
    }
  ),
]

// ─── Table component ──────────────────────────────────────────────────────────

interface CompaniesTableProps {
  data: Company[]
}

export function CompaniesTable({ data }: CompaniesTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'priority', desc: false },
    { id: 'name', desc: false },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

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

  const statusFilter = (table.getColumn('status')?.getFilterValue() as string) ?? 'all'
  const priorityFilter = (table.getColumn('priority')?.getFilterValue() as string) ?? 'all'
  const stageFilter = (table.getColumn('prospect_stage')?.getFilterValue() as string) ?? 'all'

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
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="former_client">Former Client</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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

        <Select
          value={stageFilter}
          onValueChange={(v) => table.getColumn('prospect_stage')?.setFilterValue(v === 'all' ? undefined : v)}
        >
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
          {table.getFilteredRowModel().rows.length} compan{table.getFilteredRowModel().rows.length !== 1 ? 'ies' : 'y'}
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
