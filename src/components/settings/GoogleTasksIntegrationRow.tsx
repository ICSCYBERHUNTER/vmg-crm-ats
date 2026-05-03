'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleTaskListSelector } from '@/components/settings/GoogleTaskListSelector'

type Props = {
  connection: {
    provider_account_email: string
    is_active: boolean
    created_at: string
    tasklist_id: string | null
    tasklist_name: string | null
  } | null
}

// Minimal inline Google "G" SVG icon
function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function GoogleTasksIntegrationRow({ connection }: Props) {
  const router = useRouter()
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  async function handleDisconnectClick() {
    const confirmed = window.confirm(
      "Disconnect Google Tasks? You'll need to re-authorize to reconnect."
    )
    if (!confirmed) return

    setIsDisconnecting(true)
    try {
      const res = await fetch('/api/auth/google/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Disconnect failed')
      router.refresh()
    } catch {
      alert('Failed to disconnect. Please try again.')
      setIsDisconnecting(false)
    }
  }

  if (!connection) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <GoogleIcon />
          <div>
            <p className="font-medium">Google Tasks</p>
            <p className="text-sm text-muted-foreground">
              Connect your Google account to see your tasks on the dashboard.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            window.location.href = '/api/auth/google/connect'
          }}
          variant="default"
          size="sm"
        >
          Connect
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <GoogleIcon />
          <div>
            <p className="font-medium">Google Tasks</p>
            <div className="mt-1 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Connected</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {connection.provider_account_email}
            </p>
          </div>
        </div>
        <Button
          onClick={handleDisconnectClick}
          variant="outline"
          size="sm"
          disabled={isDisconnecting}
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </Button>
      </div>
      <div className="border-t pt-4">
        <GoogleTaskListSelector
          initialTasklistId={connection.tasklist_id}
          initialTasklistName={connection.tasklist_name}
        />
      </div>
    </div>
  )
}
