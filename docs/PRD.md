# Direct-Hire Recruiting CRM — Feature Planning Document (FINAL)

**Project:** Mark's Recruiting CRM
**Date:** March 19, 2026
**Status:** LOCKED — All major decisions made. Ready for database schema design.

---

## Tech Stack (Confirmed)

| Layer | Choice | Cost |
|-------|--------|------|
| Frontend | Next.js (React for web) | Free |
| UI Framework | shadcn/ui + Tailwind CSS + dnd-kit (Kanban drag-and-drop only) | Free |
| Database + Auth + Storage | Supabase (PostgreSQL) — Start on Free tier (500MB DB / 1GB files), upgrade to Pro ($25/month) before real data import in Phase 5 | Free → $25/month |
| Hosting | Vercel (free tier) | Free |
| Resume Parsing (bulk) | OpenClaw on separate machine | Free (self-hosted) |
| Resume Parsing (daily) | OpenClaw or API call from app | Free/minimal |
| **Total Monthly Cost** | | **Free during dev → ~$25-30/month in production** |

---

## Key Design Decisions (Finalized)

| Decision | Answer | Rationale |
|----------|--------|-----------|
| Users | Solo at first, eventually 2-3 users | Supabase Auth + Row Level Security |
| Platform | Web app (browser-based) | Next.js + Vercel |
| UI Framework | shadcn/ui + Tailwind CSS for all components; dnd-kit for Kanban drag-and-drop only. No other UI libraries. | Own the code (not a dependency), best Next.js ecosystem support, AI coding tools generate highest quality code for shadcn |
| Supabase plan | Start on Free tier during development (Phases 1-4), upgrade to Pro ($25/month) before real data import in Phase 5 | Save money during dev, get backups before production data |
| Company deduplication | Web domain (e.g., `dragos.com`) as unique identifier, auto-stripped from full URLs, optional for companies without websites | More reliable than name matching — "Dragos" vs "Dragos, Inc." vs "DRAGOS" is ambiguous, but `dragos.com` is canonical |
| Candidate documents | Separate `candidate_documents` table supporting multiple files per candidate with types (Resume, CV, Cover Letter, etc.), `is_primary` flag, and version history | Future-proof — supports multiple versions, different doc types, no data loss on updates |
| Candidate ↔ Client Contact overlap | Linked records — "Also create as Candidate" button creates a second record pre-filled from the original, with a `linked_contact_id` connecting them. History preserved on both sides. | Simple, avoids complex dual-role data model |
| Note visibility | All notes visible to all users by default. Each note has a `created_by` field and an optional `private` toggle (visible only to creator + admin). | Defaults to open, privacy available if needed |
| Revenue tracking | Simple auto-calculation: Job marked "Filled" → enter base salary → system calculates fee from client's fee agreement percentage → stores as placement record. Dashboard sums all placements. | Phase 6 feature, minimal complexity |
| Search scope | Everything — notes, candidate names/titles/skills, company names, job descriptions | PostgreSQL full-text search indexes across all tables |
| Search level | Level 1: Smart defaults (AND, stemming, built-in to PostgreSQL). Upgradeable to Level 2 (AND/OR/NOT/quotes) later with zero database changes. | Covers 80% of real-world use cases, no over-engineering |
| Interview pipeline | Dynamic "add stages" approach per job opening. No preset templates at launch. "Save as Template" available in Phase 6. | Easier to code AND more flexible than templates |
| Decision maker hierarchy | Simple list with "Reports To" dropdown linking to another contact at same company. Visual org chart deferred. | Start simple, upgrade later |
| Budget | $20-50/month | Supabase Pro + Vercel free tier fits comfortably |

---

## How This Document Is Organized

Features are grouped by module. Each feature is tagged:

- ✅ **CONFIRMED** — Explicitly discussed and agreed upon
- 🔴 **REQUIRED** — Not explicitly discussed but essential for a functional CRM
- 🟡 **RECOMMENDED** — Strongly suggested, can be deferred if needed
- ⚪ **NICE TO HAVE** — Phase 6+ feature, build only if time permits

---

## MODULE 1: CANDIDATES

The talent database — people you are recruiting.

### 1.1 Candidate Record (Core Fields)

