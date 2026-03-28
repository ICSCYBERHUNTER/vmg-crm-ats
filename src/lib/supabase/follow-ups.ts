// Browser-side Supabase functions for follow-ups.
// All follow-up components are "use client", so this uses the browser client.

import { createClient } from './client'
import type { FollowUp } from '@/types/database'

export async function getFollowUps(
  entityType: string,
  entityId: string
): Promise<FollowUp[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true })

  if (error) throw new Error(error.message)
  return data as FollowUp[]
}

export interface OverdueFollowUp extends FollowUp {
  entity_name: string
}

export async function getOverdueFollowUps(
  entityType?: string
): Promise<OverdueFollowUp[]> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('follow_ups')
    .select('*')
    .eq('is_completed', false)
    .lt('due_date', today)

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  const { data, error } = await query.order('due_date', { ascending: true })
  if (error) throw new Error(error.message)

  const followUps = data as FollowUp[]
  if (followUps.length === 0) return []

  // Fetch entity names for job_openings
  const jobIds = [...new Set(followUps.filter(f => f.entity_type === 'job_opening').map(f => f.entity_id))]
  const companyIds = [...new Set(followUps.filter(f => f.entity_type === 'company').map(f => f.entity_id))]

  const nameMap = new Map<string, string>()

  if (jobIds.length > 0) {
    const { data: jobs } = await supabase
      .from('job_openings')
      .select('id, title')
      .in('id', jobIds)
    jobs?.forEach(j => nameMap.set(j.id, j.title))
  }

  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds)
    companies?.forEach(c => nameMap.set(c.id, c.name))
  }

  return followUps.map(f => ({
    ...f,
    entity_name: nameMap.get(f.entity_id) ?? 'Unknown',
  }))
}

export async function createFollowUp(data: {
  entity_type: string
  entity_id: string
  title: string
  due_date: string
}): Promise<FollowUp> {
  const supabase = createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Not authenticated')

  const { data: result, error } = await supabase
    .from('follow_ups')
    .insert({
      ...data,
      is_completed: false,
      created_by: userData.user.id,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return result as FollowUp
}

export async function toggleFollowUp(
  id: string,
  isCompleted: boolean
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('follow_ups')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function deleteFollowUp(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('follow_ups')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
