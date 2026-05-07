import { getValidAccessToken } from '@/lib/microsoft/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarEvent = {
  id: string
  subject: string                     // event title
  startIso: string                    // ISO datetime string with offset, e.g. "2026-05-06T14:00:00-04:00"
  endIso: string                      // ISO datetime string with offset
  isAllDay: boolean
  location: string | null             // displayName from location, or null
  bodyPreview: string | null          // plain-text preview, ~255 char
  webLink: string                     // URL to open the event in Outlook web
  attendeeCount: number               // total attendees including organizer
  isOnlineMeeting: boolean
  onlineMeetingUrl: string | null     // Teams / external meeting URL
  organizerEmail: string | null
  organizerName: string | null
}

// Microsoft Graph response shape — only the fields we actually use.
type GraphEventTime = {
  dateTime: string                    // e.g. "2026-05-06T14:00:00.0000000"
  timeZone: string                    // e.g. "Eastern Standard Time" or "UTC"
}

type GraphEvent = {
  id: string
  subject: string | null
  start: GraphEventTime
  end: GraphEventTime
  isAllDay: boolean
  location?: { displayName?: string | null } | null
  bodyPreview?: string | null
  webLink: string
  attendees?: Array<{
    emailAddress?: { address?: string | null; name?: string | null } | null
    type?: string | null
  }>
  organizer?: {
    emailAddress?: { address?: string | null; name?: string | null } | null
  } | null
  isOnlineMeeting?: boolean
  onlineMeeting?: { joinUrl?: string | null } | null
}

type GraphCalendarViewResponse = {
  value?: GraphEvent[]
  '@odata.nextLink'?: string
  error?: { code?: string; message?: string }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_EVENTS_RETURNED = 25
const DAYS_AHEAD = 7

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch upcoming calendar events for a user.
 *
 * Window: NOW (current moment) through end of (today + DAYS_AHEAD).
 * Past events of today are NOT returned (we filter "events whose end is in the past").
 * Sort: ascending by start time.
 * Cap: MAX_EVENTS_RETURNED. If more events exist in the window, the caller
 * is given a `truncated: true` flag so the UI can show "+ N more →".
 *
 * Throws:
 *   - 'NOT_CONNECTED' if no Microsoft connection exists
 *   - 'RECONNECT_REQUIRED' if refresh token is invalid
 *   - 'GRAPH_API_ERROR' for any other Graph API failure
 *   - bare Error for unexpected failures
 */
export async function fetchUpcomingEvents(userId: string): Promise<{
  events: CalendarEvent[]
  truncated: boolean
  totalInWindow: number
}> {
  const tokenInfo = await getValidAccessToken(userId)
  // (getValidAccessToken throws 'NOT_CONNECTED' or 'RECONNECT_REQUIRED' — let those bubble up.)

  // Build the time window. Use the current moment as the start so past events
  // of today are excluded by the API itself.
  const now = new Date()
  const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_AHEAD + 1, 0, 0, 0, 0)

  const startDateTime = now.toISOString()
  const endDateTime = windowEnd.toISOString()

  // /me/calendarView expands recurring events into instances within the window.
  // $orderby and $top are honored. Request up to MAX_EVENTS_RETURNED + 1 so we
  // can detect truncation without an extra request.
  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView')
  url.searchParams.set('startDateTime', startDateTime)
  url.searchParams.set('endDateTime', endDateTime)
  url.searchParams.set('$orderby', 'start/dateTime')
  url.searchParams.set('$top', String(MAX_EVENTS_RETURNED + 1))
  url.searchParams.set('$select', [
    'id', 'subject', 'start', 'end', 'isAllDay', 'location',
    'bodyPreview', 'webLink', 'attendees', 'organizer',
    'isOnlineMeeting', 'onlineMeeting',
  ].join(','))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${tokenInfo.accessToken}`,
      // Prefer header tells Graph to return times in the user's actual local
      // timezone with offsets, rather than the default UTC-stripped format.
      // Without this, dateTime strings come back as "2026-05-06T14:00:00.0000000"
      // (no offset), interpreted as the timeZone field separately — fragile.
      Prefer: 'outlook.timezone="UTC"',
    },
  })

  if (!res.ok) {
    const snippet = await res.text().then((t) => t.slice(0, 300)).catch(() => '')
    console.error(`[microsoft-graph] calendarView error: status=${res.status} body=${snippet}`)
    throw new Error('GRAPH_API_ERROR')
  }

  const data = (await res.json()) as GraphCalendarViewResponse

  if (data.error) {
    console.error(`[microsoft-graph] calendarView error in body:`, data.error)
    throw new Error('GRAPH_API_ERROR')
  }

  const rawEvents = data.value ?? []

  // Normalize. Microsoft returns dateTime as "2026-05-06T14:00:00.0000000"
  // when Prefer outlook.timezone="UTC" is set — these are UTC times without
  // the trailing "Z". We append "Z" to make them valid ISO 8601 UTC strings
  // that JavaScript's Date constructor will parse correctly.
  const normalized: CalendarEvent[] = rawEvents.map((e) => {
    const startIso = ensureUtcSuffix(e.start.dateTime)
    const endIso = ensureUtcSuffix(e.end.dateTime)

    const attendeeCount = (e.attendees ?? []).length
    const organizerEmail = e.organizer?.emailAddress?.address ?? null
    const organizerName = e.organizer?.emailAddress?.name ?? null

    return {
      id: e.id,
      subject: e.subject?.trim() || '(No title)',
      startIso,
      endIso,
      isAllDay: e.isAllDay === true,
      location: e.location?.displayName?.trim() || null,
      bodyPreview: e.bodyPreview?.trim() || null,
      webLink: e.webLink,
      attendeeCount,
      isOnlineMeeting: e.isOnlineMeeting === true,
      onlineMeetingUrl: e.onlineMeeting?.joinUrl ?? null,
      organizerEmail,
      organizerName,
    }
  })

  // Filter: hide events that already ended.
  const filtered = normalized.filter((e) => new Date(e.endIso).getTime() > now.getTime())

  // Truncate at MAX_EVENTS_RETURNED. We requested +1 so we can know if there
  // were more events.
  const truncated = filtered.length > MAX_EVENTS_RETURNED
  const events = truncated ? filtered.slice(0, MAX_EVENTS_RETURNED) : filtered

  return {
    events,
    truncated,
    totalInWindow: filtered.length,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Microsoft Graph returns datetime strings without a trailing "Z" when
 * Prefer outlook.timezone="UTC" is set, e.g. "2026-05-06T14:00:00.0000000".
 * These are UTC despite lacking the marker. Append "Z" to make them
 * unambiguous ISO 8601 UTC strings.
 */
function ensureUtcSuffix(dateTime: string): string {
  if (dateTime.endsWith('Z')) return dateTime
  return `${dateTime}Z`
}
