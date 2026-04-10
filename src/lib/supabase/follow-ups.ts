// Browser-side Supabase functions for follow-ups.
// All follow-up components are "use client", so this uses the browser client.

import { createClient } from './client'
import type { FollowUp } from '@/types/database'

// ─── Enriched type ────────────────────────────────────────────────────────────

export interface FollowUpWithNames extends FollowUp {
  primary_name: string       // human-readable name of entity_type/entity_id
  secondary_name: string | null // human-readable name of secondary_entity_type/secondary_entity_id
}

// ─── Internal helper: batch-fetch display names for a set of entity ids ───────

async function buildNameMap(
  supabase: ReturnType<typeof createClient>,
  ids: {
    candidateIds: string[]
    contactIds: string[]
    companyIds: string[]
    jobIds: string[]
  }
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>()

  await Promise.all([
    ids.candidateIds.length > 0
      ? supabase
          .from('candidates')
          .select('id, first_name, last_name')
          .in('id', ids.candidateIds)
          .then(({ data }) =>
            data?.forEach(r => nameMap.set(r.id as string, `${r.first_name} ${r.last_name}`.trim()))
          )
      : Promise.resolve(),

    ids.contactIds.length > 0
      ? supabase
          .from('company_contacts')
          .select('id, first_name, last_name')
          .in('id', ids.contactIds)
          .then(({ data }) =>
            data?.forEach(r => nameMap.set(r.id as string, `${r.first_name} ${r.last_name}`.trim()))
          )
      : Promise.resolve(),

    ids.companyIds.length > 0
      ? supabase
          .from('companies')
          .select('id, name')
          .in('id', ids.companyIds)
          .then(({ data }) =>
            data?.forEach(r => nameMap.set(r.id as string, r.name as string))
          )
      : Promise.resolve(),

    ids.jobIds.length > 0
      ? supabase
          .from('job_openings')
          .select('id, title, companies!company_id(name)')
          .in('id', ids.jobIds)
          .then(({ data }) =>
            data?.forEach(r => {
              // IMPORTANT: Supabase returns the joined relation as an array
              const coName = (r.companies as { name: string }[] | null)?.[0]?.name
              nameMap.set(r.id as string, coName ? `${r.title} @ ${coName}` : (r.title as string))
            })
          )
      : Promise.resolve(),
  ])

  return nameMap
}

// ─── Internal helper: enrich a raw FollowUp[] with primary/secondary names ───

async function enrichWithNames(
  supabase: ReturnType<typeof createClient>,
  followUps: FollowUp[]
): Promise<FollowUpWithNames[]> {
  if (followUps.length === 0) return []

  // Collect all unique entity ids grouped by entity_type (primary + secondary)
  const byType: Record<string, Set<string>> = {}
  for (const f of followUps) {
    if (!byType[f.entity_type]) byType[f.entity_type] = new Set()
    byType[f.entity_type].add(f.entity_id)
    if (f.secondary_entity_type && f.secondary_entity_id) {
      if (!byType[f.secondary_entity_type]) byType[f.secondary_entity_type] = new Set()
      byType[f.secondary_entity_type].add(f.secondary_entity_id)
    }
  }

  const nameMap = await buildNameMap(supabase, {
    candidateIds: [...(byType['candidate'] ?? [])],
    contactIds: [...(byType['contact'] ?? [])],
    companyIds: [...(byType['company'] ?? [])],
    jobIds: [...(byType['job_opening'] ?? [])],
  })

  return followUps.map(f => ({
    ...f,
    primary_name: nameMap.get(f.entity_id) ?? '—',
    secondary_name: f.secondary_entity_id
      ? (nameMap.get(f.secondary_entity_id) ?? '—')
      : null,
  }))
}

// ─── Public: fetch all tasks for an entity (primary OR secondary) ─────────────

export async function getFollowUps(
  entityType: string,
  entityId: string
): Promise<FollowUpWithNames[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .or(
      `and(entity_type.eq.${entityType},entity_id.eq.${entityId}),and(secondary_entity_type.eq.${entityType},secondary_entity_id.eq.${entityId})`
    )
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true })

  if (error) throw new Error(error.message)
  return enrichWithNames(supabase, data as FollowUp[])
}

// ─── Public: fetch all incomplete tasks due within the next 7 days ────────────
// Includes overdue tasks (due_date < today). Enriched with entity names.
// Date arithmetic uses local date parts to avoid timezone shift bugs.

export async function fetchUpcomingTasks(): Promise<FollowUpWithNames[]> {
  const supabase = createClient()

  // Build today and +7 days as YYYY-MM-DD using local date parts
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
  const limitStr = `${limit.getFullYear()}-${pad(limit.getMonth() + 1)}-${pad(limit.getDate())}`

  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('is_completed', false)
    .lte('due_date', limitStr)
    .order('due_date', { ascending: true })

  if (error) throw new Error(error.message)

  // Filter out anything past our window on the far end (shouldn't happen, but safe)
  const raw = (data as FollowUp[]).filter(f => f.due_date <= limitStr)
  void todayStr // used by callers for grouping

  return enrichWithNames(supabase, raw)
}

// ─── Overdue follow-ups (legacy — used by dashboard OverdueNextSteps) ────────

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

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createFollowUp(data: {
  entity_type: string
  entity_id: string
  title: string
  due_date: string
  secondary_entity_type?: string
  secondary_entity_id?: string
}): Promise<FollowUp> {
  const supabase = createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Not authenticated')

  const { data: result, error } = await supabase
    .from('follow_ups')
    .insert({
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      title: data.title,
      due_date: data.due_date,
      ...(data.secondary_entity_type && data.secondary_entity_id
        ? {
            secondary_entity_type: data.secondary_entity_type,
            secondary_entity_id: data.secondary_entity_id,
          }
        : {}),
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

export async function toggleFollowUpComplete(
  id: string,
  isCompleted: boolean
): Promise<void> {
  return toggleFollowUp(id, isCompleted)
}

export async function deleteFollowUp(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('follow_ups')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
