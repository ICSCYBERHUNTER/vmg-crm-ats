import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { revokeToken } from '@/lib/google/oauth'

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
      .select('encrypted_refresh_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle()

    if (selectError) {
      console.error('Google disconnect: failed to fetch oauth_connections:', selectError)
      return Response.json({ success: false, error: 'Disconnect failed' }, { status: 500 })
    }

    if (!connection) {
      return Response.json({ success: true, message: 'Already disconnected' })
    }

    // Revoke the token — continue even if this fails
    try {
      const refreshToken = decrypt(connection.encrypted_refresh_token)
      await revokeToken(refreshToken)
    } catch (err) {
      console.error('Google disconnect: token revocation failed (continuing with row deletion):', err)
    }

    const { error: deleteError } = await supabase
      .from('oauth_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google')

    if (deleteError) {
      console.error('Google disconnect: failed to delete oauth_connections row:', deleteError)
      return Response.json({ success: false, error: 'Disconnect failed' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('Google disconnect: unexpected error:', err)
    return Response.json({ success: false, error: 'Disconnect failed' }, { status: 500 })
  }
}
