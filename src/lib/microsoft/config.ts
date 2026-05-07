// Microsoft Graph OAuth endpoints. Tenant-specific URLs (single-tenant app).
export const MICROSOFT_AUTH_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
export const MICROSOFT_TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
export const MICROSOFT_GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me'

// Scopes — keep minimal (least privilege).
// Calendars.Read = read-only access to the user's calendars.
// offline_access = required to get a refresh token. Without this, we get a
// 1-hour access token and no way to refresh.
// User.Read = needed to read the user's email/name from /me.
export const MICROSOFT_CALENDARS_READ_SCOPE = 'Calendars.Read'
export const MICROSOFT_OFFLINE_ACCESS_SCOPE = 'offline_access'
export const MICROSOFT_USER_READ_SCOPE = 'User.Read'

export const REQUIRED_SCOPES = [
  MICROSOFT_CALENDARS_READ_SCOPE,
  MICROSOFT_OFFLINE_ACCESS_SCOPE,
  MICROSOFT_USER_READ_SCOPE,
] as const

export function buildAuthorizationUrl(params: { state: string }): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI

  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID environment variable is not set')
  }
  if (!tenantId) {
    throw new Error('MICROSOFT_TENANT_ID environment variable is not set')
  }
  if (!redirectUri) {
    throw new Error('MICROSOFT_REDIRECT_URI environment variable is not set')
  }

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: REQUIRED_SCOPES.join(' '),
    response_mode: 'query',
    prompt: 'consent',
    state: params.state,
  })

  return `${MICROSOFT_AUTH_URL(tenantId)}?${query.toString()}`
}
