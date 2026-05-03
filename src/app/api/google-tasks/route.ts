import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken } from '@/lib/google/tokens'

type GoogleTask = {
  id: string
  title: string
  status: string
  due?: string
  notes?: string
  position?: string
  updated: string
  selfLink: string
}

type GoogleTasksResponse = {
  kind: string
  etag: string
  items?: GoogleTask[]
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, code: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 10

  let tokenInfo: Awaited<ReturnType<typeof getValidAccessToken>>
  try {
    tokenInfo = await getValidAccessToken(user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'NOT_CONNECTED') {
      return NextResponse.json({ success: false, code: 'not_connected', tasks: [] })
    }
    if (message === 'RECONNECT_REQUIRED') {
      return NextResponse.json({ success: false, code: 'reconnect_required', tasks: [] })
    }
    return NextResponse.json(
      { success: false, code: 'server_error', tasks: [] },
      { status: 500 }
    )
  }

  if (!tokenInfo.tasklistId) {
    return NextResponse.json({
      success: false,
      code: 'no_list_selected',
      tasks: [],
      tasklistName: null,
    })
  }

  const googleApiUrl = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(tokenInfo.tasklistId)}/tasks?showCompleted=false&maxResults=100`

  const res = await fetch(googleApiUrl, {
    headers: { Authorization: `Bearer ${tokenInfo.accessToken}` },
  })

  if (!res.ok) {
    const snippet = await res.text().then((t) => t.slice(0, 200)).catch(() => '')
    console.error(`Google Tasks API error: status=${res.status} body=${snippet}`)
    return NextResponse.json(
      { success: false, code: 'google_api_error', tasks: [] },
      { status: 500 }
    )
  }

  const data = (await res.json()) as GoogleTasksResponse
  const items = data.items ?? []

  // Smart hybrid sort: tasks due overdue/today/tomorrow rise to top (sorted by date asc),
  // then everything else respects drag order (Google's position field).

  // Helper: parse YYYY-MM-DD as a LOCAL date — never new Date(dateString) to avoid timezone shift
  const parseLocalDate = (due: string | null): Date | null => {
    if (!due) return null
    const datePart = due.slice(0, 10)
    const [yearStr, monthStr, dayStr] = datePart.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const day = Number(dayStr)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }

  // "Tomorrow end-of-day" cutoff: midnight at start of the day after tomorrow, local time
  const now = new Date()
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 0, 0, 0, 0)

  type Item = typeof items[number]

  const isUrgent = (item: Item): boolean => {
    const d = parseLocalDate(item.due ?? null)
    if (!d) return false
    return d.getTime() < tomorrowEnd.getTime()
  }

  const compareUrgent = (a: Item, b: Item): number => {
    const ad = parseLocalDate(a.due ?? null)?.getTime() ?? Number.POSITIVE_INFINITY
    const bd = parseLocalDate(b.due ?? null)?.getTime() ?? Number.POSITIVE_INFINITY
    return ad - bd
  }

  const compareDragOrder = (a: Item, b: Item): number => {
    return (a.position ?? '').localeCompare(b.position ?? '')
  }

  const sorted = items.slice().sort((a, b) => {
    const aUrgent = isUrgent(a)
    const bUrgent = isUrgent(b)

    if (aUrgent && !bUrgent) return -1
    if (!aUrgent && bUrgent) return 1
    if (aUrgent && bUrgent) return compareUrgent(a, b)
    return compareDragOrder(a, b)
  })

  const tasks = sorted.slice(0, limit).map((t) => ({
    id: t.id,
    title: t.title,
    due: t.due ?? null,
    notes: t.notes ?? null,
  }))

  return NextResponse.json({
    success: true,
    code: 'ok',
    tasks,
    tasklistName: tokenInfo.tasklistName,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, code: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, code: 'invalid_input' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { title: unknown }).title !== 'string' ||
    (body as { title: string }).title.trim().length === 0 ||
    (body as { title: string }).title.length > 1024 ||
    !((body as { due: unknown }).due === null ||
      (typeof (body as { due: unknown }).due === 'string' &&
       /^\d{4}-\d{2}-\d{2}$/.test((body as { due: string }).due)))
  ) {
    return NextResponse.json({ success: false, code: 'invalid_input' }, { status: 400 })
  }

  const { title, due } = body as { title: string; due: string | null }

  let tokenInfo: Awaited<ReturnType<typeof getValidAccessToken>>
  try {
    tokenInfo = await getValidAccessToken(user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'NOT_CONNECTED') {
      return NextResponse.json({ success: false, code: 'not_connected' }, { status: 400 })
    }
    if (message === 'RECONNECT_REQUIRED') {
      return NextResponse.json({ success: false, code: 'reconnect_required' }, { status: 400 })
    }
    return NextResponse.json({ success: false, code: 'server_error' }, { status: 500 })
  }

  if (!tokenInfo.tasklistId) {
    return NextResponse.json({ success: false, code: 'no_list_selected' }, { status: 400 })
  }

  const googleBody: { title: string; due?: string } = {
    title: title.trim(),
  }
  if (due) {
    // Convert YYYY-MM-DD to RFC 3339 (UTC midnight). Google only stores the date — time is discarded.
    googleBody.due = `${due}T00:00:00.000Z`
  }

  const url = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(tokenInfo.tasklistId)}/tasks`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(googleBody),
  })

  if (!res.ok) {
    const snippet = await res.text().then((t) => t.slice(0, 200)).catch(() => '')
    console.error(`Google Tasks POST error: status=${res.status} body=${snippet}`)
    return NextResponse.json({ success: false, code: 'google_api_error' }, { status: 500 })
  }

  const created = (await res.json()) as {
    id: string
    title: string
    due?: string
    notes?: string
  }

  return NextResponse.json({
    success: true,
    code: 'ok',
    task: {
      id: created.id,
      title: created.title,
      due: created.due ?? null,
      notes: created.notes ?? null,
    },
  })
}
