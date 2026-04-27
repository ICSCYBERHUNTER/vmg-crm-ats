import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SimilarCandidate } from '@/types/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { status: 'error', message: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json(
      { status: 'error', message: 'Missing candidate ID' },
      { status: 400 }
    )
  }

  // Check if source candidate exists and has an embedding
  const { data: source } = await supabase
    .from('candidates')
    .select('embedding_updated_at')
    .eq('id', id)
    .single()

  if (source === null) {
    return NextResponse.json(
      { status: 'error', message: 'Candidate not found' },
      { status: 404 }
    )
  }

  const sourceRow = source as { embedding_updated_at: string | null }

  if (sourceRow.embedding_updated_at === null) {
    return NextResponse.json({
      status: 'source_missing_embedding',
      results: [],
      message:
        'This candidate does not have an embedding yet. Similar candidates will be available after the next sync.',
    })
  }

  const { data, error } = await supabase.rpc('find_similar_candidates', {
    source_candidate_id: id,
    result_limit: 10,
  })

  if (error) {
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 500 }
    )
  }

  const results = (data ?? []) as SimilarCandidate[]

  if (results.length === 0) {
    return NextResponse.json({
      status: 'no_similar_candidates',
      results: [],
      message: 'No similar candidates found.',
    })
  }

  return NextResponse.json({ status: 'ok', results })
}
