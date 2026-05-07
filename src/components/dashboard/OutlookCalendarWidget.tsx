'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetcher } from '@/lib/swr/fetcher'
import { formatEventDayHeader, formatEventTime } from '@/lib/dates'
import { CalendarEventPopover } from './CalendarEventPopover'
import type { CalendarEvent } from '@/lib/microsoft/graph'

type ApiResponse =
  | { success: true; code: 'ok'; events: CalendarEvent[]; truncated: boolean; totalInWindow: number }
  | { success: false; code: 'unauthorized' | 'not_connected' | 'reconnect_required' | 'graph_api_error' | 'server_error'; events: CalendarEvent[] }

export function OutlookCalendarWidget() {
  const { data, error, isLoading } = useSWR<ApiResponse>('/api/calendar/upcoming', fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 5 * 60 * 1000,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
  })

  const renderShell = (children: React.ReactNode) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )

  if (isLoading) {
    return renderShell(<p className="text-sm text-muted-foreground">Loading...</p>)
  }

  if (error || !data) {
    return renderShell(
      <p className="text-sm text-muted-foreground">Couldn&apos;t load calendar. Refresh to retry.</p>
    )
  }

  switch (data.code) {
    case 'unauthorized':
      return null

    case 'not_connected':
      return renderShell(
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect Outlook to see your calendar here.
          </p>
          <Link href="/settings" className="text-sm font-medium text-primary hover:underline">
            Go to Settings →
          </Link>
        </div>
      )

    case 'reconnect_required':
      return renderShell(
        <div className="space-y-3">
          <p className="text-sm text-amber-600">
            Connection expired. Please reconnect Outlook.
          </p>
          <Link href="/settings" className="text-sm font-medium text-primary hover:underline">
            Go to Settings →
          </Link>
        </div>
      )

    case 'graph_api_error':
    case 'server_error':
      return renderShell(
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load calendar. Refresh to retry.
        </p>
      )

    case 'ok': {
      if (data.events.length === 0) {
        return renderShell(
          <p className="text-sm text-muted-foreground">
            Nothing on your calendar this week. 🌴
          </p>
        )
      }

      // Group events by day-header label.
      const groups = groupEventsByDay(data.events)

      return renderShell(
        <div className="max-h-[500px] overflow-y-auto space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.events.map((event) => (
                  <CalendarEventPopover key={event.id} event={event}>
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[60px]">
                      {event.isAllDay ? 'All day' : formatEventTime(event.startIso)}
                    </span>
                    <span className="text-sm truncate">
                      {event.subject}
                    </span>
                  </CalendarEventPopover>
                ))}
              </div>
            </div>
          ))}

          {data.truncated && (
            <div className="pt-2 border-t">
              <a
                href="https://outlook.office.com/calendar"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                + {data.totalInWindow - data.events.length} more event{data.totalInWindow - data.events.length === 1 ? '' : 's'} this week →
              </a>
            </div>
          )}
        </div>
      )
    }

    default:
      return renderShell(
        <p className="text-sm text-muted-foreground">Couldn&apos;t load calendar. Refresh to retry.</p>
      )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupEventsByDay(events: CalendarEvent[]): Array<{
  label: string
  events: CalendarEvent[]
}> {
  // Use the day-header label (Today / Tomorrow / Wed, May 8) as the group key.
  // Order is preserved because events are pre-sorted by startIso ascending.
  const groupMap = new Map<string, CalendarEvent[]>()

  for (const event of events) {
    const label = formatEventDayHeader(event.startIso)
    if (!groupMap.has(label)) groupMap.set(label, [])
    groupMap.get(label)!.push(event)
  }

  return Array.from(groupMap.entries()).map(([label, evts]) => ({ label, events: evts }))
}
