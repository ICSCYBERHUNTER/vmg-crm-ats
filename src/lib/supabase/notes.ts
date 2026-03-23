// Browser-side Supabase functions for notes.
// All note components are "use client", so this uses the browser client.

import { createClient } from './client'
import type { NoteEntityType, NoteType, NoteWithAuthor } from '@/types/database'

export async function fetchNotes(
  entityType: NoteEntityType,
  entityId: string,
  options?: { noteType?: NoteType }
): Promise<NoteWithAuthor[]> {
  const supabase = createClient()
  let query = supabase
    .from('notes')
    .select('*, profiles(full_name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)

  if (options?.noteType) {
    query = query.eq('note_type', options.noteType)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as NoteWithAuthor[]
}

export async function createNote(params: {
  entity_type: NoteEntityType
  entity_id: string
  content: string
  note_type: NoteType
  is_private: boolean
}): Promise<NoteWithAuthor> {
  const supabase = createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notes')
    .insert({
      ...params,
      created_by: userData.user.id,
    })
    .select('*, profiles(full_name)')
    .single()

  if (error) throw new Error(error.message)
  return data as NoteWithAuthor
}

export async function searchNotes(
  entityType: NoteEntityType,
  entityId: string,
  searchQuery: string
): Promise<NoteWithAuthor[]> {
  const trimmed = searchQuery.trim()
  if (!trimmed) return fetchNotes(entityType, entityId)

  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*, profiles(full_name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .textSearch('search_vector', trimmed, { type: 'plain', config: 'english' })

  if (error) throw new Error(error.message)
  return data as NoteWithAuthor[]
}

export async function deleteNote(noteId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)

  if (error) throw new Error(error.message)
}
