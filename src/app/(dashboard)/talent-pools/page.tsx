'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getTalentPools, createTalentPool } from '@/lib/supabase/talent-pools'
import type { TalentPoolWithCount } from '@/types/database'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return '—'
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}

export default function TalentPoolsPage() {
  const [pools, setPools] = useState<TalentPoolWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)

  async function loadPools() {
    setLoading(true)
    setError(false)
    try {
      const data = await getTalentPools()
      setPools(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPools()
  }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createTalentPool({ name: newName.trim(), description: newDescription.trim() || null })
      toast.success('Pool created')
      setCreateOpen(false)
      setNewName('')
      setNewDescription('')
      loadPools()
    } catch {
      toast.error('Failed to create pool')
    } finally {
      setCreating(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Talent Pools</h1>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">
            Failed to load talent pools. Check your Supabase connection and try refreshing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Talent Pools</h1>
          <p className="text-sm text-muted-foreground">
            {pools.length} pool{pools.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Pool
        </Button>
      </div>

      {/* Empty state */}
      {pools.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="font-medium text-muted-foreground">No talent pools yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one to start grouping candidates.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pool Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Candidates</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pools.map((pool) => (
              <TableRow key={pool.id}>
                <TableCell>
                  <Link
                    href={`/talent-pools/${pool.id}`}
                    className="font-medium text-blue-400 hover:underline"
                  >
                    {pool.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {truncate(pool.description, 80)}
                </TableCell>
                <TableCell className="text-right">{pool.member_count}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(pool.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create Pool Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Talent Pool</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pool-name">Name</Label>
              <Input
                id="pool-name"
                placeholder="e.g. Senior Sales Engineers"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) handleCreate()
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pool-description">Description (optional)</Label>
              <Textarea
                id="pool-description"
                placeholder="What is this pool for?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
