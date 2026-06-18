import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import type { Company } from '@/types/database'
import { ProspectStageControl } from './ProspectStageControl'
import { ProspectAddTask } from './ProspectAddTask'
import { ProspectLogTouch } from './ProspectLogTouch'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { EditableCompanyBadge } from '@/components/companies/EditableCompanyBadge'

// Computed urgency signals for a prospect. Built in the page (server) and passed
// down so this component stays purely presentational.
export interface ProspectAnalysis {
  daysInStage: number | null
  neverContacted: boolean
  lastContactDays: number | null
  hasNextStep: boolean
  nextStepText: string | null
  dueStr: string | null
  overdue: boolean
  reasons: string[]
  attention: boolean
}

type Tone = 'warn' | 'danger' | undefined

function MetaItem({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const color =
    tone === 'danger' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-foreground'
  return (
    <span className="text-xs text-muted-foreground">
      {label}: <span className={color}>{value}</span>
    </span>
  )
}

function formatDue(dueStr: string | null, overdue: boolean): { value: string; tone: Tone } {
  if (!dueStr) return { value: 'Not set', tone: undefined }
  // Parse YYYY-MM-DD as a local date (avoid UTC off-by-one).
  const [y, m, d] = dueStr.split('-').map(Number)
  const formatted = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return overdue ? { value: `${formatted} · overdue`, tone: 'danger' } : { value: formatted, tone: undefined }
}

export function ProspectCard({
  company,
  analysis,
}: {
  company: Company
  analysis: ProspectAnalysis
}) {
  const { attention, reasons, daysInStage, neverContacted, lastContactDays, hasNextStep, overdue, nextStepText, dueStr } =
    analysis

  const accent = attention
    ? overdue || neverContacted
      ? 'border-l-red-500/60'
      : 'border-l-amber-500/60'
    : 'border-l-transparent'

  const lastContact: { value: string; tone: Tone } = neverContacted
    ? { value: 'Never', tone: 'danger' }
    : {
        value: `${lastContactDays}d ago`,
        tone: lastContactDays !== null && lastContactDays >= 30 ? 'warn' : undefined,
      }

  const due = formatDue(dueStr, overdue)

  return (
    <div className={`rounded-lg border border-l-4 ${accent} bg-card p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/companies/${company.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {company.name}
        </Link>
        <ProspectStageControl companyId={company.id} stage={company.prospect_stage} />
        {company.priority && <PriorityBadge priority={company.priority} />}
        <EditableCompanyBadge companyId={company.id} field="disposition" value={company.disposition} />
        {attention && (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {reasons.join(' · ')}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <MetaItem
          label="Next step"
          value={nextStepText ?? 'Not set'}
          tone={hasNextStep ? undefined : 'warn'}
        />
        <MetaItem label="Due" value={due.value} tone={due.tone} />
        <MetaItem label="Last contact" value={lastContact.value} tone={lastContact.tone} />
        <MetaItem
          label="In stage"
          value={daysInStage !== null ? `${daysInStage}d` : '—'}
          tone={daysInStage !== null && daysInStage >= 60 ? 'warn' : undefined}
        />
        <div className="ml-auto flex items-center gap-1">
          <ProspectLogTouch companyId={company.id} />
          <ProspectAddTask companyId={company.id} />
        </div>
      </div>

      {company.why_target && (
        <p className="mt-2 line-clamp-1 text-xs text-muted-foreground/80">Why: {company.why_target}</p>
      )}
    </div>
  )
}
