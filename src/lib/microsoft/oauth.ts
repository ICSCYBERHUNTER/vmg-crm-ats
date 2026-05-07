import { MICROSOFT_TOKEN_URL, MICROSOFT_GRAPH_ME_URL } from './config'
import {
  TokenExchangeError,
  TokenRefreshError,
  InvalidGrantError,
  MissingRefreshTokenError,
} from './errors'

function getEnv(): {
  clientId: string
  clientSecret: string
  tenantId: string
  redirectUri: string
} {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI

  if (!clientId) throw new Error('MICROSOFT_CLIENT_ID environment variable is not set')
  if (!clientSecret) throw new Error('MICROSOFT_CLIENT_SECRET environment variable is not set')
  if (!tenantId) throw new Error('MICROSOFT_TENANT_ID environment variable is not set')
  if (!redirectUri) throw new Error('MICROSOFT_REDIRECT_URI environment variable is not set')

  return { clientId, clientSecret, tenantId, redirectUri }
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  scope: string
}> {
  const { clientId, clientSecret, tenantId, redirectUri } = getEnv()

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch(MICROSOFT_TOKEN_URL(tenantId), {
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
    console.error('[microsoft-oauth] token exchange failed:', desc)
    throw new TokenExchangeError(`Microsoft token exchange failed: ${desc}`)
  }

  if (!data.refresh_token) {
    console.error('[microsoft-oauth] no refresh_token in response — offline_access scope missing or not consented')
    throw new MissingRefreshTokenError()
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
  displayName: string | null
}> {
  const res = await fetch(MICROSOFT_GRAPH_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await res.json() as {
    mail?: string | null
    userPrincipalName?: string
    displayName?: string
    error?: { code?: string; message?: string }
  }

  if (!res.ok) {
    const desc = data.error?.message ?? 'Unknown error'
    console.error('[microsoft-oauth] /me request failed:', desc)
    throw new Error(`Microsoft /me request failed: ${desc}`)
  }

  // mail is the actual email address (often null for cloud-only accounts).
  // userPrincipalName is the login username (always present, often the same as email).
  // Prefer mail; fall back to userPrincipalName.
  const email = data.mail ?? data.userPrincipalName
  if (!email) {
    throw new Error('Microsoft /me response had neither mail nor userPrincipalName')
  }

  return {
    email,
    displayName: data.displayName ?? null,
  }
}

/**
 * Refreshes a Microsoft access token.
 *
 * IMPORTANT: Microsoft rotates refresh tokens. The response MAY contain a new
 * `refresh_token` field; if present, the caller MUST persist it, replacing the
 * old one. The old refresh token is NOT guaranteed to keep working.
 *
 * Returns:
 *   - accessToken: always present, the new access token
 *   - expiresIn: seconds until the access token expires
 *   - newRefreshToken: present if Microsoft rotated; null if not. Caller must
 *     check for null and persist the new value when present.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresIn: number
  newRefreshToken: string | null
}> {
  const { clientId, clientSecret, tenantId } = getEnv()

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const res = await fetch(MICROSOFT_TOKEN_URL(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = await res.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!res.ok) {
    if (data.error === 'invalid_grant') {
      console.error('[microsoft-oauth] refresh token rejected as invalid_grant — connection must be reset')
      throw new InvalidGrantError()
    }
    const desc = data.error_description ?? data.error ?? 'Unknown error'
    console.error('[microsoft-oauth] token refresh failed:', desc)
    throw new TokenRefreshError(`Microsoft token refresh failed: ${desc}`)
  }

  return {
    accessToken: data.access_token!,
    expiresIn: data.expires_in!,
    newRefreshToken: data.refresh_token ?? null,
  }
}

/**
 * Microsoft does not provide a meaningful token revocation endpoint for
 * delegated app permissions in the same way Google does. The closest
 * equivalent is `/me/revokeSignInSessions`, which signs the user out of ALL
 * Microsoft sessions everywhere — far too aggressive for a "disconnect from
 * VMG" action.
 *
 * Instead, "disconnect" is implemented as: delete the row from
 * oauth_connections. The refresh token will simply remain unused and become
 * inert. The user can also revoke this app's access manually in their
 * Microsoft account settings if desired.
 *
 * This function is exported for API symmetry with Google but is intentionally
 * a no-op.
 */
export async function revokeToken(_token: string): Promise<void> {
  // Intentional no-op. See doc comment.
}