| Feature | Tag | Phase |
|---------|-----|-------|
| Name, email, phone, LinkedIn URL | ✅ | 1 |
| Current title & company | ✅ | 1 |
| Category/role type (Sales Engineer, CMO, CRO, etc.) | ✅ | 1 |
| Location (city, state, country) | 🔴 | 1 |
| Desired salary / current compensation | 🔴 | 1 |
| Willingness to relocate (yes/no/flexible + preferred locations) | 🟡 | 3 |
| Years of experience | 🟡 | 3 |
| Skills / certifications (searchable tags) | 🟡 | 1 |
| Source (LinkedIn, referral, job board, etc.) | 🔴 | 1 |
| Status: Active, Passive, Do Not Contact, Placed | 🔴 | 1 |
| Date added / last contacted (auto-updated on note creation) | 🔴 | 1 |
| Documents (resumes, CVs, etc.) stored in separate `candidate_documents` table | ✅ | 5 |
| Linked Client Contact ID (for dual-role people) | ✅ | 2 |

### 1.2 Candidate Notes (Highest Priority Feature)

| Feature | Tag | Phase |
|---------|-----|-------|
| Add timestamped notes to any candidate | ✅ | 1 |
| Full-text search across ALL notes (PostgreSQL tsvector) | ✅ | 1 |
| Note type tag (Phone Call, Email, Interview Feedback, General) | 🔴 | 1 |
| Link a note to a specific job opening (optional) | 🟡 | 3 |
| Search results show: who the note is about, when, and text snippet | 🔴 | 4 |
| `created_by` field (which user wrote it) | ✅ | 1 |
| `private` toggle (visible only to creator + admin, defaults to public) | ✅ | 1 |

### 1.3 Candidate Documents (Separate Table)

Instead of a single resume field, candidates have a dedicated `candidate_documents` table supporting multiple files, versioning, and different document types.

| Feature | Tag | Phase |
|---------|-----|-------|
| Upload documents (PDF/DOCX) via drag-and-drop | ✅ | 5 |
| Separate `candidate_documents` table (not a single column on candidate) | ✅ | 5 |
| Document types: Resume, CV, Cover Letter, Portfolio, Other | ✅ | 5 |
| Multiple documents per candidate (resume v1, v2, CV, etc.) | ✅ | 5 |
| `is_primary` flag (which document shows by default on candidate detail) | ✅ | 5 |
| Document notes field ("Updated version with Nozomi experience added") | ✅ | 5 |
| `uploaded_by` tracking (which user uploaded it) | ✅ | 5 |
| Parse resume into candidate fields via OpenClaw/LLM | ✅ | 5 |
| Bulk import from OpenClaw JSON output (initial 2,000 load) | ✅ | 5 |
| View/download stored documents from within app | 🔴 | 5 |

---

## MODULE 2: COMPANIES & CONTACTS

Companies exist as Prospects (pursuing) or Clients (fee agreement signed).

### 2.1 Company Record

| Feature | Tag | Phase |
|---------|-----|-------|
| Company name, industry, HQ location | ✅ | 2 |
| Web domain as unique identifier (e.g., `dragos.com`) — unique constraint, auto-stripped from full URLs, optional for companies without websites | ✅ | 2 |
| Status: Prospect or Client | ✅ | 2 |
| Fee agreement percentage (e.g., 25% of base salary) | 🔴 | 2 |
| Fee agreement document (PDF upload) | 🟡 | 5 |
| Prospect pipeline stage: Targeted → Contacted → Negotiating Fee → Closed | ✅ | 2 |
| Company notes (full-text searchable, same system as candidate notes) | 🔴 | 2 |
| Company insights/intelligence section (tagged note type for competitive intel, org observations, market research) | ✅ | 2 |
| Date of last contact (auto-updated on note creation) | ✅ | 2 |
| Date became client | 🟡 | 2 |
| Industry vertical / tags | 🟡 | 3 |

### 2.2 Company Contacts (Decision Makers)

| Feature | Tag | Phase |
|---------|-----|-------|
| Name, title, email, phone, LinkedIn | ✅ | 2 |
| Contact type: Decision Maker, HR, Hiring Manager, Champion, Gatekeeper | ✅ | 2 |
| "Reports To" dropdown (links to another contact at same company) | ✅ | 2 |
| Contact notes (full-text searchable) | 🔴 | 2 |
| Primary contact flag | 🟡 | 2 |
| Linked Candidate ID (for dual-role people) | ✅ | 2 |

