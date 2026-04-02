'use client'

import { useState, useCallback } from 'react'
import { Check, FolderPlus, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  getTalentPools,
  getCandidatePoolMemberships,
  addCandidateToPool,
  removeCandidateFromPool,
  createTalentPool,
} from '@/lib/supabase/talent-pools'
import type { TalentPoolWithCount } from '@/types/database'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface AddToPoolButtonProps {
  candidateId: string
  /** compact=true renders just the icon (for table rows) */
  compact?: boolean
  /** Called after any membership change so a parent can refresh display */
  onMembershipChange?: () => void
}

export function AddToPoolButton({
  candidateId,
  compact = false,
  onMembershipChange,
}: AddToPoolButtonProps) {
  const [open, setOpen] = useState(false)
  const [pools, setPools] = useState<TalentPoolWithCount[]>([])
  const [memberPoolIds, setMemberPoolIds] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  // Create-view state
  const [view, setView] = useState<'list' | 'create'>('list')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const loadData = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const [allPools, memberships] = await Promise.all([
        getTalentPools(),
        getCandidatePoolMemberships(candidateId),
      ])
      setPools(allPools)
      setMemberPoolIds(new Set(memberships.map((m) => m.pool_id)))
      setLoaded(true)
    } catch {
      toast.error('Failed to load pools')
    } finally {
      setLoading(false)
    }
  }, [candidateId, loaded])

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset to list view every time the popover opens
      setView('list')
      setNewName('')
      setNewDescription('')
      loadData()
    }
    setOpen(next)
  }

  async function handleToggle(pool: TalentPoolWithCount) {
    if (toggling) return
    const isMember = memberPoolIds.has(pool.id)
    setToggling(pool.id)

    // Optimistic update
    const next = new Set(memberPoolIds)
    isMember ? next.delete(pool.id) : next.add(pool.id)
    setMemberPoolIds(next)

    try {
      if (isMember) {
        await removeCandidateFromPool(pool.id, candidateId)
        toast.success(`Removed from "${pool.name}"`)
      } else {
        await addCandidateToPool(pool.id, candidateId)
        toast.success(`Added to "${pool.name}"`)
      }
      onMembershipChange?.()
    } catch {
      // Rollback
      const rolled = new Set(memberPoolIds)
      setMemberPoolIds(rolled)
      toast.error('Failed to update pool')
    } finally {
      setToggling(null)
    }
  }

  async function handleCreateAndAdd() {
    const name = newName.trim()
    if (!name) return

    setCreating(true)
    try {
      const newPool = await createTalentPool({
        name,
        description: newDescription.trim() || null,
      })
      await addCandidateToPool(newPool.id, candidateId)

      // Update local pool list and membership set
      const poolWithCount: TalentPoolWithCount = { ...newPool, member_count: 1 }
      setPools((prev) => [...prev, poolWithCount].sort((a, b) => a.name.localeCompare(b.name)))
      setMemberPoolIds((prev) => new Set([...prev, newPool.id]))

      toast.success(`Created "${name}" and added candidate`)
      onMembershipChange?.()
      setOpen(false)
    } catch {
      toast.error('Failed to create pool')
    } finally {
      setCreating(false)
    }
  }

  function handleCancelCreate() {
    setView('list')
    setNewName('')
    setNewDescription('')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact
            ? 'h-7 w-7 justify-center p-0'
            : 'h-9 px-3 py-2'
        )}
        aria-label="Add to talent pool"
      >
        <FolderPlus className="h-4 w-4 shrink-0" />
        {!compact && <span>Add to Pool</span>}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-1">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : view === 'create' ? (
          <div className="p-2 flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">New Talent Pool</p>
            <input
              type="text"
              placeholder="Pool name *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={handleCancelCreate}
                disabled={creating}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAndAdd}
                disabled={creating || !newName.trim()}
                className="flex-1 rounded-md bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Create & Add'
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setView('create')}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-blue-400 hover:bg-accent transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create New Pool
            </button>
            {pools.length > 0 && <div className="my-1 border-t border-border" />}
            {pools.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted-foreground">No pools yet</p>
            ) : (
              pools.map((pool) => {
                const isMember = memberPoolIds.has(pool.id)
                const isToggling = toggling === pool.id
                return (
                  <button
                    key={pool.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                      isMember && 'text-muted-foreground'
                    )}
                    onClick={() => handleToggle(pool)}
                    disabled={isToggling}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {isToggling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isMember ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : null}
                    </span>
                    <span className="flex-1 truncate">{pool.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ({pool.member_count})
                    </span>
                  </button>
                )
              })
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
