--=============================================================================
-- VMG CRM — Initial Schema Migration
-- File: migration_001_initial_schema.sql
-- Run this once in the Supabase SQL Editor to set up the entire database.
-- =============================================================================


-- =============================================================================
-- TABLE 1: profiles
-- Extends Supabase Auth users with app-specific info (role, name).
-- =============================================================================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'recruiter'
              CHECK (role IN ('admin', 'recruiter')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =============================================================================
-- TABLE 2: candidates
-- Your talent database — people you are recruiting.
-- =============================================================================

CREATE TABLE candidates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core contact info
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  email                TEXT,
  phone                TEXT,
  linkedin_url         TEXT,
  location_city        TEXT,
  location_state       TEXT,
  location_country     TEXT DEFAULT 'US',

  -- Professional info
  current_title        TEXT,
  current_company      TEXT,
  category             TEXT
                       CHECK (category IN (
                         'Regional Sales Director', 'Account Executive',
                         'Solutions Engineer', 'Sales Engineer', 'SE Manager',
                         'VP of Sales', 'VP Engineering', 'VP of Sales Engineering',
                         'CMO', 'CPO',
                         'Head of Product Marketing', 'Head of Marketing',
                         'Product Marketing Manager', 'Product Manager',
                         'Backend Engineer',
                         'OT Security Engineer', 'OT Security Engineering Manager',
                         'Other'
                       )),
  years_experience     INTEGER,
  skills               TEXT,
  current_compensation NUMERIC(12,2),
  desired_compensation NUMERIC(12,2),
  willing_to_relocate  TEXT DEFAULT 'unknown'
                       CHECK (willing_to_relocate IN ('yes', 'no', 'flexible', 'unknown')),
  relocation_preferences TEXT,

  -- Recruiting info
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'passive', 'placed', 'do_not_contact')),
  source               TEXT
                       CHECK (source IN (
                         'LinkedIn', 'Referral', 'Job Board', 'Conference',
                         'Cold Outreach', 'Inbound', 'Other'
                       )),

  -- Link to company_contacts (for dual-role people) — FK added after that table is created
  linked_contact_id    UUID,

  -- Timestamps
  last_contacted_at    TIMESTAMP WITH TIME ZONE,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by           UUID REFERENCES profiles(id),

  -- Full-text search vector (auto-populated by trigger below)
  search_vector        tsvector
);

-- Indexes for candidates
CREATE INDEX idx_candidates_search   ON candidates USING GIN (search_vector);
CREATE INDEX idx_candidates_status   ON candidates (status);
CREATE INDEX idx_candidates_category ON candidates (category);
CREATE INDEX idx_candidates_location ON candidates (location_state);

CREATE UNIQUE INDEX idx_candidates_email_unique
  ON candidates (LOWER(email))
  WHERE email IS NOT NULL;

-- Trigger: auto-update search_vector whenever a candidate is inserted or updated
CREATE OR REPLACE FUNCTION candidates_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.first_name, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.last_name, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.current_title, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.current_company, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.category, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.skills, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.location_city, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.location_state, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_search_trigger
  BEFORE INSERT OR UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION candidates_search_update();


-- =============================================================================
-- TABLE 3: companies
-- Prospect and client companies.
-- =============================================================================

CREATE TABLE companies (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  domain                    TEXT,
  industry                  TEXT,
  hq_city                   TEXT,
  hq_state                  TEXT,
  hq_country                TEXT DEFAULT 'US',
  website_url               TEXT,
  status                    TEXT NOT NULL DEFAULT 'prospect'
                            CHECK (status IN ('prospect', 'client', 'former_client', 'inactive')),
  prospect_stage            TEXT DEFAULT 'targeted'
                            CHECK (prospect_stage IN (
                              'targeted', 'contacted', 'negotiating_fee', 'closed'
                            )),
  prospect_stage_entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fee_agreement_pct         NUMERIC(5,2),
  became_client_at          TIMESTAMP WITH TIME ZONE,
  last_contacted_at         TIMESTAMP WITH TIME ZONE,
  created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by                UUID REFERENCES profiles(id),
  search_vector             tsvector
);

-- Indexes for companies
CREATE UNIQUE INDEX idx_companies_domain_unique
  ON companies (LOWER(domain))
  WHERE domain IS NOT NULL;

