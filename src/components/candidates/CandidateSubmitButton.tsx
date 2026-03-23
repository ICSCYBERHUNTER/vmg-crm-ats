'use client'

import { useRouter } from 'next/navigation'
import { SubmitToJobDialog } from './SubmitToJobDialog'

export function CandidateSubmitButton({ candidateId }: { candidateId: string }) {
  const router = useRouter()
  return (
    <SubmitToJobDialog
      candidateId={candidateId}
      onSubmitted={() => router.refresh()}
    />
  )
}
