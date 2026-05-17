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
 *
 * Pass input_type: "document" for stored entity embeddings,
 * or input_type: "query" for user search queries.
 */
export async function voyageEmbed(
  text: string,
  input_type?: 'document' | 'query'
): Promise<VoyageEmbedResponse> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing VOYAGE_API_KEY in environment. Add it to .env.local locally and to Vercel env vars for deployed environments.'
    )
  }

  // output_dimension is pinned to 1024 defensively. voyage-4-large currently
  // defaults to 1024, but pinning prevents a silent dimension change from
  // upstream that would break the HNSW index (idx_candidates_embedding is
  // built for 1024-dim cosine vectors).
  const body: Record<string, unknown> = {
    input: [text],
    model: MODEL,
    output_dimension: 1024,
  }
  if (input_type !== undefined) {
    body.input_type = input_type
  }

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new VoyageHttpError(
      res.status,
      `Voyage API error: ${res.status} ${res.statusText}`
    )
  }

  return res.json() as Promise<VoyageEmbedResponse>
}
