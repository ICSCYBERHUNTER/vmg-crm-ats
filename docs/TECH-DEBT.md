# Technical Debt Tracker

Items identified during development that aren't blocking but should be addressed when they cause friction or before major new features.

**Priority guide:**
- 🔴 Fix before it causes bugs — address in next session
- 🟡 Fix when working in that area — bundle with related work
- ⚪ Fix when it causes friction — no rush

---

## Open Items

### 🟡 Talent Pool Detail Page — Component Extraction
**File:** src/app/(dashboard)/talent-pools/[id]/page.tsx
**Issue:** Page is 450+ lines. Works fine but exceeds 200-line guideline.
**Fix when:** Sonnet starts making mistakes editing this file, or next time we add features to it.
**Suggested splits:**
- PoolMembersTable component (table + checkboxes + select all)
- PoolCandidateSearch component (search input + dropdown results)
- BulkSubmitToJobDialog component (modal + job picker + submit logic)

### ⚪ Remove Unused next_step Fields from Forms
**Files:** Company form, Job Opening form
**Issue:** `next_step` and `next_step_due_date` columns still exist in DB and are still in create/edit forms, but are no longer displayed on detail pages. Replaced by follow_ups system.
**Fix when:** Next time we touch those forms.

### ⚪ SCHEMA.md Out of Date
**File:** docs/SCHEMA.md
**Issue:** Does not reflect Phase 5A additions (work_history, resume parser fields), this session's additions (talent_pools, talent_pool_members), or schema changes (category/seniority refactor).
**Fix when:** Before onboarding a second developer or before a major schema-dependent feature.

### 🟡 Pagination — Candidates & Companies List Pages
**Files:** src/app/(dashboard)/candidates/page.tsx, src/app/(dashboard)/companies/page.tsx
**Issue:** Prompt was written for server-side pagination (25/page via Supabase .range()) but execution status is uncertain. MUST be confirmed working before bulk import of 2,000 resumes.
**Fix when:** Before Phase 5B bulk import.

---

## Resolved Items

(Move items here when fixed, with date)
