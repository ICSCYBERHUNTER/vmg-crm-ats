export function formatTaskDueDate(due: string | null): string | null {
  if (!due) return null

  // Google Tasks returns YYYY-MM-DDT00:00:00.000Z. The time is meaningless (Google strips it).
  // We must parse YYYY-MM-DD as a LOCAL DATE, not as UTC, or we get timezone-shifted display.
  const datePart = due.slice(0, 10) // 'YYYY-MM-DD'
  const [yearStr, monthStr, dayStr] = datePart.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!year || !month || !day) return null

  const localDate = new Date(year, month - 1, day)

  // Format as "Apr 28" / "May 5" — matches the existing TasksWidget date format
  return localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

import { format } from 'date-fns'

/**
 * Format an event's day-header label, given an ISO datetime string.
 *
 * Returns:
 *   - "Today" if the event is today
 *   - "Tomorrow" if the event is tomorrow
 *   - "Wed, May 8" otherwise (weekday + month + day)
 *
 * Comparison uses LOCAL date parts (year, month, date), not UTC.
 * Input ISO strings include timezone info (e.g. "2026-05-06T14:00:00-04:00"),
 * so `new Date(isoString)` is safe here — JavaScript correctly handles
 * timezoned ISO strings. The date-only landmine does NOT apply.
 */
export function formatEventDayHeader(isoString: string): string {
  const eventDate = new Date(isoString)
  const now = new Date()

  // Compute "today" and "tomorrow" using local date parts.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())

  if (eventDay.getTime() === today.getTime()) return 'Today'
  if (eventDay.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return format(eventDay, 'EEE, MMM d')
}

/**
 * Format an event's start time, e.g. "9:00 AM" or "2:30 PM".
 * For all-day events, the caller should display "All day" and not call this.
 *
 * Input ISO strings include timezone info, so `new Date(isoString)` is safe.
 */
export function formatEventTime(isoString: string): string {
  const date = new Date(isoString)
  return format(date, 'h:mm a')
}
