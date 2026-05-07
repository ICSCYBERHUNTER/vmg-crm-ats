import { createServiceClient } from '@/lib/supabase/service'
import { decrypt, encrypt } from '@/lib/crypto'
import { refreshAccessToken } from '@/lib/microsoft/oauth'
import { InvalidGrantError, TokenRefreshError } from '@/lib/microsoft/errors'

export async function getValidAccessToken(userId: string): Promise<{
  accessToken: string
  email: string
}> {
  const supabase = createServiceClient()

  const { data: row, error } = await supabase
    .from('oauth_connections')
    .select(
      'id, encrypted_access_token, encrypted_refresh_token, access_token_expires_at, provider_account_email, is_active'
    )
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !row) {
    throw new Error('NOT_CONNECTED')
  }

  const email = row.provider_account_email as string

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
  const expiresAt = row.access_token_expires_at
    ? new Date(row.access_token_expires_at as string)
    : null

  // Happy path: existing access token is still valid for >5 minutes.
  if (
    expiresAt &&
    expiresAt > fiveMinutesFromNow &&
    row.encrypted_access_token
  ) {
    const accessToken = decrypt(row.encrypted_access_token as string)
    await supabase
      .from('oauth_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', row.id as string)
    return { accessToken, email }
  }

  // Refresh path.
  const oldRefreshToken = decrypt(row.encrypted_refresh_token as string)

  let refreshResult: {
    accessToken: string
    expiresIn: number
    newRefreshToken: string | null
  }
  try {
    refreshResult = await refreshAccessToken(oldRefreshToken)
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      await supabase
        .from('oauth_connections')
        .update({ is_active: false })
        .eq('id', row.id as string)
      throw new Error('RECONNECT_REQUIRED')
    }
    if (err instanceof TokenRefreshError) {
      throw new Error('TOKEN_REFRESH_FAILED: token refresh failed')
    }
    throw err
  }

  const newExpiresAt = new Date(
    Date.now() + refreshResult.expiresIn * 1000
  ).toISOString()

  // Persist the new access token, expiry, and (if rotated) the new refresh token.
  const updatePayload: Record<string, string> = {
    encrypted_access_token: encrypt(refreshResult.accessToken),
    access_token_expires_at: newExpiresAt,
    last_used_at: new Date().toISOString(),
  }

  if (refreshResult.newRefreshToken) {
    updatePayload.encrypted_refresh_token = encrypt(refreshResult.newRefreshToken)
  }

  await supabase
    .from('oauth_connections')
    .update(updatePayload)
    .eq('id', row.id as string)

  return { accessToken: refreshResult.accessToken, email }
}
