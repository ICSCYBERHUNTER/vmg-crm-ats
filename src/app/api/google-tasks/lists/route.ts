import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken } from '@/lib/google/tokens'

type GoogleTaskList = {
  kind: string
  id: string
  etag: string
  title: string
  updated: string
  selfLink: string
}

type GoogleTaskListsResponse = {
  kind: string
  etag: string
  items?: GoogleTaskList[]
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  let tokenInfo: Awaited<ReturnType<typeof getValidAccessToken>>
  try {
    tokenInfo = await getValidAccessToken(user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'NOT_CONNECTED') {
      return NextResponse.json({ success: false, code: 'not_connected', lists: [] })
    }
    if (message === 'RECONNECT_REQUIRED') {
      return NextResponse.json({ success: false, code: 'reconnect_required', lists: [] })
    }
    return NextResponse.json(
      { success: false, code: 'server_error', error: 'Failed to fetch lists' },
      { status: 500 }
    )
  }

  const res = await fetch(
    'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100',
    {
      headers: { Authorization: `Bearer ${tokenInfo.accessToken}` },
    }
  )

  if (!res.ok) {
    return NextResponse.json(
      { success: false, code: 'google_api_error', error: 'Google API request failed' },
      { status: 500 }
    )
  }

  const data = (await res.json()) as GoogleTaskListsResponse
  const items = data.items ?? []

  return NextResponse.json({
    success: true,
    code: 'ok',
    lists: items.map((l) => ({ id: l.id, title: l.title })),
    currentTasklistId: tokenInfo.tasklistId,
    currentTasklistName: tokenInfo.tasklistName,
  })
}
