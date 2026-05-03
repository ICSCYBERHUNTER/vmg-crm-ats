'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'

export function SettingsStatusBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [visible, setVisible] = useState(true)

  const google = searchParams.get('google')
  const reason = searchParams.get('reason')

  useEffect(() => {
    if (!google) return

    const timer = setTimeout(() => {
      setVisible(false)
      router.replace('/settings')
    }, 5000)

    return () => clearTimeout(timer)
  }, [google, router])

  if (!google || !visible) return null

  if (google === 'connected') {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Google Tasks connected successfully.</span>
      </div>
    )
  }

  if (google === 'error') {
    const message =
      reason === 'invalid_state'
        ? 'Authentication failed. Please try again.'
        : reason === 'connection_failed'
          ? 'Could not connect to Google. Please try again.'
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
