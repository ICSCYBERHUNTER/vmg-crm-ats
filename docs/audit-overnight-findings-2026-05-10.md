# VMG CRM — Overnight Audit Findings (2026-05-10)

## Headline

Of 5,766 candidates in the pool, **1,400 (24.3%) are "thin candidate, rich history"** — these candidates have sparse `search_vector` data but substantial work history descriptions sitting in a separate table that the current trigger ignores. The planned trigger fix to join `work_history` into `candidates_search_update()` directly unlocks these records for keyword search. Another **724 (12.6%)** are thin everywhere and need upstream enrichment (better scraping or manual data entry) — no trigger fix will help them. **2,033 (35.3%)** are already rich across the board, and **1,609 (27.9%)** fall in a moderate middle ground.

---

## Phase 1 — Pool-Wide Bucketing

Methodology: `candidate_sv_len` = `length(search_vector::text)` from the candidates table. `work_history_text_total` = `SUM(length(description))` across all `work_history` rows for that candidate.

| Bucket | Criteria | Count | % of Pool |
|--------|----------|------:|----------:|
| **rich_everywhere** | sv_len >= 700 AND wh_text >= 500 | 2,033 | 35.3% |
| **thin_candidate_rich_history** | sv_len < 500 AND wh_text >= 500 | 1,400 | 24.3% |
| **thin_everywhere** | sv_len < 500 AND wh_text < 500 | 724 | 12.6% |
| **moderate** | everything else | 1,609 | 27.9% |
| **TOTAL** | | **5,766** | **100%** |

**Key takeaway:** The trigger fix is leveraged for 24.3% of the pool. These candidates have work history text that keyword search currently cannot see.

---

## Phase 2 — Hypothetical Fix Preview (10 Samples from "thin_candidate_rich_history")

For each sampled candidate: current search_vector lexeme count, top new lexemes their work_history would contribute, and an OT/ICS keyword spot-check.

| Name | SV Lexemes | Top New WH Lexemes (up to 15) | OT Keyword | In SV? | In WH? |
|------|----------:|-------------------------------|------------|--------|--------|
| Terrence Saxton | 19 | design, protection, security, solutions, build, network, based, make, solution, recommendations, train, staff, operation, maintenance, implemented | OT | YES | YES |
| Jodi Brown | 19 | lighting, systems, slts, provides, high, quality, control, equipment, pole, products, georgia, tennessee, mississippi, arkansas, louisiana | OT | YES | no |
| Michael Drummond | 14 | recruit, train, team, sales, engineers, midwest, specializing, data, analytics, automation, oversee, skill, development, performance, ranging | ICS | no | YES |
| Tonya Vincent | 22 | lead, marketing, strategy, driving, growth, customer, value, partners, drive, pipeline, logo, acquisition, programs, increased, engagement | OT | no | YES |
| Kevin Karaffa | 17 | global, accounts, include, dell, emc, exxon, chevron, schlumberger, halliburton, anadarko, managed, drove, sales, engagements, set | OT | no | YES |
| Steve Lee | 16 | vision, empower, organizations, understand, reduce, cybersecurity, risk, existential, threats, time, types, connected, devices, compute, platforms | ICS | no | YES |
| Susan Balman | 25 | senior, covering, industrial, cybersecurity, analysis, client, inquiries, consulting, projects, strategy, security, framework, compliance, list, goes | OT | no | YES |
| Dirk Karjack | 13 | cloud, enabling, sap, workloads, bias, towards, azure, north, american, market, softwareone, vmware, adapter, landscape, manager | SCADA | no | no |
| Pavlo Iusim | 20 | technical, operations, major, financial, institutions, paypal, interactive, brokers, mastercard, specializing, cryptocurrency, stablecoin, integration, built, managed | ICS | no | YES |
| Mike Stanton | 17 | darktrace, world, leading, company, cyber, security, created, mathematicians, enterprise, immune, system, uses, machine, learning, algorithms | OT | no | YES |

**Reading this table:** Each row is a candidate whose search_vector is thin but whose work_history is rich. The "Top New WH Lexemes" column shows words that would be **added** to keyword search by the trigger fix. The OT Keyword column shows a concrete example: is a specific OT/ICS term findable today (In SV?) vs. would it become findable after the fix (In WH?).

---

## Phase 3 — NULL `embedding_model_version` Investigation

**Count:** 22 candidates have NULL `embedding_model_version`.

**Pattern:** ALL have non-NULL embedding_updated_at — embeddings exist but model version was not written. Likely a code path that wrote embedding but skipped model_version.

**Created date range:** 2026-05-04 to 2026-05-09

**Source breakdown:**

| Source | Count |
|--------|------:|
| Other | 12 |
| LinkedIn | 10 |

**Affected candidates (sample up to 22):**