### 2.3 Contact Type Separation

| Feature | Tag | Phase |
|---------|-----|-------|
| Candidates and Client Contacts are separate tables in the database | ✅ | 1-2 |
| "Also create as Candidate" button on client contacts | ✅ | 2 |
| "Also create as Client Contact" button on candidates | ✅ | 2 |
| Visual indicator on both records showing the link exists | ✅ | 2 |

---

## MODULE 3: JOB OPENINGS

A job opening belongs to a Client and has its own interview pipeline.

### 3.1 Job Opening Record

| Feature | Tag | Phase |
|---------|-----|-------|
| Job title, description, requirements | ✅ | 3 |
| Linked to a Company (must be "Client" status) | ✅ | 3 |
| Linked to a Hiring Manager (from company contacts) | 🔴 | 3 |
| Status: Open, On Hold, Filled, Cancelled | 🔴 | 3 |
| Target compensation range | 🔴 | 3 |
| Location / remote / hybrid | 🔴 | 3 |
| Date opened / date filled | 🔴 | 3 |
| Number of candidates submitted (auto-calculated) | 🟡 | 3 |
| Fee estimate (auto-calculated: target comp midpoint × client fee %) | 🟡 | 3 |
| Job opening notes (full-text searchable) | 🔴 | 3 |

### 3.2 Dynamic Interview Pipeline (Per Job Opening)

| Feature | Tag | Phase |
|---------|-----|-------|
| Add/remove/rename/reorder stages per job opening | ✅ | 3 |
| Move candidates between stages (drag-and-drop Kanban view) | ✅ | 3 |
| Stage history with timestamps | 🔴 | 3 |
| Rejection at any stage with reason (full-text searchable) | 🔴 | 3 |
| A single candidate can be in multiple job pipelines simultaneously | ✅ | 3 |
| "Save pipeline as Template" for reuse | ⚪ | 6+ |

---

## MODULE 4: CLIENT ACQUISITION PIPELINE

Fixed 4-stage pipeline for winning new business.

### 4.1 Prospect Pipeline

| Feature | Tag | Phase |
|---------|-----|-------|
| Fixed stages: Targeted → Contacted → Negotiating Fee → Closed | ✅ | 2 |
| On "Closed": company status converts from Prospect to Client | ✅ | 2 |
| Pipeline Kanban view (visual board of prospects) | 🟡 | 4 |
| Date entered each stage (auto-tracked) | 🔴 | 2 |
| Loss reason if prospect doesn't close | 🟡 | 6+ |

---

## MODULE 5: SEARCH

### 5.1 Global Search (Level 1 — Smart Defaults)

| Feature | Tag | Phase |
|---------|-----|-------|
| Single search bar searches EVERYTHING | ✅ | 4 |
| Full-text search across: candidate notes, company notes, contact notes, job notes, rejection reasons | ✅ | 4 |
| Also searches: candidate names/titles/skills, company names, job titles/descriptions | ✅ | 4 |
| Automatic AND behavior (all terms must match) | ✅ | 4 |
| Stemming (searching "managing" also finds "management") | ✅ | 4 |
| Results grouped by type (Candidate Note, Company Note, etc.) | 🔴 | 4 |
| Result snippets with highlighted matching text | 🔴 | 4 |
| Upgradeable to Level 2 boolean (AND/OR/NOT/quotes) with zero DB changes | ✅ | 6+ |

### 5.2 Candidate Filtering (Structured Search)

| Feature | Tag | Phase |
|---------|-----|-------|
| Filter by: location, role type, salary range, status, skills | 🔴 | 4 |
| Sort by: date added, last contacted, name | 🔴 | 4 |
| Saved filters / views | ⚪ | 6+ |

### 5.3 ⚠️ SEARCH SAFETY RULES (Do Not Break These)

Search is the #1 feature. These rules must be followed during ALL development:

1. **Adding new text fields to any table?** Ask: "Should this be searchable?" If yes, update that table's `search_vector` trigger function AND add a `UNION ALL` block to the `global_search()` function. If you forget, the field exists but is invisible to search.
2. **Never change notes to rich text, HTML, or JSON storage.** The search trigger indexes plain text in the `content` column. Changing the format breaks search silently — no error, just empty results.
3. **Never rename the `content` column on the notes table** without updating the search trigger.
4. **Adding a new table with searchable text?** It won't appear in search results until you add it to the `global_search()` function. The function does not auto-discover new tables.
5. **The `rejection_reason` field on `candidate_applications`** does not use a stored search_vector — it computes on the fly. If search slows down, this is the first place to optimize by adding a stored vector + trigger.
6. **Test search after every schema change.** Add a record, search for it, confirm it appears. Takes 30 seconds. Do it every time.

