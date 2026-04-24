export type EntityType =
  | 'candidate'
  | 'company'
  | 'company_contact'
  | 'job_opening'
  | 'note'

export type EmbeddingVector = number[]

export interface EmbedResult {
  vector: EmbeddingVector
  modelVersion: string
  tokenCount?: number
}

// Voyage API request shape used internally by client.ts
export interface VoyageEmbedRequest {
  input: string[]
  model: string
}

// Voyage API response shapes used internally by client.ts / embed.ts
export interface VoyageEmbedResponseDataItem {
  embedding?: number[]
  index?: number
  object?: string
}

export interface VoyageEmbedResponseUsage {
  total_tokens?: number
}

export interface VoyageEmbedResponse {
  data?: VoyageEmbedResponseDataItem[]
  model?: string
  usage?: VoyageEmbedResponseUsage
  object?: string
}
