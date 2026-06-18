# TODO — Current Phase

## Phase 1: Foundation (Weeks 1-3)
**Goal:** Candidate database with notes and search working

### Setup
- [x] Initialize Next.js project with TypeScript
- [x] Install and configure shadcn/ui + Tailwind CSS
- [x] Set up Supabase project (free tier)
- [x] Configure Supabase Auth (email/password)
- [x] Set up environment variables (.env.local)
- [ ] Deploy initial project to Vercel

### Database
- [x] Run Phase 1 migration: profiles, candidates, notes tables
- [x] Set up search_vector triggers on candidates
- [x] Set up search_vector triggers on notes
- [x] Set up update_last_contacted trigger on notes
- [x] Set up updated_at auto-timestamp triggers
- [x] Enable RLS on all Phase 1 tables
- [x] Create RLS policies for authenticated access
- [ ] Test full-text search with sample data

### Frontend
- [x] App shell: sidebar navigation + header
- [x] Auth: login page + protected routes
- [x] Candidate list page (DataTable with sorting, filtering, pagination)
- [x] Candidate detail page (Overview tab with all core fields)
- [x] Candidate create/edit form (react-hook-form + zod)
- [x] Notes component (add note, note list, note type badges)
- [x] Notes full-text search (basic search bar on candidate detail)
- [x] Candidate status badges (Active, Passive, Placed, Do Not Contact)
- [ ] Basic responsive layout

---

## Phase 2: Companies & Contacts (Weeks 4-5)
**Goal:** Company management with contacts CRUD

### Session 2A — Companies CRUD
- [x] Company types, validation, labels
- [x] Company data layer (server + client)
- [x] Company list page
- [x] Company detail page
- [x] Company create/edit form
- [x] Delete company
- [x] Company badges (status, pipeline stage, priority, disposition)

### Session 2B — Company Contacts CRUD
- [x] Contact types added to database.ts
- [x] Contact Zod validation schema
- [x] Contact display labels
- [x] Contact server data layer (contacts.ts)
- [x] Contact client data layer (contacts-client.ts)
- [x] ContactTypeBadge and InfluenceBadge components
- [x] Contacts section on company detail page
- [x] Contact detail page (with org structure, direct reports)
- [x] Contact create form (with Reports To dropdown)
- [x] Contact edit form
- [x] Delete contact button
- [x] Primary contact logic (only one per company)
- [x] Session 2C — Notes on contacts
- [x] Session 2D — Linked candidate/contact

---

## Upcoming Phases 

### Phase 3: Job Openings & Pipelines (Weeks 6-8) [x]
### Phase 4: Global Search & Dashboard (Weeks 8-9) [x]
### Phase 5: Resume & Import (Weeks 10-11) [x]
### Phase 6: Polish & Enhancement (Weeks 12+) [x]

See `docs/PRD.md` for full phase details.

---

## Ad Hoc / In Progress

### BD Worklist (Business Development tracking) — started 2026-06-17
Goal: turn the company-centric Prospect Pipeline (dashboard widget) into a daily
"who do I chase today" workflow. Chosen approach: dedicated prospect worklist
(audit option B). Audit finding: the BD schema is ~80% there (companies already
have next_step, next_step_due_date, disposition, priority, why_target, hiring_signal,
prospect_stage_entered_at); the gap is surfacing it. prospect_pipeline_history exists
but has 0 rows. Two parallel task systems exist (companies.next_step vs follow_ups)
and are not reconciled.
- Side fix (done 2026-06-17): enabled RLS + authenticated policies on
  company_documents (was the only table with RLS disabled), mirroring candidate_documents.
- [x] Session 1: Read-only Prospects worklist page (`/prospects`). Server component,
  lists status='prospect' companies sorted by urgency (overdue next step / never
  contacted / no next step / stalled-in-stage first). New "Prospects" nav item.
  No schema change. (done 2026-06-17 — tsc clean. Files: src/app/(dashboard)/prospects/,
  src/components/prospects/ProspectCard.tsx, getProspects() in companies.ts, Sidebar.tsx)
