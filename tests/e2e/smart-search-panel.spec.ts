import { test, expect, type APIRequestContext } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

// ── Run directory (one per test invocation) ─────────────────────────────────
// Per-run subfolder under docs/results-custom holds the summary.md plus one
// JSON file per query containing the full /api/smart-search _debug payload.

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function timestamp(): string {
  const d = new Date()
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  )
}

const RUN_DIR = join(process.cwd(), 'docs', 'results-custom', `run-${timestamp()}`)
mkdirSync(RUN_DIR, { recursive: true })

// ── Panel definitions (source: docs/real-world-query-panel.md) ──────────────

type Coverage = { type: 'coverage' }
type Precision = {
  type: 'precision'
  expectedFirm: string[]
  expectedSoft: string[]
}
type Spec = { id: string; title: string; query: string; intent: string } & (Precision | Coverage)

const PANEL: Spec[] = [
  {
    id: 'Q1',
    title: 'Presales engineer / OT / Midwest',
    query:
      'Presales engineer who has experience in OT or Industrial cybersecurity and lives in the midwest',
    intent: 'OT presales sourcing; Midwest-based',
    type: 'precision',
    expectedFirm: ['Eric Johansen', 'Eric Visker'],
    expectedSoft: ['Adam Boeckmann'],
  },
  {
    id: 'Q2',
    title: 'Sales leader / startup / cyber / US',
    query:
      'Sales leader, who has startup experience building and scaling early stage companies in cybersecurity and lives in the united states',
    intent: 'Early-stage OT cyber sales-leader sourcing',
    type: 'precision',
    expectedFirm: ['Stephen Driggers', 'Troy Roberts'],
    expectedSoft: ['Obbe Knoop'],
  },
  {
    id: 'Q3',
    title: 'Customer success leader / building teams / cyber',
    query: 'Customer success leader who has experience building teams in cybersecurity',
    intent: 'Head-of-CS sourcing for a cyber vendor',
    type: 'precision',
    expectedFirm: ['Shri Chickerur', 'Sean Guzman Murphy'],
    expectedSoft: ['Dave Sunderland'],
  },
  {
    id: 'Q4',
    title: 'IC enterprise sales / startup / Southeast',
    query:
      'Individual contributor enterprise sales person who has worked at early stage or startup companies and lives in the Southeast united states',
    intent: 'IC enterprise sales sourcing; NOT a manager',
    type: 'precision',
    expectedFirm: ['Ben Callaway', 'David Smith', 'Sandy Dlugozima'],
    expectedSoft: [],
  },
  {
    id: 'Q5',
    title: 'Who do I know at Nozomi Networks?',
    query: 'Who do I know at Nozomi Networks?',
    intent: 'Relationship audit / coverage check',
    type: 'coverage',
  },
]

// ── Types matching SmartSearchResult + _debug from /api/smart-search ────────

type SearchResult = {
  entity_type: 'candidate' | 'company' | 'contact' | 'job_opening' | 'note'
  entity_id: string
  entity_name: string
  rerank_score: number | null
  match_label: 'Strong match' | 'Good match' | 'Possible match' | null
}

type SmartSearchResponse = {
  success: boolean
  data?: {
    results: SearchResult[]
    _debug: Record<string, unknown>
  }
  error?: string
}

// ── Per-test capture (collected, then written in afterAll) ──────────────────

type QueryFinding = {
  id: string
  title: string
  query: string
  intent: string
  results: SearchResult[]
  expectedHits: { name: string; firmness: 'firm' | 'soft'; position: number | null; label: string | null }[]
  coverage?: {
    companyInTop10: boolean
    contactCount: number
    candidateCount: number
    entityTypeMix: Record<string, number>
  }
  failures: string[]
}

const findings: QueryFinding[] = []

// ── API helpers ─────────────────────────────────────────────────────────────

async function callSmartSearch(
  request: APIRequestContext,
  query: string
): Promise<SmartSearchResponse> {
  const response = await request.post('/api/smart-search', {
    data: { query, includeNotes: false, entityScope: 'all' },
  })
  return response.json() as Promise<SmartSearchResponse>
}

function findPosition(results: SearchResult[], name: string): number | null {
  const idx = results.findIndex((r) => r.entity_name.toLowerCase() === name.toLowerCase())
  return idx === -1 ? null : idx + 1
}

function labelAt(results: SearchResult[], position: number | null): string | null {
  if (position === null) return null
  return results[position - 1]?.match_label ?? null
}

// ── Spec ────────────────────────────────────────────────────────────────────

