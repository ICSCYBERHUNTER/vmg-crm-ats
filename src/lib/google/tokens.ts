import { createServiceClient } from '@/lib/supabase/service'
import { decrypt, encrypt } from '@/lib/crypto'
import { refreshAccessToken } from '@/lib/google/oauth'

export async function getValidAccessToken(userId: string): Promise<{
  accessToken: string
  email: string
  tasklistId: string | null
  tasklistName: string | null
}> {
  const supabase = createServiceClient()

  const { data: row, error } = await supabase
    .from('oauth_connections')
    .select(
      'id, encrypted_access_token, encrypted_refresh_token, access_token_expires_at, provider_account_email, tasklist_id, tasklist_name, is_active'
    )
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !row) {
    throw new Error('NOT_CONNECTED')
  }

  const email = row.provider_account_email as string
  const tasklistId = (row.tasklist_id as string | null) ?? null
  const tasklistName = (row.tasklist_name as string | null) ?? null

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
  const expiresAt = row.access_token_expires_at
    ? new Date(row.access_token_expires_at as string)
    : null

  let accessToken: string

  if (
    expiresAt &&
    expiresAt > fiveMinutesFromNow &&
    row.encrypted_access_token
  ) {
    accessToken = decrypt(row.encrypted_access_token as string)
  } else {
    // Refresh path
    const refreshToken = decrypt(row.encrypted_refresh_token as string)

    let refreshResult: { accessToken: string; expiresIn: number }
    try {
      refreshResult = await refreshAccessToken(refreshToken)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('invalid_grant')) {
        await supabase
          .from('oauth_connections')
          .update({ is_active: false })
          .eq('id', row.id as string)
        throw new Error('RECONNECT_REQUIRED')
      }
      throw new Error('TOKEN_REFRESH_FAILED: token refresh failed')
    }

    const newExpiresAt = new Date(
      Date.now() + refreshResult.expiresIn * 1000
    ).toISOString()

    await supabase
      .from('oauth_connections')
      .update({
        encrypted_access_token: encrypt(refreshResult.accessToken),
        access_token_expires_at: newExpiresAt,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', row.id as string)

    return { accessToken: refreshResult.accessToken, email, tasklistId, tasklistName }
  }

  await supabase
    .from('oauth_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id as string)

  return { accessToken, email, tasklistId, tasklistName }
}
