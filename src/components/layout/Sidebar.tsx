'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Building2, Briefcase, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: typeof Users
  enabled: boolean
  badge?: string
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    enabled: true,
  },
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
    enabled: true,
  },
  {
    label: 'Jobs',
    href: '/jobs',
    icon: Briefcase,
    enabled: true,
  },
  {
    label: 'Search',
    href: '/search',
    icon: Search,
    enabled: true,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-card">
      {/* Logo / brand area */}
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <Image
            src="/vmg-crosshair.png.png"
            alt="VMG logo"
            width={36}
            height={36}
          />
        </div>
        <div className="mt-1">
          <p className="text-sm font-semibold leading-none text-foreground">VMG</p>
          <p className="text-xs leading-none text-muted-foreground">Recruiting CRM</p>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)

          if (!item.enabled) {
            return (
              <div
                key={item.href}
                className="flex cursor-not-allowed select-none items-center gap-3 rounded-lg px-3 py-2 text-sm"
                style={{ color: 'oklch(0.552 0.016 286)' }}
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
                  ? 'bg-accent text-primary'
                  : 'hover:bg-accent'
              )}
              style={!isActive ? { color: 'oklch(0.591 0.007 286)' } : undefined}
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