CREATE INDEX idx_companies_search         ON companies USING GIN (search_vector);
CREATE INDEX idx_companies_status         ON companies (status);
CREATE INDEX idx_companies_prospect_stage ON companies (prospect_stage)
  WHERE status = 'prospect';

-- Trigger: auto-update search_vector for companies
CREATE OR REPLACE FUNCTION companies_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.name, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.domain, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.industry, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.hq_city, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.hq_state, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_search_trigger
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION companies_search_update();


-- =============================================================================
-- TABLE 4: company_contacts
-- People at companies — hiring managers, decision makers, HR, etc.
-- =============================================================================

CREATE TABLE company_contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  title               TEXT,
  email               TEXT,
  phone               TEXT,
  linkedin_url        TEXT,
  contact_type        TEXT NOT NULL DEFAULT 'other'
                      CHECK (contact_type IN (
                        'decision_maker', 'hiring_manager', 'hr',
                        'champion', 'gatekeeper', 'other'
                      )),
  is_primary          BOOLEAN DEFAULT FALSE,
  reports_to_id       UUID REFERENCES company_contacts(id) ON DELETE SET NULL,
  linked_candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  last_contacted_at   TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by          UUID REFERENCES profiles(id),
  search_vector       tsvector
);

-- Now add the reverse FK from candidates → company_contacts
-- (Had to wait until company_contacts was created)
ALTER TABLE candidates
  ADD CONSTRAINT fk_candidates_linked_contact
  FOREIGN KEY (linked_contact_id) REFERENCES company_contacts(id) ON DELETE SET NULL;

-- Indexes for company_contacts
CREATE INDEX idx_contacts_company ON company_contacts (company_id);
CREATE INDEX idx_contacts_type    ON company_contacts (contact_type);
CREATE INDEX idx_contacts_search  ON company_contacts USING GIN (search_vector);

-- Trigger: auto-update search_vector for contacts
CREATE OR REPLACE FUNCTION contacts_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.first_name, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.last_name, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.title, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_search_trigger
  BEFORE INSERT OR UPDATE ON company_contacts
  FOR EACH ROW EXECUTE FUNCTION contacts_search_update();


-- =============================================================================
-- TABLE 5: job_openings
-- Open roles at client companies.
-- =============================================================================

CREATE TABLE job_openings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  hiring_manager_id UUID REFERENCES company_contacts(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  requirements      TEXT,
  location_city     TEXT,
  location_state    TEXT,
  location_type     TEXT DEFAULT 'onsite'
                    CHECK (location_type IN ('onsite', 'remote', 'hybrid')),
  comp_range_low    NUMERIC(12,2),
  comp_range_high   NUMERIC(12,2),
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'on_hold', 'filled', 'cancelled')),
  opened_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  filled_at         TIMESTAMP WITH TIME ZONE,
  closed_at         TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by        UUID REFERENCES profiles(id),
  search_vector     tsvector
);

-- Indexes for job_openings
CREATE INDEX idx_jobs_company ON job_openings (company_id);
CREATE INDEX idx_jobs_status  ON job_openings (status);
CREATE INDEX idx_jobs_search  ON job_openings USING GIN (search_vector);

-- Trigger: auto-update search_vector for job openings
CREATE OR REPLACE FUNCTION jobs_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.title, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.description, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.requirements, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_search_trigger
  BEFORE INSERT OR UPDATE ON job_openings
  FOR EACH ROW EXECUTE FUNCTION jobs_search_update();


-- =============================================================================
-- TABLE 6: pipeline_stages
-- Custom interview stages per job opening (used for Kanban board).
-- =============================================================================

CREATE TABLE pipeline_stages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_opening_id UUID NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  sort_order     INTEGER NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stages_job ON pipeline_stages (job_opening_id, sort_order);


-- =============================================================================
-- TABLE 7: candidate_applications
-- Links a candidate to a job opening; tracks their pipeline stage.
-- =============================================================================

CREATE TABLE candidate_applications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id       UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_opening_id     UUID NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
  current_stage_id   UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'rejected', 'withdrawn', 'placed')),
  rejection_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  rejection_reason   TEXT,
  applied_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rejected_at        TIMESTAMP WITH TIME ZONE,
  placed_at          TIMESTAMP WITH TIME ZONE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by         UUID REFERENCES profiles(id),
  UNIQUE (candidate_id, job_opening_id)
);

