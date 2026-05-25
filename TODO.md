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
  - `global_search()` in live DB uses `to_tsquery` with `:*` wildcard 
    prefix matching; migration file uses `plainto_tsquery`
  Decide: regenerate migration from live DB OR stop using the 
  `docs/migration_*.sql` files as a recon source of truth and rely 
  on direct Supabase SQL queries instead.

### Low priority

- [ ] **Truncation telemetry review at 2 weeks**
  Once Phase 4 has been live for ~2 weeks, check the `_debug.truncations` 
  array across real searches. If a high percentage of candidates are 
  getting truncated to fit the 5,000-char reranker limit, consider 
  bumping the cap in `RERANKER_CHAR_LIMITS` (in 
  `src/lib/voyage/config.ts`).

- [ ] **Voyage config consolidation (deferred from Phase 4)**
  Currently `VOYAGE_API_URL` and the embed model name are hardcoded 
  inside `src/lib/voyage/client.ts` and `src/lib/voyage/embed.ts`. 
  Phase 4 deliberately did not refactor these to avoid risk to working 
  Phase 1 code. Natural moment to consolidate is Phase 4.5 (Resume Text 
  Embedding), when those files will be touched anyway. At that point, 
  pull all Voyage constants into `src/lib/voyage/config.ts`.

---

## Smart Search — Post-Launch (Phase 4)

### High Priority
- Re-embed all stored entities with `input_type: 'document'`. Current embeddings were created without `input_type` set. Modify `embedText()` to accept the parameter, add `--force-reembed` flag to backfill script, re-run. ~3M tokens, within free tier. Quality bump expected.
- `hybrid_search()` SQL hardening: add `WHERE query_embedding IS NOT NULL` guard on semantic CTE so NULL/zero embeddings return zero rows instead of junk.

### Medium Priority
- Truncation telemetry review at 2 weeks. Some candidates truncate from 20k-30k chars to 5k cap. May need to prioritize recent work history over older entries.
- Voyage config consolidation: pull `VOYAGE_API_URL` and embed model name into `voyage/config.ts`. Natural moment is Phase 4.5 (Resume Text Embedding).
- Phase 4.5 Resume Text Embedding — storage location, char budget, trigger logic, backfill.
- Audit Smart Search miss patterns post-launch across 10-15 representative queries.
- Reconcile stale documentation: `docs/migration_001_initial_schema.sql` drift vs live DB.

### Low Priority
- Add `auth_ms` to `_debug.timings_ms` to close ~795ms unaccounted gap.
- `globalSearch()` divergence comment: API route embed-fallback bypasses wrapper, could silently diverge if wrapper evolves.
- Move `console.error` above race-protection check in `runKeywordSearch` catch block (cosmetic — stale requests log before discard).
- `global_search()` RPC statement timeout on stale race-condition requests — discarded by `shouldApplyResponse()`, user never sees it, but logs console noise.
- Gate `_debug` payload behind admin/dev check before adding non-admin users.
- Header search bar live typeahead dropdown (deferred to Phase 6 polish).
