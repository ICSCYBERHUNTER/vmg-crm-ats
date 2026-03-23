'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  count?: number
  defaultOpen?: boolean
  headerAction?: React.ReactNode
  compact?: boolean
  previewText?: string
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = false,
  headerAction,
  compact = false,
  previewText,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const countBadge =
    count !== undefined && count > 0 ? (
      <Badge variant="secondary" className="text-xs font-normal">
        {count}
      </Badge>
    ) : count === 0 ? (
      <Badge variant="secondary" className="text-xs font-normal">
        0
      </Badge>
    ) : null

  // Compact collapsed state — slim single-line row
  if (compact && !isOpen) {
    return (
      <div
        className="flex items-center justify-between bg-card border border-border rounded-md px-5 py-2.5 cursor-pointer select-none hover:bg-muted/30"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span>{title}</span>
          {countBadge}
        </div>
        <div className="flex items-center gap-3">
          {previewText && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {previewText}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    )
  }

  // Normal card (non-compact, or compact+expanded)
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: icon + title + count */}
          <div className="flex items-center gap-2 text-base font-semibold">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <span>{title}</span>
            {countBadge}
          </div>

          {/* Right: optional action + chevron */}
          <div className="flex items-center gap-2">
            {headerAction && (
              // Stop click from toggling the section when interacting with the action
              <div onClick={(e) => e.stopPropagation()}>
                {headerAction}
              </div>
            )}
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </div>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
