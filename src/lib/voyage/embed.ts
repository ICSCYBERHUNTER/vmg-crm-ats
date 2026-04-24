import { voyageEmbed } from './client'
import { withRetry } from './retry'
import type { EmbedResult } from './types'

const MODEL = 'voyage-4-large'

export async function embedText(text: string): Promise<EmbedResult> {
  if (!text.trim()) {
    throw new Error('embedText requires non-empty input text.')
  }

  const response = await withRetry(() => voyageEmbed(text))

  const vector = response.data?.[0]?.embedding
  if (!vector || vector.length === 0) {
    throw new Error('Voyage API returned an empty embedding vector.')
  }

  return {
    vector,
    modelVersion: MODEL,
    tokenCount: response.usage?.total_tokens,
  }
}
