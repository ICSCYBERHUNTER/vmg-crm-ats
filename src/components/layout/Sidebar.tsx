'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Building2, Briefcase, Search, Layers, Linkedin, Compass, Newspaper, Bot, ExternalLink, Sparkles, MessageCircle } from 'lucide-react'
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
    label: 'Talent Pools',
    href: '/talent-pools',
    icon: Layers,
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

const quickLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com', icon: Linkedin },
  { label: 'Sales Navigator', href: 'https://www.linkedin.com/sales', icon: Compass },
  { label: 'Dark Reading', href: 'https://www.darkreading.com', icon: Newspaper },
  { label: 'Claude', href: 'https://claude.ai', icon: Bot },
  { label: 'Gemini', href: 'https://gemini.google.com', icon: Sparkles },
  { label: 'ChatGPT', href: 'https://chatgpt.com', icon: MessageCircle },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-card">
      {/* Logo / brand area */}
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <Image
            src="/vmg-crosshair.png"
            alt="VMG logo"
            width={36}
            height={36}
            className="rounded-md"
          />
        </div>
        <div className="mt-1">
          <p className="text-sm font-semibold leading-none text-foreground">Verge Management Group</p>
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

        {/* Quick Links */}
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Quick Links
          </p>
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                style={{ color: 'oklch(0.52 0.007 286)' }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{link.label}</span>
                <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-40" />
              </a>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}
