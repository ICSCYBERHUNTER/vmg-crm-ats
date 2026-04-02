// Browser-side Supabase functions for activities.
// All activity components are "use client", so this uses the browser client.

import { createClient } from './client'
import type { ActivityEntityType, ActivityInsert, ActivityWithAuthor } from '@/types/database'

// Map component entity_type to database constraint value
function normalizeEntityType(entityType: ActivityEntityType): string {
  return entityType === 'contact' ? 'company_contact' : entityType
}

export async function fetchActivities(
  entityType: ActivityEntityType,
  entityId: string
): Promise<ActivityWithAuthor[]> {
  const supabase = createClient()
  const dbEntityType = normalizeEntityType(entityType)
  const { data, error } = await supabase
    .from('activities')
    .select('*, profiles(full_name)')
    .eq('entity_type', dbEntityType)
    .eq('entity_id', entityId)
    .order('activity_date', { ascending: false })

  if (error) throw new Error(error.message)
  return data as ActivityWithAuthor[]
}

export async function createActivity(params: ActivityInsert): Promise<ActivityWithAuthor> {
  const supabase = createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Not authenticated')

  const dbEntityType = normalizeEntityType(params.entity_type)
  const { data, error } = await supabase
    .from('activities')
    .insert({
      ...params,
      entity_type: dbEntityType,
      created_by: userData.user.id,
    })
    .select('*, profiles(full_name)')
    .single()

  if (error) throw new Error(error.message)

  // Update last_contacted_at on candidates and company_contacts
  if (params.entity_type === 'candidate' || params.entity_type === 'contact') {
    const table = params.entity_type === 'candidate' ? 'candidates' : 'company_contacts'
    const { data: entity } = await supabase
      .from(table)
      .select('last_contacted_at')
      .eq('id', params.entity_id)
      .single()

    if (entity) {
      const shouldUpdate =
        !entity.last_contacted_at ||
        new Date(params.activity_date) > new Date(entity.last_contacted_at)

      if (shouldUpdate) {
        await supabase
          .from(table)
          .update({ last_contacted_at: params.activity_date })
          .eq('id', params.entity_id)
      }
    }
  }

  // Auto-advance prospect_stage to 'contacted' for companies at early stages
  if (params.entity_type === 'company') {
    const { data: company } = await supabase
      .from('companies')
      .select('prospect_stage')
      .eq('id', params.entity_id)
      .single()

    if (
      company &&
      (company.prospect_stage === 'researching' || company.prospect_stage === 'targeted')
    ) {
      await supabase
        .from('companies')
        .update({
          prospect_stage: 'contacted',
          prospect_stage_entered_at: new Date().toISOString(),
        })
        .eq('id', params.entity_id)
    }
  }

  return data as ActivityWithAuthor
}

export async function deleteActivity(activityId: string): Promise<void> {
  const supabase = createClient()

  // Fetch before deleting so we know which entity to recalculate
  const { data: activity } = await supabase
    .from('activities')
    .select('entity_type, entity_id')
    .eq('id', activityId)
    .single()

  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)

  if (error) throw new Error(error.message)

  // Recalculate last_contacted_at from remaining activities
  if (
    activity &&
    (activity.entity_type === 'candidate' || activity.entity_type === 'company_contact')
  ) {
    const table = activity.entity_type === 'candidate' ? 'candidates' : 'company_contacts'

    const { data: remaining } = await supabase
      .from('activities')
      .select('activity_date')
      .eq('entity_type', activity.entity_type)
      .eq('entity_id', activity.entity_id)
      .order('activity_date', { ascending: false })
      .limit(1)

    const lastContactedAt =
      remaining && remaining.length > 0 ? remaining[0].activity_date : null

    await supabase
      .from(table)
      .update({ last_contacted_at: lastContactedAt })
      .eq('id', activity.entity_id)
  }
}
