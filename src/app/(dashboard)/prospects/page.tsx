import Link from 'next/link'
import { getProspects, getSoonestOpenTaskByCompany } from '@/lib/supabase/companies'
import { analyzeProspect, todayStr, isActiveDisposition, type OpenTask } from '@/lib/prospects'
import { ProspectCard } from '@/components/prospects/ProspectCard'
import { PROSPECT_STAGE_LABELS } from '@/lib/utils/labels'
import type { Company, ProspectPipelineStage } from '@/types/database'

const STAGE_KEYS: ProspectPipelineStage[] = [
  'researching',
  'targeted',
  'contacted',
  'negotiating_fee',
  'closed',
]

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; view?: string }>
}) {
  const { stage, view } = await searchParams
  const stageFilter =
    stage && STAGE_KEYS.includes(stage as ProspectPipelineStage)
      ? (stage as ProspectPipelineStage)
      : null
  const attentionOnly = view === 'attention'
  const parkedView = view === 'parked'

  let prospects: Company[]
  try {
    prospects = await getProspects()
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Prospects</h1>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load prospects. Check your Supabase connection and try refreshing.
          </p>
        </div>
      </div>
    )
  }

  const today = todayStr()
  let taskMap = new Map<string, OpenTask>()
  try {
    taskMap = await getSoonestOpenTaskByCompany(prospects.map((c) => c.id))
  } catch {
    // If tasks fail to load, fall back to the legacy next_step fields.
  }

  const ranked = prospects
    .map((c) => ({ company: c, signals: analyzeProspect(c, today, taskMap.get(c.id)) }))
    .sort((a, b) => b.signals.score - a.signals.score)

  // Active = on the worklist; parked = disposition set to something other than Active.
  const activeRanked = ranked.filter((r) => isActiveDisposition(r.company.disposition))
  const parkedRanked = ranked.filter((r) => !isActiveDisposition(r.company.disposition))
  const totalAttention = activeRanked.filter((r) => r.signals.attention).length

  let shown: typeof ranked
  let filterLabel: string | null
  if (parkedView) {
    shown = parkedRanked
    filterLabel = 'Parked'
  } else {
    shown = activeRanked
    if (stageFilter) shown = shown.filter((r) => r.company.prospect_stage === stageFilter)
    if (attentionOnly) shown = shown.filter((r) => r.signals.attention)
    filterLabel = stageFilter
      ? PROSPECT_STAGE_LABELS[stageFilter]
      : attentionOnly
        ? 'Needs attention'
        : null
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Prospects</h1>
        <p className="text-sm text-muted-foreground">
          {activeRanked.length} active prospect{activeRanked.length !== 1 ? 's' : ''}
          {totalAttention > 0 && (
            <>
              {' · '}
              <span className="text-amber-400">{totalAttention} need attention</span>
            </>
          )}
          {parkedRanked.length > 0 && (
            <>
              {' · '}
              <Link href="/prospects?view=parked" className="hover:text-foreground hover:underline">
                {parkedRanked.length} parked
              </Link>
            </>
          )}
        </p>
      </div>

      {filterLabel && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtered:</span>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium">{filterLabel}</span>
          <Link
            href="/prospects"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear
          </Link>
        </div>
      )}

      {parkedView && (
        <p className="text-sm text-muted-foreground">
          Parked prospects are off the active worklist. Set a card&apos;s disposition back to Active to restore it.
        </p>
      )}

      {shown.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="font-medium text-muted-foreground">
            {filterLabel ? 'No prospects match this filter' : 'No active prospects'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filterLabel
              ? 'Try clearing the filter above.'
              : 'Companies with status Prospect and an Active disposition appear here.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map(({ company, signals }) => (
            <ProspectCard key={company.id} company={company} analysis={signals} />
          ))}
        </div>
      )}
    </div>
  )
}
