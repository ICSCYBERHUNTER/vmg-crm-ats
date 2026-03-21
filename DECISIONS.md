# Architecture Decisions Log

Quick reference for all locked-in decisions. Full context is in `PRD.md`.

## Stack
- **Frontend:** Next.js (App Router) + TypeScript
- **UI:** shadcn/ui + Tailwind CSS + dnd-kit (Kanban only)
- **Forms:** react-hook-form + zod
- **Database:** Supabase (PostgreSQL) — Free tier during dev, Pro before data import
- **Hosting:** Vercel (free tier)
- **Resume Parsing:** OpenClaw on separate machine

## Database Design
- **Unified notes table:** All notes (candidate, company, contact, job) in one table using `entity_type` + `entity_id` polymorphic pattern
- **Company dedup:** `domain` field (e.g., `dragos.com`) with unique constraint — NOT company name
- **Candidate documents:** Separate `candidate_documents` table, not a single column on candidates. Supports multiple files, types, and `is_primary` flag
- **Candidate ↔ Contact linking:** `linked_contact_id` / `linked_candidate_id` bidirectional link for people who are both candidates and client contacts
- **Fee tracking:** Fee percentage COPIED to placement record at placement time (immutable historical record)
- **Interview pipelines:** Dynamic stages per job opening (not preset templates). Stages stored in `pipeline_stages` table with `sort_order`
- **Prospect pipeline:** Fixed 4-stage (Targeted → Contacted → Negotiating → Closed). Stored directly on company record, NOT in a separate table
- **Search:** PostgreSQL full-text search (tsvector/tsquery), Level 1 smart defaults. Upgradeable to Level 2 boolean with zero DB changes

## UI Patterns
- **List views:** shadcn DataTable (TanStack Table)
- **Detail views:** Tabbed layout using shadcn Tabs + Cards
- **Kanban boards:** dnd-kit for drag-and-drop
- **Forms:** shadcn Form components + react-hook-form + zod
- **Global search:** shadcn Command component (cmd+k)
- **All notes visible by default**, optional `is_private` toggle

## User Management
- Solo user initially, eventually 2-3 users
- Roles: Admin (Mark) and Recruiter
- All data visible to all users (no siloing)
- Note privacy: optional per-note toggle, defaults to public

## Budget
- $0/month during development (Supabase free + Vercel free)
- ~$25-30/month in production (Supabase Pro)
