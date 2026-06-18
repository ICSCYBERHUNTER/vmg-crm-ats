import type { Company, CompanyDisposition } from '@/types/database'

// A prospect's soonest open follow-up (its "next step"), from the Tasks system.
export interface OpenTask {
  title: string
  due_date: string
}

export interface ProspectSignals {
  daysInStage: number | null
  neverContacted: boolean
  lastContactDays: number | null
  hasNextStep: boolean
  nextStepText: string | null
  dueStr: string | null
  overdue: boolean
  reasons: string[]
  attention: boolean
  score: number
}

// Whole-days elapsed since an ISO timestamp. Returns null for null/invalid input.
function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return null
  return Math.max(0, Math.floor(diff / 86_400_000))
}

// Today as YYYY-MM-DD (local), for string comparison against a DATE column.
export function todayStr(): string {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

// A prospect is on the ACTIVE worklist when its disposition is 'active' or unset.
// Any other disposition (on_hold, not_a_fit, future_target, no_terms_reached)
// "parks" it -- off the active worklist but NOT deleted (still on the Companies page,
// restorable by setting disposition back to Active).
export function isActiveDisposition(disposition: CompanyDisposition | null): boolean {
  return disposition == null || disposition === 'active'
}

type ProspectInput = Pick<
  Company,
  'prospect_stage_entered_at' | 'last_contacted_at' | 'next_step' | 'next_step_due_date'
>

// Single source of truth for prospect BD-health signals, shared by the Prospects
// worklist page and the dashboard Prospect Pipeline widget so "needs attention"
// means the same thing in both. Next step comes from the follow-ups / Tasks system
// (task), falling back to the legacy companies.next_step only when no open task exists.
export function analyzeProspect(
  company: ProspectInput,
  today: string,
  task?: OpenTask,
): ProspectSignals {
  const daysInStage = daysSince(company.prospect_stage_entered_at)
  const neverContacted = !company.last_contacted_at
  const lastContactDays = daysSince(company.last_contacted_at)

  const fallback = company.next_step && company.next_step.trim() ? company.next_step : null
  const nextStepText = task?.title ?? fallback
  const dueStr = task?.due_date ?? company.next_step_due_date
  const hasNextStep = !!nextStepText
  const overdue = !!dueStr && dueStr < today

  const reasons: string[] = []
  if (overdue) reasons.push('Next step overdue')
  if (!hasNextStep) reasons.push('No next step')
  if (neverContacted) reasons.push('Never contacted')
  else if (lastContactDays !== null && lastContactDays >= 30) reasons.push(`No contact ${lastContactDays}d`)

  let score = 0
  if (overdue) score += 1000
  if (neverContacted) score += 400
  if (!hasNextStep) score += 200
  if (lastContactDays !== null) score += Math.min(lastContactDays, 365)
  if (daysInStage !== null) score += Math.min(daysInStage, 365) * 0.5

  return {
    daysInStage,
    neverContacted,
    lastContactDays,
    hasNextStep,
    nextStepText,
    dueStr,
    overdue,
    reasons,
    attention: reasons.length > 0,
    score,
  }
}
