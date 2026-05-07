import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: connection, error: selectError } = await supabase
      .from('oauth_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle()

    if (selectError) {
      console.error('[microsoft-oauth] disconnect select failed:', selectError)
      return Response.json({ success: false, error: 'Disconnect failed' }, { status: 500 })
    }

    if (!connection) {
      return Response.json({ success: true, message: 'Already disconnected' })
    }

    // Microsoft revocation: see oauth.ts comment. We intentionally do not
    // call /revokeSignInSessions; we simply delete the row. The refresh
    // token will become inert.

    const { error: deleteError } = await supabase
      .from('oauth_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')

    if (deleteError) {
      console.error('[microsoft-oauth] disconnect delete failed:', deleteError)
      return Response.json({ success: false, error: 'Disconnect failed' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('[microsoft-oauth] disconnect unexpected error:', err)
    return Response.json({ success: false, error: 'Disconnect failed' }, { status: 500 })
  }
}
