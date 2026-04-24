import { VoyageHttpError } from './client'

const DELAYS_MS = [200, 400, 800] // delay before attempt 2, 3, and final throw
const MAX_ATTEMPTS = 3

// Network error codes that warrant a retry
const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'])

function isRetryable(err: unknown): boolean {
  if (err instanceof VoyageHttpError) {
    // 401 Bad API key, 400 Bad request — retrying will never help
    if (err.status === 401 || err.status === 400) return false
    // 429 Rate limit or any 5xx server error → retry
    return err.status === 429 || err.status >= 500
  }

  // Plain Node network errors (ECONNRESET, ETIMEDOUT, etc.)
  if (err instanceof Error && 'code' in err) {
    return RETRYABLE_CODES.has((err as NodeJS.ErrnoException).code ?? '')
  }

  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      if (!isRetryable(err)) {
        // Non-retryable error — surface immediately
        throw err
      }

      if (attempt < MAX_ATTEMPTS) {
        await sleep(DELAYS_MS[attempt - 1])
      }
    }
  }

  // All attempts exhausted
  const originalMessage =
    lastError instanceof Error ? lastError.message : String(lastError)
  const wrapped = new Error(
    `Voyage API call failed after ${MAX_ATTEMPTS} attempts: ${originalMessage}`
  )
  if (lastError instanceof Error) {
    wrapped.stack = lastError.stack
  }
  throw wrapped
}
