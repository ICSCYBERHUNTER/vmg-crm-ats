'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCandidatePoolMemberships } from '@/lib/supabase/talent-pools'
import type { CandidatePoolMembership } from '@/lib/supabase/talent-pools'
import { AddToPoolButton } from './AddToPoolButton'

interface CandidatePoolSectionProps {
  candidateId: string
}

export function CandidatePoolSection({ candidateId }: CandidatePoolSectionProps) {
  const [memberships, setMemberships] = useState<CandidatePoolMembership[]>([])

  useEffect(() => {
    getCandidatePoolMemberships(candidateId)
      .then(setMemberships)
      .catch(() => {/* silently skip — pills are supplemental */})
  }, [candidateId])

  function handleMembershipChange() {
    getCandidatePoolMemberships(candidateId)
      .then(setMemberships)
      .catch(() => {})
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AddToPoolButton
        candidateId={candidateId}
        onMembershipChange={handleMembershipChange}
      />
      {memberships.map((m) => (
        <Link
          key={m.pool_id}
          href={`/talent-pools/${m.pool_id}`}
          className="inline-flex items-center rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-300"
        >
          {m.pool_name}
        </Link>
      ))}
    </div>
  )
}
