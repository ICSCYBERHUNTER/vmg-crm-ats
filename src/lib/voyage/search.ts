import { VoyageHttpError } from './client'
import { withRetry } from './retry'
import { VOYAGE_RERANK_URL, RERANK_MODEL } from './config'
import type { EmbedResult } from './types'

const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings'
const EMBED_MODEL = 'voyage-4-large'

// ── Rerank response types ────────────────────────────────────────────────────

export type RerankResultItem = {
  index: number
  relevance_score: number
}

export type RerankResponse = {
  data: RerankResultItem[]
  usage: { total_tokens: number }
}

// ── embedQuery ───────────────────────────────────────────────────────────────
// Mirror of embedText() with input_type: 'query' for retrieval queries.
// Voyage recommends 'query' for search queries vs 'document' for stored content.

export async function embedQuery(text: string): Promise<EmbedResult> {
  if (!text.trim()) {
    throw new Error('embedQuery requires non-empty input text.')
  }

  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing VOYAGE_API_KEY in environment. Add it to .env.local locally and to Vercel env vars for deployed environments.'
    )
  }

  const response = await withRetry(async () => {
    const res = await fetch(VOYAGE_EMBED_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: [text],
        model: EMBED_MODEL,
        input_type: 'query',
      }),
    })

    if (!res.ok) {
      throw new VoyageHttpError(
        res.status,
        `Voyage API error: ${res.status} ${res.statusText}`
      )
    }

    return res.json()
  })

  const vector = response.data?.[0]?.embedding
  if (!vector || vector.length === 0) {
    throw new Error('Voyage API returned an empty embedding vector.')
  }

  return {
    vector,
    modelVersion: EMBED_MODEL,
    tokenCount: response.usage?.total_tokens,
  }
}

// ── rerankResults ────────────────────────────────────────────────────────────

export async function rerankResults(
  query: string,
  documents: string[]
): Promise<RerankResponse> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing VOYAGE_API_KEY in environment. Add it to .env.local locally and to Vercel env vars for deployed environments.'
    )
  }

  return withRetry(async () => {
    const res = await fetch(VOYAGE_RERANK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        documents,
        model: RERANK_MODEL,
        // top_k intentionally omitted — Voyage returns scores for ALL documents
        // by default. Phase 2X.1 needs the full scored set to apply filter
        // soft-boost client-side before trimming to RERANK_TOP_K. Removing top_k
        // does not change Voyage compute (scoring is per input token, not per
        // result returned).
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new VoyageHttpError(
        res.status,
        `Voyage rerank API error: ${res.status} ${res.statusText} — ${body}`
      )
    }

    return res.json() as Promise<RerankResponse>
  })
}
