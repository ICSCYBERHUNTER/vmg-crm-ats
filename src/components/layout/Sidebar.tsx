'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Building2, Briefcase, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// Phase 1: only Candidates is active. Others are shown greyed-out
// so the navigation structure is clear from day one.
const navItems = [
  {
    label: 'Candidates',
    href: '/candidates',
    icon: Users,
    enabled: true,
  },
  {
    label: 'Companies',
    href: '/companies',
    icon: Building2,
    enabled: false,
    badge: 'Phase 2',
  },
  {
    label: 'Jobs',
    href: '/jobs',
    icon: Briefcase,
    enabled: false,
    badge: 'Phase 3',
  },
  {
    label: 'Search',
    href: '/search',
    icon: Search,
    enabled: false,
    badge: 'Phase 4',
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card">
      {/* App name / logo area */}
      <div className="flex h-14 items-center border-b px-4">
        <span className="font-semibold tracking-tight">VMG CRM</span>
      </div>

      {/* Navigation links */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)

          if (!item.enabled) {
            // Greyed-out placeholder for future phases
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed select-none"
                title={`Coming in ${item.badge}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs">{item.badge}</span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
