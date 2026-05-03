'use client'

import { Settings } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SettingsButton() {
  return (
    <Link
      href="/settings"
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        'gap-2 text-muted-foreground hover:text-foreground'
      )}
    >
      <Settings className="h-4 w-4" />
      <span className="hidden sm:inline">Settings</span>
    </Link>
  )
}
