'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListChecks, Users, Building2, Briefcase, Search, Layers, Heart, Linkedin, Compass, Newspaper, Shield, ChevronRight, ChevronDown, Bot, ExternalLink, Sparkles, MessageCircle } from 'lucide-react'
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
    label: 'Tasks',
    href: '/tasks',
    icon: ListChecks,
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
    label: 'Key Relationships',
    href: '/key-relationships',
    icon: Heart,
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

const regularLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com', icon: Linkedin },
  { label: 'Sales Navigator', href: 'https://www.linkedin.com/sales', icon: Compass },
  { label: 'Industrial Cyber', href: 'https://industrialcyber.co/', icon: Shield },
  { label: 'Dark Reading', href: 'https://www.darkreading.com', icon: Newspaper },
]

const aiToolLinks = [
  { label: 'Claude', href: 'https://claude.ai', icon: Bot },
  { label: 'Gemini', href: 'https://gemini.google.com', icon: Sparkles },
  { label: 'ChatGPT', href: 'https://chatgpt.com', icon: MessageCircle },
]

export function Sidebar() {
  const pathname = usePathname()
  const [aiToolsExpanded, setAiToolsExpanded] = useState(false)

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
          <p className="mt-2 text-xs leading-tight text-muted-foreground">OT/IoT Cyber Recruitment</p>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="scrollbar-subtle flex flex-1 flex-col gap-1 overflow-y-auto p-2">
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
                  ? 'bg-blue-500/15 backdrop-blur-md border border-blue-400/30 text-primary shadow-[inset_0_1px_0_rgba(147,197,253,0.15)]'
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
        <div className="mt-4 rounded-lg bg-white/[0.07] backdrop-blur-sm border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] px-2 pt-4 pb-4">
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
            Quick Links
          </p>
          {regularLinks.map((link) => {
            const Icon = link.icon
            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[oklch(0.66_0.007_286)] transition-colors hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{link.label}</span>
                <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-50" />
              </a>
            )
          })}

          {/* AI Tools Toggle */}
          <button
            type="button"
            onClick={() => setAiToolsExpanded(!aiToolsExpanded)}
            className="mt-2 mb-1 flex w-full items-center gap-2 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            {aiToolsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            AI Tools
          </button>

          {/* AI Tools Links (Collapsible) */}
          {aiToolsExpanded && (
            <div>
              {aiToolLinks.map((link) => {
                const Icon = link.icon
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[oklch(0.66_0.007_286)] transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{link.label}</span>
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-50" />
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </nav>
    </aside>
  )
}
