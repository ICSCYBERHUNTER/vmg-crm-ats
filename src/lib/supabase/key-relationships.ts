'use client'

import { createClient } from './client'
import type { KeyRelationship, KeyRelationshipWithDetails } from '@/types/database'

export async function fetchKeyRelationships(): Promise<KeyRelationshipWithDetails[]> {
  const supabase = createClient()

  const { data: rows, error } = await supabase
    .from('key_relationships')
    .select('*')

  if (error) throw new Error(error.message)
  if (!rows || rows.length === 0) return []

  const detailed: KeyRelationshipWithDetails[] = []

  for (const row of rows) {
    if (row.entity_type === 'candidate') {
      const { data: candidate } = await supabase
        .from('candidates')
        .select('first_name, last_name, current_title, current_company, last_contacted_at')
        .eq('id', row.entity_id)
        .single()

      if (!candidate) continue

      const daysSince = candidate.last_contacted_at
        ? Math.floor((Date.now() - new Date(candidate.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
        : null

      detailed.push({
        ...row,
        name: `${candidate.first_name} ${candidate.last_name}`,
        title: candidate.current_title,
        company: candidate.current_company,
        company_id: null,
        last_contacted_at: candidate.last_contacted_at,
        days_since_contact: daysSince,
      })
    } else if (row.entity_type === 'company_contact') {
      const { data: contact } = await supabase
        .from('company_contacts')
        .select('first_name, last_name, title, last_contacted_at, company_id')
        .eq('id', row.entity_id)
        .single()

      if (!contact) continue

      let companyName: string | null = null
      if (contact.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', contact.company_id)
          .single()
        companyName = company?.name ?? null
      }

      const daysSince = contact.last_contacted_at
        ? Math.floor((Date.now() - new Date(contact.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
        : null

      detailed.push({
        ...row,
        name: `${contact.first_name} ${contact.last_name}`,
        title: contact.title,
        company: companyName,
        company_id: contact.company_id,
        last_contacted_at: contact.last_contacted_at,
        days_since_contact: daysSince,
      })
    }
  }

  // Sort: nulls first (never contacted), then descending by days_since_contact
  detailed.sort((a, b) => {
    if (a.days_since_contact === null && b.days_since_contact === null) return 0
    if (a.days_since_contact === null) return -1
    if (b.days_since_contact === null) return 1
    return b.days_since_contact - a.days_since_contact
  })

  return detailed
}

export async function addKeyRelationship(
  entityType: 'candidate' | 'company_contact',
  entityId: string,
  contextNote?: string
): Promise<KeyRelationship | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('key_relationships')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      context_note: contextNote || null,
      added_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) return null
  return data
}

export async function removeKeyRelationship(
  entityType: 'candidate' | 'company_contact',
  entityId: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('key_relationships')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)

  return !error
}

export async function updateKeyRelationshipNote(
  id: string,
  contextNote: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('key_relationships')
    .update({ context_note: contextNote })
    .eq('id', id)

  return !error
}

export async function isKeyRelationship(
  entityType: 'candidate' | 'company_contact',
  entityId: string
): Promise<boolean> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('key_relationships')
    .select('id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()

  if (error) return false
  return data !== null
}
