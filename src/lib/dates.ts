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
