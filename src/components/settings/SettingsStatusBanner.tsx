'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'

export function SettingsStatusBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [visible, setVisible] = useState(true)

  const google = searchParams.get('google')
  const microsoft = searchParams.get('microsoft')
  const reason = searchParams.get('reason')

  // Pick whichever provider param is present. If both, prefer google (unlikely
  // in practice — each OAuth callback only sets one).
  const provider: 'google' | 'microsoft' | null = google
    ? 'google'
    : microsoft
      ? 'microsoft'
      : null
  const status = provider === 'google' ? google : provider === 'microsoft' ? microsoft : null

  useEffect(() => {
    if (!provider) return

    const timer = setTimeout(() => {
      setVisible(false)
      router.replace('/settings')
    }, 5000)

    return () => clearTimeout(timer)
  }, [provider, router])

  if (!provider || !visible) return null

  if (status === 'connected') {
    const message =
      provider === 'google'
        ? 'Google Tasks connected successfully.'
        : 'Microslop Calendar connected successfully.'

    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    )
  }

  if (status === 'error') {
    const providerName = provider === 'google' ? 'Google' : 'Microsoft'
    const message =
      reason === 'invalid_state'
        ? 'Authentication failed. Please try again.'
        : reason === 'connection_failed'
          ? `Could not connect to ${providerName}. Please try again.`
          : 'Something went wrong. Please try again.'

    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    )
  }

  return null
}
