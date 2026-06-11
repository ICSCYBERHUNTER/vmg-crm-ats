const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

const GOOGLE_TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks'
const GOOGLE_USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email'

const REQUIRED_SCOPES = [GOOGLE_TASKS_SCOPE, GOOGLE_USERINFO_EMAIL_SCOPE] as const

export function buildAuthorizationUrl(params: { state: string }): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is not set')
  }
  if (!redirectUri) {
    throw new Error('GOOGLE_REDIRECT_URI environment variable is not set')
  }

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: REQUIRED_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: params.state,
  })

  return `${GOOGLE_AUTH_URL}?${query.toString()}`
}
