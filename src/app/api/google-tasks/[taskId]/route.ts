import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken } from '@/lib/google/tokens'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, code: 'unauthorized' }, { status: 401 })
  }

  const { taskId } = await params
  if (!taskId) {
    return NextResponse.json({ success: false, code: 'invalid_input' }, { status: 400 })
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
    !('status' in body) ||
    ((body as { status: unknown }).status !== 'needsAction' &&
      (body as { status: unknown }).status !== 'completed')
  ) {
    return NextResponse.json({ success: false, code: 'invalid_input' }, { status: 400 })
  }

  const { status } = body as { status: 'needsAction' | 'completed' }

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

  const patchBody =
    status === 'completed'
      ? { status: 'completed', completed: new Date().toISOString() }
      : { status: 'needsAction', completed: null }

  const url = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(tokenInfo.tasklistId)}/tasks/${encodeURIComponent(taskId)}`

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patchBody),
  })

  if (!res.ok) {
    const snippet = await res.text().then((t) => t.slice(0, 200)).catch(() => '')
    console.error(`Google Tasks PATCH error: status=${res.status} body=${snippet}`)
    return NextResponse.json({ success: false, code: 'google_api_error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, code: 'ok' })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, code: 'unauthorized' }, { status: 401 })
  }

  const { taskId } = await params
  if (!taskId) {
    return NextResponse.json({ success: false, code: 'invalid_input' }, { status: 400 })
  }

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

  const url = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(tokenInfo.tasklistId)}/tasks/${encodeURIComponent(taskId)}`

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenInfo.accessToken}` },
  })

  if (!res.ok) {
    // 404 is idempotent — task is already gone, user's intent is satisfied
    if (res.status === 404) {
      return NextResponse.json({ success: true, code: 'ok' })
    }
    const snippet = await res.text().then((t) => t.slice(0, 200)).catch(() => '')
    console.error(`Google Tasks DELETE error: status=${res.status} body=${snippet}`)
    return NextResponse.json({ success: false, code: 'google_api_error' }, { status: 500 })
  }

  // Google returns 204 No Content on success — do not attempt to parse body
  return NextResponse.json({ success: true, code: 'ok' })
}