| Name | Created | Updated | Source | Has embedding_updated_at? |
|------|---------|---------|--------|--------------------------|
| Andrew McDonough | 2026-05-04 | 2026-05-05 | LinkedIn | YES |
| Josh Medley | 2026-05-04 | 2026-05-05 | LinkedIn | YES |
| Trevor Seale | 2026-05-04 | 2026-05-08 | LinkedIn | YES |
| Jackson Chilberg | 2026-05-04 | 2026-05-05 | Other | YES |
| Dennis Hange | 2026-05-04 | 2026-05-05 | LinkedIn | YES |
| Emily Lusk | 2026-05-04 | 2026-05-05 | LinkedIn | YES |
| Chris Barta | 2026-05-04 | 2026-05-05 | Other | YES |
| Ayoub Abdalla | 2026-05-04 | 2026-05-05 | Other | YES |
| Nicholas Kiser | 2026-05-04 | 2026-05-05 | Other | YES |
| Matt Deboer | 2026-05-04 | 2026-05-05 | Other | YES |
| Michael Okuly | 2026-05-04 | 2026-05-05 | Other | YES |
| John Kaiser | 2026-05-04 | 2026-05-08 | Other | YES |
| Blake Cole | 2026-05-05 | 2026-05-05 | LinkedIn | YES |
| Arshad Massomi | 2026-05-05 | 2026-05-06 | Other | YES |
| Kory Pruitt | 2026-05-05 | 2026-05-06 | LinkedIn | YES |
| Jose Mojica | 2026-05-05 | 2026-05-06 | Other | YES |
| Wes Roberts | 2026-05-05 | 2026-05-06 | Other | YES |
| John Newsome | 2026-05-05 | 2026-05-08 | Other | YES |
| Erika Franco | 2026-05-07 | 2026-05-08 | LinkedIn | YES |
| Perry Ulicnik | 2026-05-07 | 2026-05-08 | LinkedIn | YES |
| Clint Vericker | 2026-05-09 | 2026-05-09 | LinkedIn | YES |
| Jose Alegria Lopez | 2026-05-09 | 2026-05-09 | Other | YES |

**Diagnosis — CONFIRMED BUG:** The cron endpoint `src/app/api/cron/retry-embeddings/route.ts` writes embeddings with:

```ts
.update({ embedding: vector, embedding_updated_at: now })  // line 107
```

It omits `embedding_model_version`. The CLI backfill script (`scripts/backfill-embeddings.ts:113`) correctly writes all three fields:

```ts
.update({ embedding, embedding_updated_at, embedding_model_version: modelVersion })
```

All 22 affected candidates were created 2026-05-04 through 2026-05-09 and were embedded by the cron job, not the CLI script. **This is an active bug** — every future candidate embedded by the cron will also have NULL `embedding_model_version`. Fix: add `embedding_model_version` to the cron UPDATE payload for all five entity branches (candidates, companies, contacts, job_openings, notes).

---

## Phase 4 — Miscategorization Spot-Check

Candidates at known OT/ICS cybersecurity companies or with OT keywords in their profile, categorized in a potentially incorrect bucket.

| Name | Current Company | Current Title | Category | OT Signal |
|------|----------------|---------------|----------|-----------|
| Dan Cartmill | TXOne Networks | Senior Global Product Marketing Director | marketing | txone |
| Eric Knapp | Nozomi Networks | Product | product | nozomi |
| Vivek Ponnada | Frenos | SVP Growth & Strategy | (null) | nozomi |
| De Anne Olivares | (none) | (none) | marketing | txone |
| Andrew Rankin | TXOne Networks | Global Product Marketing Manager | marketing | txone |
| Victoria Mills | Artisan Design Tampa | Design Specialist | other | claroty |
| Christopher Phillips | Expel | VP of Customer Success | customer_success | armis |
| Mark W. | Armis | Director, Technical Customer Success - Strategic Accounts | customer_success | armis |
| Cory Plummer | Dragos, Inc. | Leader of Resident Engineering, Americas | customer_success | dragos |
| Michael Sakmar | (none) | (none) | customer_success | dragos |

**Note:** The valid category values are: sales, sales_engineering, channel, marketing, product, customer_success, operations, engineering, other. There is no "it" or "cybersecurity" category. Candidates at OT security companies doing compliance, product management, or customer success work may legitimately belong in their current category. The ones worth reviewing are those whose title clearly indicates a technical/security role but who are bucketed as "other" or "operations."

---

## Prioritization Recommendation

Based on the empirical pool data:

1. **Trigger fix (HIGH LEVERAGE)** — 1,400 candidates (24.3%) have rich work_history text that keyword search currently cannot see. This is the highest-ROI fix: one migration unlocks existing data for the entire thin-candidate-rich-history segment. No external API calls, no enrichment costs, no manual work.

2. **Category cleanup (MEDIUM LEVERAGE)** — 10 candidates at known OT companies appear potentially miscategorized. The category field drives search filtering and candidate matching. Miscategorized OT professionals won't surface for OT job searches. A targeted audit of candidates at the 15 known OT vendor companies would be quick (likely <100 records) and improve search precision.

3. **Enrichment (LOWER LEVERAGE, HIGHER COST)** — 724 candidates (12.6%) are thin everywhere. These need better upstream data — either re-scraping with deeper LinkedIn access, manual data entry, or third-party enrichment APIs. This is the most expensive fix per candidate and should be deprioritized until the trigger fix captures the easy wins.

**Recommended sequence:** Trigger fix this week → Category spot-check next → Enrichment backlog for later.

---

*Generated autonomously on 2026-05-10 by overnight audit script.*

**Go DAMN Dawgs!**
