'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'

interface CompanyLogoProps {
  domain: string | null | undefined
  size?: number
  className?: string
}

export function CompanyLogo({ domain, size = 32, className = '' }: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false)

  // Render fallback icon if no domain or load failed
  if (!domain || hasError) {
    return (
      <div
        className={`flex items-center justify-center rounded border border-zinc-700 bg-zinc-800 shrink-0 overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        <Building2 className="text-zinc-500" size={Math.max(14, size - 10)} />
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded border border-zinc-700 bg-zinc-800 shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`}
        alt={`${domain} logo`}
        width={size}
        height={size}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
      />
    </div>
  )
}
