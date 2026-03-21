# CLAUDE.md — Project Rules for CRM

## Project Overview

This is a direct-hire recruiting CRM for Verge Management Group (an OT cybersecurity recruiting agency). It tracks candidates, companies, job openings, interview pipelines, and notes — with full-text search as the #1 priority feature.

**Owner:** Mark (non-developer, vibe-coding with AI assistance)
**Purpose:** Internal recruiting tool, starting as solo user, eventually 2-3 users

## Tech Stack (MANDATORY — No Substitutions)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict mode) |
| UI Components | shadcn/ui ONLY |
| Styling | Tailwind CSS ONLY |
| Forms | react-hook-form + zod |
| Drag & Drop | dnd-kit (Kanban boards only) |
| Icons | lucide-react ONLY |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| File Storage | Supabase Storage |
| Hosting | Vercel |

**DO NOT install** MUI, Ant Design, Chakra UI, styled-components, CSS modules, react-beautiful-dnd, AG Grid, or any other UI/styling/component library. If shadcn doesn't have it, build it with Tailwind.

## Critical Rules

### Search Is Sacred
1. **NEVER change notes to rich text, HTML, or JSON.** Notes are plain text. The search system depends on this.
2. **Every new text field** on candidates, companies, company_contacts, or job_openings must be evaluated for `search_vector` inclusion. If a recruiter might search for it, add it to the trigger.
3. **Every search_vector trigger change** requires a review of the `global_search()` function.
4. **New tables with searchable text** must be added to `global_search()` as a new UNION ALL block.
5. **Test search after every schema change.** Insert a record, search for it, confirm it appears.

## Overengineering Rules
- Build the SIMPLEST solution that satisfies the current requirement
- Do NOT add abstractions, patterns, or utilities "for later"
- Do NOT add mock data unless you get approval

### Database Rules
6. **Unified notes table.** ALL notes (candidate, company, contact, job) go in the single `notes` table using the `entity_type` + `entity_id` pattern. NEVER create separate note tables.
7. **Company dedup by domain.** The `domain` field on companies has a unique constraint on `LOWER(domain)`. Never weaken this.
8. **Fee percentage is copied.** When creating a placement, COPY the fee percentage from the company record. Never reference it dynamically.
9. **RLS on every table.** Every new table must have Row Level Security enabled.
10. **Private notes** are only visible to the creator and admin users.

### Code Quality
11. **No `any` types** in TypeScript. Define proper types for everything.
12. **Components under 200 lines.** Split if larger.
13. **Three states for every data-fetching component:** loading (Skeleton), error, empty.
14. **Server Components by default.** Only add `"use client"` when interactivity is needed.
15. **No `console.log` in production code.** Use proper error handling.
16. **No hardcoded secrets.** All API keys and URLs use environment variables.

### File Structure
```
src/app/          → Pages (Next.js App Router)
src/components/   → React components organized by feature
  ui/             → shadcn/ui components (do not manually edit)
  layout/         → App shell components
  candidates/     → Candidate-specific components
  companies/      → Company-specific components
  jobs/           → Job-specific components
  notes/          → Note components (shared across entities)
  pipeline/       → Kanban board components
  shared/         → Reusable components (status badges, search bar, etc.)
src/lib/          → Utilities, Supabase client, hooks
src/types/        → TypeScript types matching database schema
```

## Reference Documents
These are large documents. DO NOT read them on every message. 
Only read the specific document needed for the current task. 
- `docs/PRD.md` — Complete feature plan with all decisions
- `docs/SCHEMA.md` — Database schema with all tables, indexes, triggers, and the global_search function
- `docs/SEARCH-RULES.md` — Search safety rules (read before touching anything search-related)

## Subagents Available

- **schema-guardian** — Reviews database changes. Invoke for any SQL, migration, or schema work.
- **search-tester** — Tests search functionality. Invoke after any change that could affect search.
- **ui-builder** — Builds frontend components. Invoke for any UI work.
- **code-reviewer** — Reviews code quality. Invoke before committing.

## Phase Plan

We are building in phases. Check `TODO.md` for the current phase and active tasks. Do not build features from later phases unless explicitly asked.
## TODO Workflow
- Before starting ANY work, read TODO.md and identify the current active task
- Only work on Phase 1 tasks. Ignore everything below the "Upcoming Phases" line
- After completing a task, UPDATE TODO.md — check the box [ ] → [x]
- If a task is ambiguous or blocked, note it in TODO.md and ask Mark before proceeding
- Never start a new task without confirming the previous one is checked off
- If Mark asks to work on something outside the current TODO plan, 
  add it as a new item under an ## Ad Hoc / In Progress section 
  in TODO.md before starting work on it
## Communication Style

Mark is a beginner developer. When explaining something:
- Be specific and direct
- Don't assume prior knowledge unless he's demonstrated it
- When in doubt, ASK before making changes — never break existing code
- Prefer honesty over encouragement — if something is a bad idea, say so
