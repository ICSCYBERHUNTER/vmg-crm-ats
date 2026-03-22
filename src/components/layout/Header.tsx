import { Suspense } from 'react'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { SearchBar } from '@/components/layout/SearchBar'

interface HeaderProps {
  userEmail: string
}

export function Header({ userEmail }: HeaderProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4">
      {/* Left side: visible only on mobile (desktop shows the sidebar logo) */}
      <span className="font-semibold tracking-tight md:hidden">VMG CRM</span>

      {/* Center: global search bar */}
      <div className="hidden flex-1 justify-center sm:flex">
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>

      {/* Right side: user info + logout */}
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:block">
          {userEmail}
        </span>
        <LogoutButton />
      </div>
    </header>
  )
}
