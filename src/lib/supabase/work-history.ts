import { createClient } from './client'
import type { WorkHistory } from '@/types/database'

// ─── Fetch ──────────────────────────────────────────────────────────────────

export async function fetchWorkHistory(candidateId: string): Promise<WorkHistory[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('work_history')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('is_current', { ascending: false })
    .order('end_date', { ascending: false, nullsFirst: true })
    .order('start_date', { ascending: false })

  if (error) throw new Error(error.message)
  return data as WorkHistory[]
}

// ─── Create ─────────────────────────────────────────────────────────────────

interface WorkHistoryInsert {
  candidate_id: string
  company_name: string
  job_title: string
  location?: string
  description?: string
  start_date?: string
  end_date?: string
  is_current: boolean
}

export async function createWorkHistoryEntry(entry: WorkHistoryInsert): Promise<WorkHistory> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('work_history')
    .insert({
      ...entry,
      // Current roles can't have an end date
      end_date: entry.is_current ? null : (entry.end_date ?? null),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as WorkHistory
}

// ─── Update ─────────────────────────────────────────────────────────────────

export async function updateWorkHistoryEntry(
  id: string,
  updates: Partial<Omit<WorkHistoryInsert, 'candidate_id'>>
): Promise<WorkHistory> {
  const supabase = createClient()

  const payload = { ...updates }
  if (payload.is_current) {
    payload.end_date = undefined // clear end_date for current roles
  }

  const { data, error } = await supabase
    .from('work_history')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as WorkHistory
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteWorkHistoryEntry(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('work_history')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
