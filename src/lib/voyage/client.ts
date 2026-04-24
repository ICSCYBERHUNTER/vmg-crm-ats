import type { VoyageEmbedResponse } from './types'

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const MODEL = 'voyage-4-large'

export class VoyageHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'VoyageHttpError'
  }
}

/**
 * Calls the Voyage embeddings REST endpoint for a single text input.
 * Throws VoyageHttpError on non-2xx responses so withRetry() can
 * inspect the status code and decide whether to retry.
 */
export async function voyageEmbed(text: string): Promise<VoyageEmbedResponse> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing VOYAGE_API_KEY in environment. Add it to .env.local locally and to Vercel env vars for deployed environments.'
    )
  }

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: MODEL }),
  })

  if (!res.ok) {
    throw new VoyageHttpError(
      res.status,
      `Voyage API error: ${res.status} ${res.statusText}`
    )
  }

  return res.json() as Promise<VoyageEmbedResponse>
}