---

## MODULE 6: ACTIVITY & HISTORY

### 6.1 Activity Log

| Feature | Tag | Phase |
|---------|-----|-------|
| Auto-log every: status change, stage move, note added, record created | 🔴 | 6 |
| Activity timeline per candidate | 🔴 | 6 |
| Activity timeline per job opening | 🔴 | 6 |
| Daily/weekly activity summary on dashboard | 🟡 | 6 |

### 6.2 Reminders & Follow-ups

| Feature | Tag | Phase |
|---------|-----|-------|
| Set a follow-up date on any candidate or contact | 🔴 | 6 |
| Today's follow-up list (dashboard widget) | 🔴 | 6 |
| Overdue follow-ups highlighted | 🟡 | 6 |

---

## MODULE 7: DASHBOARD & REPORTING

### 7.1 Dashboard (Home Screen)

| Feature | Tag | Phase |
|---------|-----|-------|
| Today's follow-ups / tasks | 🔴 | 6 |
| Active job openings count + list | 🔴 | 4 |
| Pipeline snapshot (candidates per stage across all jobs) | 🟡 | 4 |
| Recent activity feed | 🟡 | 6 |
| Prospect pipeline summary | 🟡 | 4 |

### 7.2 Revenue Tracking (Simple)

| Feature | Tag | Phase |
|---------|-----|-------|
| Mark job as "Filled" → enter candidate's base salary | ✅ | 6 |
| System auto-calculates fee: base salary × client fee agreement % | ✅ | 6 |
| Placement record created (job, candidate, salary, fee %, fee amount, date) | ✅ | 6 |
| Revenue dashboard: total fees by date range, by client | ✅ | 6 |
| Visible to admin only | ✅ | 6 |

### 7.3 Reporting

| Feature | Tag | Phase |
|---------|-----|-------|
| Placements made (by date range, by client) | 🟡 | 6 |
| Time-to-fill per job opening | ⚪ | 6+ |
| Source effectiveness | ⚪ | 6+ |

---

## MODULE 8: USER MANAGEMENT

### 8.1 Multi-User Support

| Feature | Tag | Phase |
|---------|-----|-------|
| Email/password authentication (Supabase Auth) | ✅ | 1 |
| Roles: Admin (Mark) and Recruiter | 🟡 | 6 |
| All records visible to all users (no data siloing) | ✅ | 1 |
| Note privacy toggle (optional, defaults to public) | ✅ | 1 |
| Admin can see revenue dashboard | ✅ | 6 |

---

## MODULE 9: DATA INTEGRITY & OPERATIONS

### 9.1 Duplicate Detection

| Feature | Tag | Phase |
|---------|-----|-------|
| Company dedup by web domain (unique constraint on `domain` field, auto-stripped from URLs) | ✅ | 2 |
| Warn on duplicate candidate (matching email or phone) during creation/import | 🔴 | 5 |
| Merge duplicate records | 🟡 | 6+ |

### 9.2 Data Export & Backup

| Feature | Tag | Phase |
|---------|-----|-------|
| Export candidates to CSV | 🔴 | 6 |
| Export notes to CSV | 🟡 | 6 |
| Automated daily database backup (included in Supabase Pro — available after Phase 5 upgrade) | 🔴 | 5 |

---

## EXPLICITLY EXCLUDED FEATURES

| Feature | Why Excluded |
|---------|-------------|
| Timesheets / hourly tracking | Direct-hire only, no temp/contract |
| Payroll / invoicing / payment processing | Not needed |
| Job board posting / career page | Not needed for agency model |
| Candidate self-service portal | Not needed |
| Email integration (send/receive from app) | Massive complexity, manual note logging instead |
| Calendar integration | Limited ROI, adds complexity |
| Automated email sequences / drip campaigns | Overkill for this use case |
| AI-powered candidate matching | Premature — get data in first, layer AI later |
| Native mobile app | Web-first, responsive design for phone browsers |
| Visual org chart for decision makers | Deferred — using simple "Reports To" for now |

