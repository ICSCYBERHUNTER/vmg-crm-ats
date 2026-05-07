import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUpcomingEvents, type CalendarEvent } from '@/lib/microsoft/graph'

type ApiResponse =
  | { success: true; code: 'ok'; events: CalendarEvent[]; truncated: boolean; totalInWindow: number }
  | { success: false; code: 'unauthorized' | 'not_connected' | 'reconnect_required' | 'graph_api_error' | 'server_error'; events: CalendarEvent[] }

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json<ApiResponse>(
      { success: false, code: 'unauthorized', events: [] },
      { status: 401 }
    )
  }

  try {
    const { events, truncated, totalInWindow } = await fetchUpcomingEvents(user.id)
    return NextResponse.json<ApiResponse>({
      success: true,
      code: 'ok',
      events,
      truncated,
      totalInWindow,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''

    if (message === 'NOT_CONNECTED') {
      return NextResponse.json<ApiResponse>({
        success: false,
        code: 'not_connected',
        events: [],
      })
    }
    if (message === 'RECONNECT_REQUIRED') {
      return NextResponse.json<ApiResponse>({
        success: false,
        code: 'reconnect_required',
        events: [],
      })
    }
    if (message === 'GRAPH_API_ERROR') {
      return NextResponse.json<ApiResponse>(
        { success: false, code: 'graph_api_error', events: [] },
        { status: 500 }
      )
    }

    console.error('[calendar-upcoming] unexpected error:', err)
    return NextResponse.json<ApiResponse>(
      { success: false, code: 'server_error', events: [] },
      { status: 500 }
    )
  }
}
