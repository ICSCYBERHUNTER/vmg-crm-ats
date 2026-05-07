// Typed errors for Microsoft OAuth flows. Replaces Google's pattern of
// throwing generic Errors with magic strings checked via `.includes()`.
// Callers should check `instanceof InvalidGrantError` rather than parse messages.

export class MicrosoftOAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MicrosoftOAuthError'
  }
}

export class InvalidGrantError extends MicrosoftOAuthError {
  constructor(message = 'Refresh token is invalid or has been revoked') {
    super(message)
    this.name = 'InvalidGrantError'
  }
}

export class TokenRefreshError extends MicrosoftOAuthError {
  constructor(message = 'Failed to refresh access token') {
    super(message)
    this.name = 'TokenRefreshError'
  }
}

export class TokenExchangeError extends MicrosoftOAuthError {
  constructor(message = 'Failed to exchange authorization code for tokens') {
    super(message)
    this.name = 'TokenExchangeError'
  }
}

export class MissingRefreshTokenError extends MicrosoftOAuthError {
  constructor() {
    super(
      'Microsoft did not return a refresh_token. ' +
      'Verify offline_access scope is requested and consented.'
    )
    this.name = 'MissingRefreshTokenError'
  }
}
