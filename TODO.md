# TODO — Current Phase

## Phase 1: Foundation (Weeks 1-3)
**Goal:** Candidate database with notes and search working

### Setup
- [ ] Initialize Next.js project with TypeScript
- [ ] Install and configure shadcn/ui + Tailwind CSS
- [ ] Set up Supabase project (free tier)
- [ ] Configure Supabase Auth (email/password)
- [ ] Set up environment variables (.env.local)
- [ ] Deploy initial project to Vercel

### Database
- [ ] Run Phase 1 migration: profiles, candidates, notes tables
- [ ] Set up search_vector triggers on candidates
- [ ] Set up search_vector triggers on notes
- [ ] Set up update_last_contacted trigger on notes
- [ ] Set up updated_at auto-timestamp triggers
- [ ] Enable RLS on all Phase 1 tables
- [ ] Create RLS policies for authenticated access
- [ ] Test full-text search with sample data

### Frontend
- [ ] App shell: sidebar navigation + header
- [ ] Auth: login page + protected routes
- [ ] Candidate list page (DataTable with sorting, filtering, pagination)
- [ ] Candidate detail page (Overview tab with all core fields)
- [ ] Candidate create/edit form (react-hook-form + zod)
- [ ] Notes component (add note, note list, note type badges)
- [ ] Notes full-text search (basic search bar on candidate detail)
- [ ] Candidate status badges (Active, Passive, Placed, Do Not Contact)
- [ ] Basic responsive layout

### Validation
- [ ] Run schema-guardian review on all database code
- [ ] Run search-tester to verify full-text search works
- [ ] Run code-reviewer on all frontend code
- [ ] Manual testing: create candidate, add note, search for note text

---

## Upcoming Phases (DO NOT START YET)

### Phase 2: Companies & Contacts (Weeks 4-5)
### Phase 3: Job Openings & Pipelines (Weeks 6-8)
### Phase 4: Global Search & Dashboard (Weeks 8-9)
### Phase 5: Resume & Import (Weeks 10-11)
### Phase 6: Polish & Enhancement (Weeks 12+)

See `docs/PRD.md` for full phase details.
