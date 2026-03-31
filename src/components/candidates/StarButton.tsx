'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleStar } from '@/lib/supabase/candidates-client'

interface StarButtonProps {
  candidateId: string
  initialIsStar: boolean
}

export function StarButton({ candidateId, initialIsStar }: StarButtonProps) {
  const [isStar, setIsStar] = useState(initialIsStar)

  function handleClick() {
    const newValue = !isStar
    setIsStar(newValue)
    toggleStar(candidateId, newValue).catch(() => setIsStar(!newValue))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isStar ? 'Unstar candidate' : 'Star candidate'}
      className="rounded-md p-1 hover:bg-accent transition-colors"
    >
      <Star className={cn('h-5 w-5', isStar ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
    </button>
  )
}
