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

### Validation
- [ ] Run schema-guardian review on all database code
- [ ] Run search-tester to verify full-text search works
- [ ] Run code-reviewer on all frontend code
- [ ] Manual testing: create candidate, add note, search for note text

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
- [ ] Session 2C — Notes on contacts
- [ ] Session 2D — Linked candidate/contact

---

## Upcoming Phases (DO NOT START YET)

### Phase 3: Job Openings & Pipelines (Weeks 6-8)
### Phase 4: Global Search & Dashboard (Weeks 8-9)
### Phase 5: Resume & Import (Weeks 10-11)
### Phase 6: Polish & Enhancement (Weeks 12+)

See `docs/PRD.md` for full phase details.

---

## Ad Hoc / In Progress

- [x] Session 4C: Dashboard — Home Screen (home screen widgets: quick stats, prospect pipeline, active jobs, overdue next steps, pipeline snapshot)
