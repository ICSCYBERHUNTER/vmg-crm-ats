# Tech Debt Log

## Completed Cleanups

### Dead Code Removal — Dashboard & Follow-ups (2026-04-19)

**Status:** ✅ COMPLETED

**What was removed:**
- 5 unused files deleted:
  - `src/lib/normalize.test.ts` (orphaned test file)
  - `src/components/jobs/OverdueJobTasks.tsx`
  - `src/components/dashboard/OverdueNextSteps.tsx`
  - `src/components/dashboard/PipelineSnapshot.tsx`
  - `src/components/ui/alert.tsx` (shadcn stub)

- Orphaned functions & types from `src/lib/supabase/follow-ups.ts`:
  - `OverdueFollowUp` interface
  - `getOverdueFollowUps()` function
  - Associated legacy comment block

- Orphaned functions & types from `src/lib/supabase/dashboard.ts`:
  - `OverdueItem` interface
  - `OverdueFollowUp` interface
  - `fetchOverdueNextSteps()` function
  - `PipelineSnapshotStage` interface
  - `fetchPipelineSnapshot()` function

**Why:** These components and functions were not imported or used anywhere in the codebase. They appeared to be abandoned features or experimental code.

**Testing:**
- ✅ `npm run build` — zero errors
- ✅ Dev server responds correctly
- ✅ All essential dashboard/follow-up functions remain intact:
  - `fetchQuickStats()`
  - `fetchProspectPipeline()`
  - `createFollowUp()`
  - `toggleFollowUp()`

**If issues appear:** Check git history to restore any removed code:
```bash
git log --oneline -- src/components/dashboard/
git show <commit>:path/to/file
```
