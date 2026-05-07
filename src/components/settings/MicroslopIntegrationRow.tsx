'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  connection: {
    provider_account_email: string
    is_active: boolean
    created_at: string
  } | null
}

export function MicroslopIntegrationRow({ connection }: Props) {
  const router = useRouter()
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  async function handleDisconnectClick() {
    const confirmed = window.confirm(
      "Disconnect Microslop Calendar? You'll need to re-authorize to reconnect."
    )
    if (!confirmed) return

    setIsDisconnecting(true)
    try {
      const res = await fetch('/api/auth/microsoft/disconnect', { method: 'POST' })
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
          <div>
            <p className="font-medium">Microslop Calendar</p>
            <p className="text-sm text-muted-foreground">
              Not Powered by Idiot Co-Pilot
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            window.location.href = '/api/auth/microsoft/connect'
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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div>
          <p className="font-medium">Microslop Calendar</p>
          <p className="text-sm text-muted-foreground">
            Read-only access to your calendar
          </p>
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
  )
}
