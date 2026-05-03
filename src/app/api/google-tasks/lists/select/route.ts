import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_input' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('tasklistId' in body) ||
    !('tasklistName' in body)
  ) {
    return NextResponse.json({ success: false, error: 'invalid_input' }, { status: 400 })
  }

  const { tasklistId, tasklistName } = body as { tasklistId: unknown; tasklistName: unknown }

  if (
    typeof tasklistId !== 'string' ||
    tasklistId.trim().length === 0 ||
    tasklistId.length > 200 ||
    typeof tasklistName !== 'string' ||
    tasklistName.trim().length === 0 ||
    tasklistName.length > 200
  ) {
    return NextResponse.json({ success: false, error: 'invalid_input' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('oauth_connections')
    .update({
      tasklist_id: tasklistId,
      tasklist_name: tasklistName,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .eq('is_active', true)
    .select('id')

  if (error || !updated || updated.length === 0) {
    return NextResponse.json(
      { success: false, error: 'connection_not_found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
