'use client'

import { useState } from 'react'
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
} from '@tanstack/react-table'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { Candidate } from '@/types/database'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function formatDate(value: string | null): string {
  if (!value) return 'Never'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const columnHelper = createColumnHelper<Candidate>()

const columns = [
  columnHelper.accessor((row) => `${row.first_name} ${row.last_name}`, {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link
        href={`/candidates/${row.original.id}`}
        className="font-medium hover:underline"
      >
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
    enableSorting: true,
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
  data: Candidate[]
}

export function CandidatesTable({ data }: CandidatesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
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
    initialState: { pagination: { pageSize: 10 } },
  })

  const statusFilterValue = (table.getColumn('status')?.getFilterValue() as string) ?? 'all'

  return (
    <div className="space-y-4">
      <Select
        value={statusFilterValue}
        onValueChange={(value) => {
          table.getColumn('status')?.setFilterValue(value === 'all' ? undefined : value)
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="passive">Passive</SelectItem>
          <SelectItem value="placed">Placed</SelectItem>
          <SelectItem value="do_not_contact">Do Not Contact</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.column.getCanSort() ? (
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
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
                  No candidates match this filter.
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
          {table.getFilteredRowModel().rows.length} candidate(s)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