test.describe('Smart Search — Real-World Query Panel', () => {
  for (const spec of PANEL) {
    test(`${spec.id}: ${spec.title}`, async ({ request }) => {
      // Hit the API directly with the authenticated context. The storageState
      // from auth.setup.ts carries the Supabase session cookie, so /api/smart-search
      // sees an authenticated user without us driving the UI.
      const apiResponse = await callSmartSearch(request, spec.query)
      expect(apiResponse.success, 'API returned success').toBe(true)

      const results = apiResponse.data!.results
      const debug = apiResponse.data!._debug

      // Persist full debug payload for later analysis.
      writeFileSync(
        join(RUN_DIR, `${spec.id.toLowerCase()}-debug.json`),
        JSON.stringify(
          {
            id: spec.id,
            title: spec.title,
            query: spec.query,
            intent: spec.intent,
            results,
            _debug: debug,
          },
          null,
          2
        )
      )

      const finding: QueryFinding = {
        id: spec.id,
        title: spec.title,
        query: spec.query,
        intent: spec.intent,
        results,
        expectedHits: [],
        failures: [],
      }

      if (spec.type === 'precision') {
        // Soft assertions — log misses to console and the summary, but don't
        // fail the run. Search quality is iterative; this panel is a probe,
        // not a regression gate.
        const top10 = results.slice(0, 10)

        for (const name of spec.expectedFirm) {
          const position = findPosition(top10, name)
          const label = labelAt(top10, position)
          finding.expectedHits.push({ name, firmness: 'firm', position, label })
          if (position === null) {
            finding.failures.push(`Expected (firm) "${name}" not in top 10`)
            // eslint-disable-next-line no-console
            console.warn(`[${spec.id}] MISS — firm expectation: ${name}`)
          }
        }

        for (const name of spec.expectedSoft) {
          const position = findPosition(top10, name)
          const label = labelAt(top10, position)
          finding.expectedHits.push({ name, firmness: 'soft', position, label })
          if (position === null) {
            // eslint-disable-next-line no-console
            console.warn(`[${spec.id}] miss (soft expectation): ${name}`)
          }
        }
      } else {
        // Coverage grading for Q5
        const top10 = results.slice(0, 10)
        const targetName = 'Nozomi Networks'

        const companyInTop10 = top10.some(
          (r) => r.entity_type === 'company' && r.entity_name.toLowerCase().includes('nozomi')
        )

        const fullResults = results
        const contactCount = fullResults.filter(
          (r) =>
            r.entity_type === 'contact' &&
            r.entity_name.toLowerCase().includes('nozomi')
        ).length

        // Candidate-at-Nozomi detection from name alone is unreliable; we
        // capture the count of all candidate hits in the full result set and
        // leave the actual "currently or formerly at Nozomi" judgment to the
        // session log reviewer (Mark).
        const candidateCount = fullResults.filter((r) => r.entity_type === 'candidate').length

        const entityTypeMix: Record<string, number> = {}
        for (const r of top10) {
          entityTypeMix[r.entity_type] = (entityTypeMix[r.entity_type] ?? 0) + 1
        }

        finding.coverage = { companyInTop10, contactCount, candidateCount, entityTypeMix }

        if (!companyInTop10) {
          finding.failures.push(`${targetName} company entity not in top 10`)
          // eslint-disable-next-line no-console
          console.warn(`[${spec.id}] coverage miss: company entity not in top 10`)
        }
      }

      findings.push(finding)
    })
  }

  test.afterAll(async () => {
    // Build a Markdown summary that mirrors the Session Log template at the
    // bottom of docs/real-world-query-panel.md.
    const lines: string[] = []
    lines.push(`# Smart Search Panel — Run ${timestamp()}`)
    lines.push('')
    lines.push('Source: `docs/real-world-query-panel.md`')
    lines.push('')
    lines.push('| Query | Expected in top 10? | Position(s) | Match labels | Notes |')
    lines.push('|---|---|---|---|---|')

    for (const f of findings) {
      if (f.id === 'Q5') {
        const c = f.coverage
        const expected = c ? (c.companyInTop10 ? '✓ company' : '✗ company') : '—'
        const positions = c
          ? `${c.contactCount} contact hit(s), ${c.candidateCount} candidate hit(s) total`
          : '—'
        const mix = c
          ? Object.entries(c.entityTypeMix)
              .map(([k, v]) => `${k}:${v}`)
              .join(', ')
          : '—'
        lines.push(`| ${f.id} | ${expected} | ${positions} | — | top10 mix: ${mix} |`)
        continue
      }

      const firm = f.expectedHits.filter((h) => h.firmness === 'firm')
      const soft = f.expectedHits.filter((h) => h.firmness === 'soft')
      const hits = firm.filter((h) => h.position !== null).length
      const total = firm.length
      const positions = firm
        .map((h) => `${h.name}${h.position !== null ? ` (#${h.position})` : ' (—)'}`)
        .join('; ')
      const labels = firm
        .filter((h) => h.label !== null)
        .map((h) => `${h.name}: ${h.label}`)
        .join('; ')
      const softNote =
        soft.length > 0
          ? `soft: ${soft.map((h) => `${h.name}${h.position !== null ? ` (#${h.position})` : ' (—)'}`).join(', ')}`
          : ''
      lines.push(
        `| ${f.id} | ${hits}/${total} firm | ${positions} | ${labels || '—'} | ${softNote || '—'} |`
      )
    }

    lines.push('')
    lines.push('## Per-query notes')
    lines.push('')
    for (const f of findings) {
      lines.push(`### ${f.id} — ${f.title}`)
      lines.push('')
      lines.push(`**Query:** \`${f.query}\``)
      lines.push('')
      lines.push(`**Intent:** ${f.intent}`)
      lines.push('')
      if (f.failures.length > 0) {
        lines.push('**Failures:**')
        for (const msg of f.failures) lines.push(`- ${msg}`)
        lines.push('')
      }
      lines.push(`**Top 10:**`)
      const top10 = f.results.slice(0, 10)
      for (let i = 0; i < top10.length; i++) {
        const r = top10[i]
        const score = r.rerank_score === null ? '—' : r.rerank_score.toFixed(4)
        const label = r.match_label ?? '—'
        lines.push(`${i + 1}. [${r.entity_type}] ${r.entity_name} — score ${score} — ${label}`)
      }
      lines.push('')
      lines.push(`**Full debug:** \`${f.id.toLowerCase()}-debug.json\``)
      lines.push('')
    }

    writeFileSync(join(RUN_DIR, 'summary.md'), lines.join('\n'))

    // eslint-disable-next-line no-console
    console.log(`\nPanel run complete. Artifacts: ${RUN_DIR}\n`)
  })
})