-- Indexes for candidate_applications
CREATE INDEX idx_applications_candidate ON candidate_applications (candidate_id);
CREATE INDEX idx_applications_job       ON candidate_applications (job_opening_id);
CREATE INDEX idx_applications_status    ON candidate_applications (status);

-- Full-text index on rejection_reason (computed on the fly, no stored vector)
CREATE INDEX idx_applications_rejection_search
  ON candidate_applications USING GIN (TO_TSVECTOR('english', COALESCE(rejection_reason, '')));


-- =============================================================================
-- TABLE 8: application_stage_history
-- Audit trail of every stage move on the Kanban board.
-- =============================================================================

CREATE TABLE application_stage_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES candidate_applications(id) ON DELETE CASCADE,
  from_stage_id  UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id    UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  moved_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  moved_by       UUID REFERENCES profiles(id),
  notes          TEXT
);

CREATE INDEX idx_stage_history_application ON application_stage_history (application_id, moved_at);


-- =============================================================================
-- TABLE 9: notes (Unified Notes Table)
-- ALL notes in one table — candidate, company, contact, and job notes.
-- This is the heart of the search feature.
-- =============================================================================

CREATE TABLE notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL
                CHECK (entity_type IN ('candidate', 'company', 'contact', 'job_opening')),
  entity_id     UUID NOT NULL,
  content       TEXT NOT NULL,
  note_type     TEXT NOT NULL DEFAULT 'general'
                CHECK (note_type IN (
                  'phone_call', 'email', 'interview_feedback', 'insight', 'general'
                )),
  linked_job_id UUID REFERENCES job_openings(id) ON DELETE SET NULL,
  is_private    BOOLEAN DEFAULT FALSE,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  search_vector tsvector
);

-- Indexes for notes
CREATE INDEX idx_notes_search  ON notes USING GIN (search_vector);
CREATE INDEX idx_notes_entity  ON notes (entity_type, entity_id);
CREATE INDEX idx_notes_type    ON notes (note_type);
CREATE INDEX idx_notes_created ON notes (created_at DESC);

-- Trigger: auto-update search_vector when note content changes
CREATE OR REPLACE FUNCTION notes_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := TO_TSVECTOR('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_search_trigger
  BEFORE INSERT OR UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION notes_search_update();

-- Trigger: auto-update last_contacted_at on the parent entity when a note is added
CREATE OR REPLACE FUNCTION update_last_contacted() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity_type = 'candidate' THEN
    UPDATE candidates SET last_contacted_at = NOW(), updated_at = NOW()
    WHERE id = NEW.entity_id;
  ELSIF NEW.entity_type = 'company' THEN
    UPDATE companies SET last_contacted_at = NOW(), updated_at = NOW()
    WHERE id = NEW.entity_id;
  ELSIF NEW.entity_type = 'contact' THEN
    UPDATE company_contacts SET last_contacted_at = NOW(), updated_at = NOW()
    WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_update_last_contacted
  AFTER INSERT ON notes
  FOR EACH ROW EXECUTE FUNCTION update_last_contacted();


-- =============================================================================
-- TABLE 10: candidate_documents
-- Resumes, CVs, and other files (stored in Supabase Storage; metadata here).
-- =============================================================================

CREATE TABLE candidate_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_type       TEXT NOT NULL DEFAULT 'resume'
                  CHECK (file_type IN ('resume', 'cv', 'cover_letter', 'portfolio', 'other')),
  storage_path    TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type       TEXT,
  is_primary      BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  uploaded_by     UUID REFERENCES profiles(id),
  uploaded_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for candidate_documents
CREATE INDEX idx_documents_candidate ON candidate_documents (candidate_id);
CREATE INDEX idx_documents_primary   ON candidate_documents (candidate_id)
  WHERE is_primary = TRUE;

-- Trigger: when marking a document as primary, unset the old primary
CREATE OR REPLACE FUNCTION ensure_single_primary_document() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    UPDATE candidate_documents
    SET is_primary = FALSE
    WHERE candidate_id = NEW.candidate_id
      AND id != NEW.id
      AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_primary
  AFTER INSERT OR UPDATE OF is_primary ON candidate_documents
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION ensure_single_primary_document();


-- =============================================================================
-- TABLE 11: prospect_pipeline_history
-- Tracks when a prospect company moves between pipeline stages.
-- =============================================================================

CREATE TABLE prospect_pipeline_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage   TEXT NOT NULL,
  moved_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  moved_by   UUID REFERENCES profiles(id)
);

