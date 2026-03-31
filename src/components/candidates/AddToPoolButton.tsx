'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Check, FolderPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getTalentPools,
  getCandidatePoolMemberships,
  addCandidateToPool,
  removeCandidateFromPool,
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
  const [pools, setPools] = useState<TalentPoolWithCount[]>([])
  const [memberPoolIds, setMemberPoolIds] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

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

  return (
    <Popover>
      <PopoverTrigger
        onClick={loadData}
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact
            ? 'h-7 w-7 justify-center p-0'
            : 'h-9 px-3 py-2'
        )}
        aria-label="Add to talent pool"
      >
        <FolderPlus className={cn('shrink-0', compact ? 'h-4 w-4' : 'h-4 w-4')} />
        {!compact && <span>Add to Pool</span>}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 p-1">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : pools.length === 0 ? (
          <div className="px-2 py-3 text-center">
            <p className="text-sm text-muted-foreground">No pools yet</p>
            <Link
              href="/talent-pools"
              className="mt-1 block text-xs text-blue-400 hover:underline"
            >
              Create a pool
            </Link>
          </div>
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
      </PopoverContent>
    </Popover>
  )
}
