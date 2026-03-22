// Browser-side Supabase functions for use in "use client" components.
// Uses createBrowserClient (no next/headers), safe to import from client components.
// Server Components that need job data should use server.ts directly.

import { createClient } from './client'
import type { JobOpening, JobOpeningInsert, JobOpeningUpdate, JobStatus, Priority } from '@/types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOB_SELECT = `
  *,
  companies!company_id ( name ),
  company_contacts!hiring_manager_id ( first_name, last_name )
` as const

function mapRow(row: Record<string, unknown>): JobOpening {
  const companies = row.companies as { name: string } | null
  const contact = row.company_contacts as { first_name: string; last_name: string } | null

  const base = { ...row } as unknown as JobOpening
  base.company_name = companies?.name ?? undefined
  base.hiring_manager_name = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : undefined
  // Remove nested join objects from the returned record
  const mutable = base as unknown as Record<string, unknown>
  delete mutable.companies
  delete mutable.company_contacts
  return base
}

// ─── Read ──────────────────────────────────────────────────────────────────────

interface JobFilters {
  status?: JobStatus
  priority?: Priority
  company_id?: string
}

export async function fetchJobOpenings(filters?: JobFilters): Promise<JobOpening[]> {
  const supabase = createClient()
  let query = supabase
    .from('job_openings')
    .select(JOB_SELECT)

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.priority) query = query.eq('priority', filters.priority)
  if (filters?.company_id) query = query.eq('company_id', filters.company_id)

  // Sort: high priority first, then newest
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
  const { data, error } = await query.order('opened_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Record<string, unknown>[]
  const mapped = rows.map(mapRow)

  // Client-side priority sort (DB doesn't support custom enum ordering easily)
  mapped.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority ?? 'low'] ?? 3
    const pb = PRIORITY_ORDER[b.priority ?? 'low'] ?? 3
    if (pa !== pb) return pa - pb
    return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
  })

  return mapped
}

export async function fetchJobOpening(id: string): Promise<JobOpening | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('job_openings')
    .select(JOB_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return mapRow(data as Record<string, unknown>)
}

// ─── Write ─────────────────────────────────────────────────────────────────────

export async function createJobOpening(data: JobOpeningInsert): Promise<JobOpening> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const payload = {
    ...data,
    created_by: user?.id ?? null,
    opened_at: data.opened_at ?? new Date().toISOString(),
  }

  const { data: created, error } = await supabase
    .from('job_openings')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created as JobOpening
}

export async function updateJobOpening(id: string, data: JobOpeningUpdate): Promise<JobOpening> {
  const supabase = createClient()

  // Fetch current status for transition logic
  const { data: current, error: fetchError } = await supabase
    .from('job_openings')
    .select('status, filled_at, closed_at')
    .eq('id', id)
    .single()

  if (fetchError) throw new Error(fetchError.message)

  const updates: Record<string, unknown> = { ...data }

  if (data.status && data.status !== current.status) {
    if (data.status === 'filled') {
      updates.filled_at = new Date().toISOString()
    } else if (data.status === 'cancelled') {
      updates.closed_at = new Date().toISOString()
    }

    if (current.status === 'filled' && data.status !== 'filled') {
      updates.filled_at = null
    }
    if (current.status === 'cancelled' && data.status !== 'cancelled') {
      updates.closed_at = null
    }
  }

  const { data: updated, error } = await supabase
    .from('job_openings')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return updated as JobOpening
}

export async function deleteJobOpening(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('job_openings')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Dropdown helpers ──────────────────────────────────────────────────────────

export async function fetchClientCompanies(): Promise<{ id: string; name: string }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .eq('status', 'client')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchCompanyContacts(
  companyId: string
): Promise<{ id: string; first_name: string; last_name: string }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('company_contacts')
    .select('id, first_name, last_name')
    .eq('company_id', companyId)
    .order('last_name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}
