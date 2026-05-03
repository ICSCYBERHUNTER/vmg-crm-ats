import { GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, GOOGLE_REVOKE_URL } from './config'

function getEnv(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID environment variable is not set')
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET environment variable is not set')
  if (!redirectUri) throw new Error('GOOGLE_REDIRECT_URI environment variable is not set')

  return { clientId, clientSecret, redirectUri }
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  scope: string
}> {
  const { clientId, clientSecret, redirectUri } = getEnv()

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = await res.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    error?: string
    error_description?: string
  }

  if (!res.ok) {
    const desc = data.error_description ?? data.error ?? 'Unknown error'
    throw new Error(`Google token exchange failed: ${desc}`)
  }

  if (!data.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token. ' +
      'This may happen if the user previously authorized and prompt=consent was not set.'
    )
  }

  return {
    accessToken: data.access_token!,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in!,
    scope: data.scope ?? '',
  }
}

export async function getUserInfo(accessToken: string): Promise<{
  email: string
  emailVerified: boolean
}> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await res.json() as {
    email?: string
    verified_email?: boolean
    error?: string
    error_description?: string
  }

  if (!res.ok) {
    const desc = data.error_description ?? data.error ?? 'Unknown error'
    throw new Error(`Google userinfo request failed: ${desc}`)
  }

  return {
    email: data.email!,
    emailVerified: data.verified_email ?? false,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresIn: number
}> {
  const { clientId, clientSecret } = getEnv()

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = await res.json() as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!res.ok) {
    if (data.error === 'invalid_grant') {
      throw new Error(
        'Google refresh token is invalid or has been revoked (invalid_grant). ' +
        'The connection must be marked inactive and the user must re-connect.'
      )
    }
    const desc = data.error_description ?? data.error ?? 'Unknown error'
    throw new Error(`Google token refresh failed: ${desc}`)
  }

  return {
    accessToken: data.access_token!,
    expiresIn: data.expires_in!,
  }
}

export async function revokeToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token })

  await fetch(GOOGLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  // Intentionally not throwing on error — 400 means already revoked, which is fine.
}
