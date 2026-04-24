import { VoyageAIClient } from 'voyageai'

const apiKey = process.env.VOYAGE_API_KEY

if (!apiKey) {
  throw new Error(
    'Missing VOYAGE_API_KEY in environment. Add it to .env.local locally and to Vercel env vars for deployed environments.'
  )
}

// Singleton client. maxRetries: 0 disables the SDK's built-in retry logic
// so our own withRetry() in retry.ts is the sole retry mechanism.
export const voyageClient = new VoyageAIClient({
  apiKey,
  maxRetries: 0,
})
