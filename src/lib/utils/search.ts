import {
  User,
  Building2,
  UserCircle,
  Briefcase,
  Search,
  type LucideIcon,
} from 'lucide-react'
import type { SearchResult } from '@/types/database'

// ─── Snippet parsing ─────────────────────────────────────────────────────────

interface SnippetSegment {
  text: string
  highlighted: boolean
}

export function parseSnippet(snippet: string): SnippetSegment[] {
  if (!snippet) return [{ text: '', highlighted: false }]

  // Normalize <b>...</b> to **...** so we handle both formats
  const normalized = snippet.replace(/<b>/g, '**').replace(/<\/b>/g, '**')

  const segments: SnippetSegment[] = []
  const parts = normalized.split('**')

  parts.forEach((part, index) => {
    if (part === '') return
    segments.push({
      text: part,
      highlighted: index % 2 === 1,
    })
  })

  return segments.length > 0 ? segments : [{ text: snippet, highlighted: false }]
}

// ─── URL mapping ─────────────────────────────────────────────────────────────

export function getSearchResultUrl(result: SearchResult, contactCompanyId?: string): string {
  switch (result.entity_type) {
    case 'candidate':
      return `/candidates/${result.entity_id}`
    case 'company':
      return `/companies/${result.entity_id}`
    case 'contact':
      if (contactCompanyId) {
        return `/companies/${contactCompanyId}`
      }
      return '#'
    case 'job_opening':
      return `/jobs/${result.entity_id}`
    default:
      return '#'
  }
}

// ─── Human-readable labels ───────────────────────────────────────────────────

const MATCH_SOURCE_LABELS: Record<string, string> = {
  candidate_record: 'Candidate',
  company_record: 'Company',
  note_general: 'Note (General)',
  note_phone_call: 'Note (Phone Call)',
  note_email: 'Note (Email)',
  note_interview_feedback: 'Note (Interview Feedback)',
  note_insight: 'Note (Insight)',
  job_record: 'Job Opening',
  work_history: 'Work History',
  rejection_reason: 'Rejection Reason',
}

export function getMatchSourceLabel(matchSource: string): string {
  return (
    MATCH_SOURCE_LABELS[matchSource] ??
    matchSource
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

// ─── Entity type icons ───────────────────────────────────────────────────────

const ENTITY_TYPE_ICONS: Record<string, LucideIcon> = {
  candidate: User,
  company: Building2,
  contact: UserCircle,
  job_opening: Briefcase,
}

export function getEntityTypeIcon(entityType: string): LucideIcon {
  return ENTITY_TYPE_ICONS[entityType] ?? Search
}

// ─── Entity type display labels ──────────────────────────────────────────────

const ENTITY_TYPE_LABELS: Record<string, string> = {
  candidate: 'Candidates',
  company: 'Companies',
  contact: 'Contacts',
  job_opening: 'Job Openings',
}

export function getEntityTypeLabel(entityType: string): string {
  return (
    ENTITY_TYPE_LABELS[entityType] ??
    entityType.charAt(0).toUpperCase() + entityType.slice(1)
  )
}
