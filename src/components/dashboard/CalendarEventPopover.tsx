'use client'

import { format } from 'date-fns'
import { ExternalLink, MapPin, Users, Video } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CalendarEvent } from '@/lib/microsoft/graph'

interface CalendarEventPopoverProps {
  event: CalendarEvent
  children: React.ReactNode  // the trigger — typically the event row
}

export function CalendarEventPopover({ event, children }: CalendarEventPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="flex w-full items-center gap-2 py-1.5 px-1 rounded text-left hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          {/* Subject */}
          <h3 className="text-sm font-semibold leading-tight">
            {event.subject}
          </h3>

          {/* Time range */}
          <div className="text-xs text-muted-foreground">
            {formatEventTimeRange(event)}
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Online meeting */}
          {event.isOnlineMeeting && event.onlineMeetingUrl && (
            <div className="flex items-start gap-2 text-xs">
              <Video className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <a
                href={event.onlineMeetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Join online meeting
              </a>
            </div>
          )}

          {/* Attendees */}
          {event.attendeeCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {event.attendeeCount} {event.attendeeCount === 1 ? 'attendee' : 'attendees'}
              </span>
            </div>
          )}

          {/* Body preview */}
          {event.bodyPreview && (
            <p className="text-xs text-muted-foreground line-clamp-3 border-t pt-2">
              {event.bodyPreview}
            </p>
          )}

          {/* Open in Outlook */}
          <div className="border-t pt-2">
            <a
              href={event.webLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open in Outlook
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventTimeRange(event: CalendarEvent): string {
  if (event.isAllDay) return 'All day'

  const start = new Date(event.startIso)
  const end = new Date(event.endIso)

  // Same day: "9:00 AM – 10:30 AM"
  // Different days: "9:00 AM – Wed 10:30 AM"
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()

  const startLabel = format(start, 'h:mm a')
  const endLabel = sameDay ? format(end, 'h:mm a') : format(end, 'EEE h:mm a')

  return `${startLabel} – ${endLabel}`
}
