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

### ⚪ Parallel getEntityUrl Helpers in TasksWidget and TaskList
**Files:** src/components/dashboard/TasksWidget.tsx, src/components/task-list.tsx
**Issue:** Both files maintain their own copy of `getEntityUrl`. Any new entity types or route changes must be made in both files.
**Why kept separate:** The two `TaskRow` components have diverged in ~7 meaningful ways — extracting a shared helper would require threading additional props through both without meaningful gain.
**Fix when:** A third call site appears, or the routing logic grows complex enough that duplication becomes a real maintenance hazard.

---

## Resolved Items

### ✅ Pagination — Candidates & Companies List Pages — 2026-04-10
**Files:** src/app/(dashboard)/candidates/page.tsx, src/app/(dashboard)/companies/page.tsx
Server-side pagination confirmed implemented: both pages use `PAGE_SIZE = 25`, call their Supabase helpers with `(page, pageSize)`, and both helpers use `.range()`. Count is returned and passed to the table components. Ready for bulk import.

### ✅ Remove Unused next_step Fields from Forms — 2026-04-10
**Files:** Company form, Job Opening form
`next_step` and `next_step_due_date` were removed from all create/edit forms. DB columns still exist (and the type in `database.ts` reflects that) but no form exposes them to users. Replaced by the follow_ups system.