- [x] Session 2 (core done 2026-06-17): Stage history + inline stage advance.
  - DB trigger `track_prospect_stage_change` (SECURITY DEFINER, fixed search_path):
    any prospect_stage change now writes prospect_pipeline_history + resets
    prospect_stage_entered_at. Verified on a throwaway company, test data removed,
    real data untouched. tsc + eslint clean.
  - Inline "Advance stage" on the worklist: src/components/prospects/ProspectStageControl.tsx;
    ProspectCard restructured (name links out, stage badge is an editable popover).
  - DEFERRED (optional): inline "Log a touch" composer on the worklist. Logging a touch
    already works on the company detail page (auto-bumps last_contacted_at + auto-advances
    researching/targeted -> contacted), so it's a convenience, not a blocker.
- [~] Session 3 (in progress): Reconcile task systems. DECISION (2026-06-17): Mark chose
  follow-ups as the single source of truth.
  - DONE: Worklist now shows each prospect's soonest OPEN follow-up as its "next step"
    (getSoonestOpenTaskByCompany in companies.ts; falls back to legacy companies.next_step
    only if no open task). Migrated the 2 existing company.next_step values into follow_ups
    (additive copy via SQL; originals left intact for now). tsc + eslint clean.
  - DONE (Session 3b, 2026-06-17): Dashboard Prospect Pipeline widget fixed — buckets now
    click through to the worklist pre-filtered (/prospects?stage=... and ?view=attention), and
    the dead "Closed" column is replaced by "Needs Attention". Attention logic is shared in
    src/lib/prospects.ts (analyzeProspect) so the widget and worklist agree. tsc + eslint clean.
  - DECISION (2026-06-17): Mark chose "index tasks first, then retire next_step."
  - DONE (2026-06-17): follow_ups is now full-text searchable (search_vector column + trigger
    follow_ups_search_update + GIN index + backfill of 34 rows). global_search_v3 = v2 + a
    follow_ups branch that attributes each task match to its PARENT entity (company/candidate/
    contact/job), so a matching task surfaces that record -- same behavior next_step had. v3 was
    built by copying v2's live body programmatically (no retyping); v2 left intact for rollback.
    Isolation-tested (v3 finds task-only text as its parent company; v2 returns nothing) and
    regression-checked. App now calls global_search_v3 in src/lib/supabase/search.ts and the
    smart-search route fallback. tsc clean.
  - FINDING (2026-06-17): next_step is NOT in the company form or detail UI at all (legacy column
    only) -- nothing to retire from the UI. Left as harmless searchable legacy; worklist uses it
    only as a fallback when a company has no open task.
  - DONE (2026-06-17): Worklist parking/removal. A prospect shows on the worklist only when its
    disposition is Active (or null); any other disposition (on_hold/not_a_fit/future_target/
    no_terms_reached) PARKS it off the active worklist (not deleted, still on Companies page).
    Shared helper isActiveDisposition (src/lib/prospects.ts); applied in worklist page (active/
    parked split, ?view=parked, "N parked" link) + dashboard widget counts. Inline disposition
    control on each worklist card (reuses EditableCompanyBadge) to park/restore from the page.
    tsc(src) + eslint clean. Verified: Saudi Aramco (On Hold) now parked; 6 active prospects.
  - DONE (2026-06-17): inline "Add task" on each worklist card (src/components/prospects/
    ProspectAddTask.tsx; creates a company follow-up = the prospect's next step, re-sorts on add).
    tsc(src) + eslint clean.
  - DONE (2026-06-17): inline "Log a touch" on each worklist card (src/components/prospects/
    ProspectLogTouch.tsx; createActivity on the company -> updates last_contacted_at + auto-advances
    researching/targeted to Contacted, which the stage trigger records as history; re-sorts on log).
    tsc(src) + eslint clean.
  - OPTIONAL (later): fully drop the legacy next_step column (currently harmless searchable legacy).

- [x] Session 4C: Dashboard — Home Screen (home screen widgets: quick stats, prospect pipeline, active jobs, overdue next steps, pipeline snapshot)
- [x] Session 5A: Candidate Document Upload & Management (upload/view/delete/primary docs on candidate detail)
- [x] **Global search: exact phrase matching (quoted segments)** (started + completed 2026-05-24; cleanup migration to drop legacy global_search() planned ~2026-06-07)
  Add support for `"…"` double-quoted segments in the global keyword search.
  Pattern: parallel-function-then-rename — creates `global_search_v2()` alongside
  the existing `global_search()` so rollback is one line. New function adds a
  `phrases text[] DEFAULT '{}'` parameter; TS parser in `src/lib/supabase/search.ts`
  splits a query into loose words + phrases. Loose words keep current behavior
  (prefix tsquery + AND); each phrase becomes `phraseto_tsquery('english', …)`;
  combined with `&&`. Name-boost CTE uses loose + phrases concatenated so quoted
  names still trigger the prefix shortcut. Single-word quoted = exact stem (no
  prefix). Touches: new SQL migration, src/lib/supabase/search.ts,
  src/app/api/smart-search/route.ts (embed-failure fallback), and
  src/components/layout/SearchBar.tsx (placeholder text).
  Old `global_search()` stays in place; cleanup migration to drop it follows
  after 1-2 weeks of v2 in production.

## Phase 4 Smart Search — post-launch todos

### High priority

- [ ] **Phase 4.5 — Resume Text Embedding**
  Address the resume content gap: full PDF/DOCX content in 
  `candidate_documents` is not currently embedded or searchable. Affects 
  every candidate where the formal resume has more detail than parsed 
  LinkedIn data. Verified: candidate "Roller Blading" only in resume 
  PDF, not findable via search.
  Open architectural questions to resolve at Phase 4.5 start:
  - Storage location: new column on `candidates` (e.g., `resume_text`) 
    OR new column on `candidate_documents` (e.g., `extracted_text`)?
  - Which resume(s) to embed when a candidate has multiple: primary 
    only, most recent, or all concatenated?
  - Char budget strategy for combining resume text into the existing 
    5,000-char candidate embedding cap
  - Trigger logic: extract text on document upload; re-embed candidate 
    on document add/delete/primary-change
  - Backfill: extract + re-embed all existing candidates with resumes

- [x] ] **Tune Smart Search match thresholds after 10-15 real searches**
  Provisional values shipped in Phase 4 in `src/lib/voyage/config.ts`:
  - `STRONG_MATCH_THRESHOLD = 0.70`
  - `GOOD_MATCH_THRESHOLD = 0.40`
  Review actual rerank `relevance_score` distributions via DevTools 
  Network tab (`_debug` payload on /api/smart-search responses) and 
  adjust thresholds based on observed data.

- [ ] **Gate Smart Search `_debug` payload behind admin/dev check**
  Before adding any non-admin users to the CRM. The `_debug` field in 
  the `/api/smart-search` response (timings, truncations, raw rerank 
  scores) is useful for calibration but should not be visible to end 
  users in production. Add an admin role check before including it in 
  the response.

### Medium priority

- [ ] **Audit Smart Search miss patterns post-launch**
  Track which queries return zero or weak results to inform tuning. 
  Look for systematic gaps (e.g., specific role types, terminology, 
  legacy candidates from before the parser shipped). Helps decide 
  whether per-entity char limits or retrieval counts need adjustment.

- [ ] **Reconcile stale documentation: docs/migration_001_initial_schema.sql**
  Confirmed drift between migration file and live DB:
  - `candidates_search_update` trigger in live DB includes `headline` 
    and `certifications` (B-weight); migration file does not
  - `global_search()` in live DB has 8 UNION ALL branches (adds 
    company_contacts, activities, work_history); migration file shows 
    only 5
 