---

## PHASE PLAN (Estimated Timeline)

### PHASE 1 — Foundation (Weeks 1-3)
**Goal: Candidate database with notes and search working**
- Database schema design and Supabase project setup
- Authentication (email/password)
- Row-level security policies
- Candidate CRUD (create, read, update, delete)
- Candidate list view with basic filtering (status, role type)
- Candidate detail page with all core fields
- Notes system with full-text search (candidate notes)
- Basic UI layout, navigation, and responsive design

### PHASE 2 — Companies & Contacts (Weeks 4-5)
**Goal: Company tracking with prospect pipeline and contact management**
- Company records (Prospect/Client status, fee agreement %)
- Prospect pipeline: Targeted → Contacted → Negotiating → Closed
- Prospect-to-Client conversion on "Closed"
- Company contacts with type tags and "Reports To"
- Company notes and insights (full-text searchable)
- Last contact date (auto-updated)
- Candidate ↔ Client Contact linking ("Also create as..." buttons)

### PHASE 3 — Job Openings & Pipelines (Weeks 6-8)
**Goal: Full job lifecycle with dynamic interview stages**
- Job opening records linked to clients and hiring managers
- Job status management (Open, On Hold, Filled, Cancelled)
- Dynamic interview stage builder (add/remove/rename/reorder)
- Kanban view for moving candidates through pipeline stages
- Stage history with timestamps
- Rejection tracking with searchable reasons
- Candidates in multiple pipelines simultaneously
- Job opening notes (searchable)

### PHASE 4 — Global Search & Dashboard (Weeks 8-9)
**Goal: Search everything, see everything at a glance**
- Global search bar across all notes, names, titles, skills, descriptions
- Search results grouped by type with snippets and highlighting
- Candidate structured filtering (location, role, salary, status, skills)
- Dashboard: active jobs, pipeline snapshot, prospect pipeline summary

### PHASE 5 — Resume & Import (Weeks 10-11)
**Goal: Get all your existing data into the system**
- ⚠️ **Upgrade Supabase to Pro plan ($25/month) before importing real data** — enables daily backups
- Resume/document upload (drag-and-drop) with Supabase Storage
- `candidate_documents` table: multiple files per candidate, types, `is_primary` flag
- Document viewing/downloading from within the app
- OpenClaw integration for parsing individual uploads (~5/day)
- Bulk import script for initial 2,000 resume load via OpenClaw JSON
- Duplicate detection on import (email/phone for candidates, domain for companies)

### PHASE 6 — Polish & Enhancement (Weeks 12+)
**Goal: Make it a real CRM, not just a database**
- Follow-up reminders and today's task list
- Activity logging and timeline views (per candidate, per job)
- Revenue tracking (placement records, auto-calculated fees, admin dashboard)
- Basic reporting (placements by date/client)
- Multi-user role management (Admin vs. Recruiter)
- Data export (CSV)
- "Save pipeline as Template" for interview stages
- Upgrade search to Level 2 boolean (if needed)

---

## CRITICAL DECISIONS — ALL RESOLVED

| Question | Resolution |
|----------|-----------|
| UI Framework | shadcn/ui + Tailwind CSS + dnd-kit (Kanban only). No other UI libraries. |
| Candidate + Client Contact overlap | Linked records with "Also create as..." buttons. Both records persist with full history. |
| Note ownership in multi-user | All visible by default, optional private toggle (creator + admin only). |
| Fee tracking scope | Simple auto-calculation on placement. Phase 6. |
| Search scope | Everything — all notes, names, titles, skills, descriptions, rejection reasons. |
| Search level | Level 1 (smart defaults). Upgradeable to Level 2 with zero DB changes. |
| Company deduplication | Web domain as unique identifier (optional for companies without websites). |
| Candidate documents | Separate table, multiple files per candidate, typed, versioned, `is_primary` flag. |
| Supabase plan | Free tier during development (Phases 1-4), Pro before real data import (Phase 5). |

---

## NEXT STEP

Database schema design is COMPLETE (see `crm-database-schema.md`).

Next: Set up the project repository, create the `CLAUDE.md` / `RULES.md` for AI coding assistants, and begin Phase 1 implementation.

---

*Document finalized March 19, 2026. All major architectural and feature decisions locked.*