CREATE INDEX idx_prospect_history_company ON prospect_pipeline_history (company_id, moved_at);


-- =============================================================================
-- TABLE 12: placements
-- Revenue tracking — records each successful hire.
-- fee_percentage is COPIED from the company at placement time (not looked up).
-- =============================================================================

CREATE TABLE placements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id),
  job_opening_id  UUID NOT NULL REFERENCES job_openings(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  application_id  UUID REFERENCES candidate_applications(id),
  base_salary     NUMERIC(12,2) NOT NULL,
  fee_percentage  NUMERIC(5,2) NOT NULL,
  fee_amount      NUMERIC(12,2) NOT NULL,
  placement_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  start_date      DATE,
  guarantee_expires DATE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by      UUID REFERENCES profiles(id)
);

CREATE INDEX idx_placements_date    ON placements (placement_date);
CREATE INDEX idx_placements_company ON placements (company_id);


-- =============================================================================
-- TABLE 13: follow_ups
-- Reminders and to-do tasks for candidates, companies, contacts, and jobs.
-- =============================================================================

CREATE TABLE follow_ups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL
               CHECK (entity_type IN ('candidate', 'company', 'contact', 'job_opening')),
  entity_id    UUID NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  assigned_to  UUID REFERENCES profiles(id),
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_followups_due      ON follow_ups (due_date, is_completed) WHERE is_completed = FALSE;
CREATE INDEX idx_followups_entity   ON follow_ups (entity_type, entity_id);
CREATE INDEX idx_followups_assigned ON follow_ups (assigned_to, due_date) WHERE is_completed = FALSE;


-- =============================================================================
-- TABLE 14: activity_log
-- Automatic audit trail of everything that happens in the CRM.
-- =============================================================================

CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL
              CHECK (entity_type IN (
                'candidate', 'company', 'contact', 'job_opening',
                'application', 'placement'
              )),
  entity_id   UUID NOT NULL,
  action      TEXT NOT NULL,
  description TEXT,
  metadata    JSONB,
  user_id     UUID REFERENCES profiles(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_entity ON activity_log (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_activity_date   ON activity_log (created_at DESC);
CREATE INDEX idx_activity_user   ON activity_log (user_id, created_at DESC);


-- =============================================================================
-- AUTO-UPDATE TIMESTAMPS
-- Automatically sets updated_at = NOW() whenever a row is changed.
-- =============================================================================

CREATE OR REPLACE FUNCTION update_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON company_contacts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_openings
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON candidate_applications
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();


-- =============================================================================
-- GLOBAL SEARCH FUNCTION
-- Powers the "search everything" feature across candidates, companies,
-- notes, job openings, and rejection reasons — all in one query.
-- =============================================================================

CREATE OR REPLACE FUNCTION global_search(search_query TEXT)
RETURNS TABLE (
  entity_type   TEXT,
  entity_id     UUID,
  entity_name   TEXT,
  match_source  TEXT,
  snippet       TEXT,
  rank          REAL,
  created_at    TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  tsquery_val TSQUERY;
BEGIN
  tsquery_val := PLAINTO_TSQUERY('english', search_query);

  RETURN QUERY

  -- Search candidate records
  SELECT
    'candidate'::TEXT,
    c.id,
    (c.first_name || ' ' || c.last_name)::TEXT,
    'candidate_record'::TEXT,
    TS_HEADLINE('english',
      COALESCE(c.current_title, '') || ' at ' || COALESCE(c.current_company, ''),
      tsquery_val, 'MaxWords=30, MinWords=15')::TEXT,
    TS_RANK(c.search_vector, tsquery_val),
    c.created_at
  FROM candidates c
  WHERE c.search_vector @@ tsquery_val

  UNION ALL

  -- Search company records
  SELECT
    'company'::TEXT,
    co.id,
    co.name::TEXT,
    'company_record'::TEXT,
    TS_HEADLINE('english',
      co.name || ' ' || COALESCE(co.industry, ''),
      tsquery_val, 'MaxWords=30, MinWords=15')::TEXT,
    TS_RANK(co.search_vector, tsquery_val),
    co.created_at
  FROM companies co
  WHERE co.search_vector @@ tsquery_val

  UNION ALL

  -- Search notes (the big one — candidate, company, contact, and job notes)
  SELECT
    n.entity_type::TEXT,
    n.entity_id,
    CASE
      WHEN n.entity_type = 'candidate'    THEN (SELECT first_name || ' ' || last_name FROM candidates      WHERE id = n.entity_id)
      WHEN n.entity_type = 'company'      THEN (SELECT name                            FROM companies       WHERE id = n.entity_id)
      WHEN n.entity_type = 'contact'      THEN (SELECT first_name || ' ' || last_name FROM company_contacts WHERE id = n.entity_id)
      WHEN n.entity_type = 'job_opening'  THEN (SELECT title                           FROM job_openings    WHERE id = n.entity_id)
    END::TEXT,
    ('note_' || n.note_type)::TEXT,
    TS_HEADLINE('english', n.content, tsquery_val,
      'MaxWords=35, MinWords=15, StartSel=**, StopSel=**')::TEXT,
    TS_RANK(n.search_vector, tsquery_val),
    n.created_at
  FROM notes n
  WHERE n.search_vector @@ tsquery_val
    AND (n.is_private = FALSE OR n.created_by = auth.uid())

  UNION ALL

  -- Search job openings
  SELECT
    'job_opening'::TEXT,
    j.id,
    j.title::TEXT,
    'job_record'::TEXT,
    TS_HEADLINE('english',
      COALESCE(j.description, '') || ' ' || COALESCE(j.requirements, ''),
      tsquery_val, 'MaxWords=30, MinWords=15')::TEXT,
    TS_RANK(j.search_vector, tsquery_val),
    j.created_at
  FROM job_openings j
  WHERE j.search_vector @@ tsquery_val

  UNION ALL

  -- Search rejection reasons
  SELECT
    'candidate'::TEXT,
    ca.candidate_id,
    (SELECT first_name || ' ' || last_name FROM candidates WHERE id = ca.candidate_id)::TEXT,
    'rejection_reason'::TEXT,
    TS_HEADLINE('english', ca.rejection_reason, tsquery_val,
      'MaxWords=35, MinWords=15')::TEXT,
    TS_RANK(TO_TSVECTOR('english', ca.rejection_reason), tsquery_val),
    ca.created_at
  FROM candidate_applications ca
  WHERE ca.rejection_reason IS NOT NULL
    AND TO_TSVECTOR('english', ca.rejection_reason) @@ tsquery_val

  ORDER BY rank DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Controls who can see and edit which rows.
-- Every table must have RLS enabled and at least one policy.
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates                ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_openings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_pipeline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE placements                ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups                ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log              ENABLE ROW LEVEL SECURITY;

-- ----- profiles -----
-- Users can read their own profile; admins can read all profiles
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ----- Standard tables: authenticated users can read and modify everything -----
-- (candidates, companies, company_contacts, job_openings, pipeline_stages,
--  candidate_applications, application_stage_history, candidate_documents,
--  prospect_pipeline_history, placements, follow_ups, activity_log)

CREATE POLICY "Authenticated users can read candidates"
  ON candidates FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify candidates"
  ON candidates FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read companies"
  ON companies FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify companies"
  ON companies FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read contacts"
  ON company_contacts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify contacts"
  ON company_contacts FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read jobs"
  ON job_openings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify jobs"
  ON job_openings FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read stages"
  ON pipeline_stages FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify stages"
  ON pipeline_stages FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read applications"
  ON candidate_applications FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify applications"
  ON candidate_applications FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read stage history"
  ON application_stage_history FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify stage history"
  ON application_stage_history FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read documents"
  ON candidate_documents FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify documents"
  ON candidate_documents FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read prospect history"
  ON prospect_pipeline_history FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify prospect history"
  ON prospect_pipeline_history FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read placements"
  ON placements FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify placements"
  ON placements FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read follow_ups"
  ON follow_ups FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify follow_ups"
  ON follow_ups FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can read activity_log"
  ON activity_log FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can modify activity_log"
  ON activity_log FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ----- notes: special handling for private notes -----
-- SELECT: respects is_private flag (private notes only visible to creator + admins)
CREATE POLICY "Notes read with privacy check"
  ON notes FOR SELECT
  TO authenticated
  USING (
    is_private = FALSE
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- INSERT/UPDATE/DELETE: any authenticated user (no privacy restriction on writes)
CREATE POLICY "Authenticated users can insert notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can update notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can delete notes"
  ON notes FOR DELETE
  TO authenticated
  USING (TRUE);