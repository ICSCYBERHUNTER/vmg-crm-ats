# Direct-Hire Recruiting CRM — Database Schema Design

**Project:** Mark's Recruiting CRM
**Date:** March 19, 2026
**Status:** DRAFT — Review and approve before writing any application code.
**Depends on:** Feature Planning Document (FINAL)

\---

## Quick Glossary for Beginner Developers

Before we dive in, here's what the SQL terminology means:

|Term|What It Means|
|-|-|
|`TABLE`|A spreadsheet. Each table is like a separate sheet in Excel.|
|`COLUMN`|A field in that spreadsheet (like "Name" or "Email").|
|`ROW`|A single record (like one candidate).|
|`UUID`|A unique ID that looks like `a1b2c3d4-e5f6-...`. Supabase uses these instead of simple numbers (1, 2, 3) because they're globally unique and more secure.|
|`PRIMARY KEY`|The unique identifier for each row. No two rows can have the same one.|
|`FOREIGN KEY` / `REFERENCES`|A column that points to a row in another table. Like a hyperlink between spreadsheets.|
|`NOT NULL`|This field is required — you can't leave it blank.|
|`DEFAULT`|The value that gets filled in automatically if you don't specify one.|
|`TEXT`|A text field with no length limit.|
|`VARCHAR(n)`|A text field with a maximum length of n characters.|
|`INTEGER`|A whole number (1, 2, 3...).|
|`NUMERIC(p,s)`|A decimal number with p total digits and s decimal places. Used for money.|
|`BOOLEAN`|True or false.|
|`TIMESTAMP`|A date and time value.|
|`ENUM` / `CHECK`|Limits a field to specific allowed values (like a dropdown).|
|`INDEX`|Makes searching a specific column faster. Like a book's index.|
|`GIN INDEX`|A special index type optimized for full-text search. This is what makes your "search all notes" feature fast.|
|`tsvector`|PostgreSQL's full-text search data type. It stores a processed version of text optimized for searching.|
|`CASCADE`|When you delete a parent record, automatically delete its children. (e.g., delete a company → delete its contacts too)|
|`SET NULL`|When you delete a parent record, set the child's reference to blank instead of deleting the child.|
|`RLS`|Row Level Security — Supabase's way of controlling who can see which rows.|

\---

## Schema Overview (All Tables)

Here's what we're building and how everything connects:

```
profiles (Supabase Auth users)
  │
  ├── Referenced by: notes.created\_by, candidate\_documents.uploaded\_by,
  │                  activity\_log.user\_id, follow\_ups.assigned\_to
  │
candidates ◄──────────────────────────────► company\_contacts
  │  (linked via linked\_contact\_id)              │
  │                                              │
  ├── candidate\_documents                        │
  ├── notes (entity\_type = 'candidate')          ├── notes (entity\_type = 'contact')
  │                                              │
  │         ┌────────────────────────────────────┘
  │         │
  │     companies
  │         │
  │         ├── notes (entity\_type = 'company')
  │         │
  │         └── job\_openings
  │               │
  │               ├── notes (entity\_type = 'job\_opening')
  │               ├── pipeline\_stages (ordered, custom per job)
  │               │
  │               └── candidate\_applications
  │                     │
  │                     ├── application\_stage\_history
  │                     └── current\_stage → pipeline\_stages
  │
  ├── placements (Phase 6)
  ├── follow\_ups (Phase 6)
  └── activity\_log (Phase 6)
```

**Total tables: 14** (but only 7 are needed for Phase 1-2)

\---

## TABLE 1: profiles

**Purpose:** Extends Supabase Auth with app-specific user info.
**Phase:** 1
**Note:** Supabase automatically creates an `auth.users` table for login. This `profiles` table stores additional info about each user and lives in the `public` schema where our app can access it.

```sql
CREATE TABLE profiles (
  -- Primary key matches the Supabase Auth user ID exactly
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User info
  full\_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'recruiter'
              CHECK (role IN ('admin', 'recruiter')),

  -- Timestamps
  created\_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated\_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Explanation: When someone signs up via Supabase Auth, we also create a
-- row here with their name and role. Mark's row would have role = 'admin'.
-- New recruiters added later would have role = 'recruiter'.
```

\---

## TABLE 2: candidates

**Purpose:** Your talent database — people you are recruiting.
**Phase:** 1
**Maps to:** Feature Plan Module 1.1

```sql
CREATE TABLE candidates (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- Core contact info
  first\_name          TEXT NOT NULL,
  last\_name           TEXT NOT NULL,
  email               TEXT,              -- Not required (some candidates are LinkedIn-only)
  phone               TEXT,
  linkedin\_url        TEXT,
  location\_city       TEXT,
  location\_state      TEXT,
  location\_country    TEXT DEFAULT 'US',

  -- Professional info
  current\_title       TEXT,
  current\_company     TEXT,
  category            TEXT               -- 'Sales Engineer', 'CMO', 'CRO', etc.
              CHECK (category IN (
                'Regional Sales Director', 'Account Executive', 

&#x20;             'Solutions Engineer', 'Sales Engineer', 'SE Manager',

&#x20;             'VP of Sales', 'VP Engineering', 'VP of Sales Engineering',

&#x20;             'CMO', 'CPO',

&#x20;             'Head of Product Marketing', 'Head of Marketing',

&#x20;             'Product Marketing Manager', 'Product Manager',

&#x20;             'Backend Engineer',

&#x20;             'OT Security Engineer', 'OT Security Engineering Manager',

&#x20;             'Other'              )),
  years\_experience    INTEGER,
  skills              TEXT,              -- "OT,ICS,SCADA,NERC Sales, PreSales, Hunting, Channels, Partner, Leader, Startups, Marketing, Backend, Finance, 
  current\_compensation NUMERIC(12,2),    -- What they make now
  desired\_compensation NUMERIC(12,2),    -- What they want
  willing\_to\_relocate TEXT DEFAULT 'unknown'
              CHECK (willing\_to\_relocate IN ('yes', 'no', 'flexible', 'unknown')),
  relocation\_preferences TEXT,           -- Free text: "Open to TX, CA, remote"

  -- Recruiting info
  status              TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'passive', 'placed', 'do\_not\_contact')),
  source              TEXT               -- 'LinkedIn', 'Referral', 'Job Board', etc.
              CHECK (source IN (
                'LinkedIn', 'Referral', 'Job Board', 'Conference',
                'Cold Outreach', 'Inbound', 'Other'
              )),

  -- Link to company\_contacts (for dual-role people)
  linked\_contact\_id   UUID,              -- Set when "Also create as Client Contact" is used
  -- Foreign key added after company\_contacts table is created

  -- Timestamps
  last\_contacted\_at   TIMESTAMP WITH TIME ZONE,  -- Auto-updated when a note is added
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created\_by          UUID REFERENCES profiles(id),

  -- Full-text search vector (auto-populated by trigger)
  search\_vector       tsvector
);

-- INDEXES

-- Full-text search: search across name, title, company, skills, location
CREATE INDEX idx\_candidates\_search ON candidates USING GIN (search\_vector);

-- Common filters
CREATE INDEX idx\_candidates\_status ON candidates (status);
CREATE INDEX idx\_candidates\_category ON candidates (category);
CREATE INDEX idx\_candidates\_location ON candidates (location\_state);

-- Duplicate detection
CREATE UNIQUE INDEX idx\_candidates\_email\_unique
  ON candidates (LOWER(email))
  WHERE email IS NOT NULL;
  -- This means: no two candidates can have the same email (case-insensitive),
  -- but multiple candidates CAN have a blank email.

-- Auto-update search\_vector when candidate data changes
-- This trigger converts the text fields into a searchable format automatically.
CREATE OR REPLACE FUNCTION candidates\_search\_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search\_vector :=
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.first\_name, '')), 'A') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.last\_name, '')), 'A') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.current\_title, '')), 'B') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.current\_company, '')), 'B') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.category, '')), 'B') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.skills, '')), 'B') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.location\_city, '')), 'C') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.location\_state, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates\_search\_trigger
  BEFORE INSERT OR UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION candidates\_search\_update();

-- Explanation of weights:
-- 'A' = highest priority (names rank highest in search results)
-- 'B' = medium priority (title, company)
-- 'C' = lower priority (location)
-- This means searching "John" will rank the candidate named John higher
-- than a candidate who works at a company called "John's Welding"
```

**Design decisions explained:**

* **`email` is not required** because you said some candidates are LinkedIn-only. But when it IS present, it must be unique (for dedup).
* **`category` uses CHECK constraint** instead of a separate lookup table. This is simpler for a small, stable list. If you find yourself adding categories constantly, we can migrate to a lookup table later.
* **`search\_vector`** is automatically maintained by a trigger — you never have to update it manually. Every time a candidate record is created or edited, PostgreSQL rebuilds the search data automatically.
* **`linked\_contact\_id`** is how we connect a candidate to their company contact record (the dual-role feature). The actual foreign key gets added after we create the `company\_contacts` table.

\---

## TABLE 3: companies

**Purpose:** Tracks prospect and client companies.
**Phase:** 2
**Maps to:** Feature Plan Module 2.1

```sql
CREATE TABLE companies (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- Core info
  name                TEXT NOT NULL,
  domain              TEXT,              -- e.g., 'dragos.com' — primary dedup key
  industry            TEXT,
  hq\_city             TEXT,
  hq\_state            TEXT,
  hq\_country          TEXT DEFAULT 'US',
  website\_url         TEXT,              -- Full URL for display/linking

  -- CRM status
  status              TEXT NOT NULL DEFAULT 'prospect'
              CHECK (status IN ('prospect', 'client', 'former\_client', 'inactive')),

  -- Prospect pipeline (only relevant when status = 'prospect')
  prospect\_stage      TEXT DEFAULT 'targeted'
              CHECK (prospect\_stage IN (
                'targeted', 'contacted', 'negotiating\_fee', 'closed'
              )),
  prospect\_stage\_entered\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Client info (populated when status becomes 'client')
  fee\_agreement\_pct   NUMERIC(5,2),      -- e.g., 25.00 for 25%
  became\_client\_at    TIMESTAMP WITH TIME ZONE,

  -- Tracking
  last\_contacted\_at   TIMESTAMP WITH TIME ZONE,
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created\_by          UUID REFERENCES profiles(id),

  -- Full-text search
  search\_vector       tsvector
);

-- INDEXES

-- Domain uniqueness (the dedup key you suggested)
CREATE UNIQUE INDEX idx\_companies\_domain\_unique
  ON companies (LOWER(domain))
  WHERE domain IS NOT NULL;
  -- Same pattern as candidate email: unique when present, multiple NULLs allowed.

-- Full-text search
CREATE INDEX idx\_companies\_search ON companies USING GIN (search\_vector);

-- Common filters
CREATE INDEX idx\_companies\_status ON companies (status);
CREATE INDEX idx\_companies\_prospect\_stage ON companies (prospect\_stage)
  WHERE status = 'prospect';

-- Auto-update search vector
CREATE OR REPLACE FUNCTION companies\_search\_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search\_vector :=
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.name, '')), 'A') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.domain, '')), 'A') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.industry, '')), 'B') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.hq\_city, '')), 'C') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.hq\_state, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies\_search\_trigger
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION companies\_search\_update();
```

**Design decisions explained:**

* **`domain` is the dedup key** — your suggestion. The UNIQUE index on `LOWER(domain)` means `Dragos.com` and `dragos.com` are treated as the same.
* **`prospect\_stage` lives on the company record** instead of a separate table because the stages are fixed (never changes). The dynamic interview pipeline (which DOES change per job) uses a separate table.
* **`fee\_agreement\_pct` is NUMERIC(5,2)** — supports values like 25.00, 20.50, 33.33. The (5,2) means up to 5 total digits with 2 decimal places, so max is 999.99%.
* **`became\_client\_at`** gets set when the prospect pipeline reaches "closed" and status flips to "client."
* **`former\_client` and `inactive` statuses** are included for completeness — you'll want these eventually when a client stops working with you.

\---

## TABLE 4: company\_contacts

**Purpose:** People at companies — decision makers, hiring managers, HR, etc.
**Phase:** 2
**Maps to:** Feature Plan Module 2.2

```sql
CREATE TABLE company\_contacts (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- Which company they belong to
  company\_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Contact info
  first\_name          TEXT NOT NULL,
  last\_name           TEXT NOT NULL,
  title               TEXT,
  email               TEXT,
  phone               TEXT,
  linkedin\_url        TEXT,

  -- Role classification
  contact\_type        TEXT NOT NULL DEFAULT 'other'
              CHECK (contact\_type IN (
                'decision\_maker', 'hiring\_manager', 'hr',
                'champion', 'gatekeeper', 'other'
              )),
  is\_primary          BOOLEAN DEFAULT FALSE,    -- Primary contact at this company

  -- Hierarchy
  reports\_to\_id       UUID REFERENCES company\_contacts(id) ON DELETE SET NULL,
  -- Points to another contact at the same company.
  -- SET NULL means: if the boss's record is deleted, this field goes blank
  -- instead of deleting this contact too.

  -- Link to candidates (for dual-role people)
  linked\_candidate\_id UUID REFERENCES candidates(id) ON DELETE SET NULL,

  -- Tracking
  last\_contacted\_at   TIMESTAMP WITH TIME ZONE,
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created\_by          UUID REFERENCES profiles(id),

  -- Full-text search
  search\_vector       tsvector
);

-- Now add the foreign key from candidates back to company\_contacts
ALTER TABLE candidates
  ADD CONSTRAINT fk\_candidates\_linked\_contact
  FOREIGN KEY (linked\_contact\_id) REFERENCES company\_contacts(id) ON DELETE SET NULL;

-- INDEXES

CREATE INDEX idx\_contacts\_company ON company\_contacts (company\_id);
CREATE INDEX idx\_contacts\_type ON company\_contacts (contact\_type);
CREATE INDEX idx\_contacts\_search ON company\_contacts USING GIN (search\_vector);

-- Auto-update search vector
CREATE OR REPLACE FUNCTION contacts\_search\_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search\_vector :=
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.first\_name, '')), 'A') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.last\_name, '')), 'A') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.title, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts\_search\_trigger
  BEFORE INSERT OR UPDATE ON company\_contacts
  FOR EACH ROW EXECUTE FUNCTION contacts\_search\_update();
```

**Design decisions explained:**

* **`ON DELETE CASCADE` for `company\_id`** — if you delete a company, all its contacts are deleted too. This makes sense because contacts don't exist without a company.
* **`ON DELETE SET NULL` for `reports\_to\_id`** — if you delete a manager's record, their reports don't get deleted, they just lose the "reports to" link.
* **`linked\_candidate\_id`** is the other half of the dual-role connection. If John is both a contact at Acme AND a candidate, his `company\_contacts` record has `linked\_candidate\_id` pointing to his `candidates` record, and vice versa.
* **The `ALTER TABLE` at the bottom** adds the reverse foreign key on `candidates.linked\_contact\_id` — we had to wait until this table existed.

\---

## TABLE 5: job\_openings

**Purpose:** Open roles at client companies.
**Phase:** 3
**Maps to:** Feature Plan Module 3.1

```sql
CREATE TABLE job\_openings (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- Which client this job is for
  company\_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Who at the client is the hiring manager
  hiring\_manager\_id   UUID REFERENCES company\_contacts(id) ON DELETE SET NULL,

  -- Job info
  title               TEXT NOT NULL,
  description         TEXT,
  requirements        TEXT,
  location\_city       TEXT,
  location\_state      TEXT,
  location\_type       TEXT DEFAULT 'onsite'
              CHECK (location\_type IN ('onsite', 'remote', 'hybrid')),

  -- Compensation
  comp\_range\_low      NUMERIC(12,2),
  comp\_range\_high     NUMERIC(12,2),

  -- Status
  status              TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'on\_hold', 'filled', 'cancelled')),

  -- Tracking
  opened\_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  filled\_at           TIMESTAMP WITH TIME ZONE,
  closed\_at           TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created\_by          UUID REFERENCES profiles(id),

  -- Full-text search
  search\_vector       tsvector
);

-- INDEXES

CREATE INDEX idx\_jobs\_company ON job\_openings (company\_id);
CREATE INDEX idx\_jobs\_status ON job\_openings (status);
CREATE INDEX idx\_jobs\_search ON job\_openings USING GIN (search\_vector);

-- Auto-update search vector
CREATE OR REPLACE FUNCTION jobs\_search\_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search\_vector :=
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.title, '')), 'A') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.description, '')), 'B') ||
    SETWEIGHT(TO\_TSVECTOR('english', COALESCE(NEW.requirements, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs\_search\_trigger
  BEFORE INSERT OR UPDATE ON job\_openings
  FOR EACH ROW EXECUTE FUNCTION jobs\_search\_update();
```

\---

## TABLE 6: pipeline\_stages

**Purpose:** Custom interview stages for each job opening. This is your dynamic stage builder.
**Phase:** 3
**Maps to:** Feature Plan Module 3.2

```sql
CREATE TABLE pipeline\_stages (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- Which job opening this stage belongs to
  job\_opening\_id      UUID NOT NULL REFERENCES job\_openings(id) ON DELETE CASCADE,

  -- Stage info
  name                TEXT NOT NULL,      -- e.g., "Phone Screen", "Technical Panel", "CEO Final"
  sort\_order          INTEGER NOT NULL,   -- 1, 2, 3... determines the left-to-right order on Kanban board

  -- Timestamps
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES

CREATE INDEX idx\_stages\_job ON pipeline\_stages (job\_opening\_id, sort\_order);

-- Example: When you create a job opening and add 5 stages, it creates 5 rows:
--   { job\_opening\_id: "abc", name: "Recruiter Screen",   sort\_order: 1 }
--   { job\_opening\_id: "abc", name: "Hiring Manager Call", sort\_order: 2 }
--   { job\_opening\_id: "abc", name: "Technical Panel",    sort\_order: 3 }
--   { job\_opening\_id: "abc", name: "Executive Round",    sort\_order: 4 }
--   { job\_opening\_id: "abc", name: "Offer",              sort\_order: 5 }
--
-- You can add, remove, rename, or reorder these at any time.
-- Different job openings at the SAME company can have different stages.
```

**Design decisions explained:**

* **This table is intentionally simple.** Each row is one stage. The `sort\_order` column controls the order. To reorder stages, you just update the `sort\_order` numbers.
* **`ON DELETE CASCADE`** — if a job opening is deleted, its stages go too.
* **No "stage type" or "is\_final" flags** — we keep it simple. The last stage by `sort\_order` is implicitly the final stage.

\---

## TABLE 7: candidate\_applications

**Purpose:** Links a candidate to a job opening and tracks their progress through the pipeline. One candidate can have multiple applications (one per job they're being considered for).
**Phase:** 3
**Maps to:** Feature Plan Module 3.2

```sql
CREATE TABLE candidate\_applications (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- Who and what job
  candidate\_id        UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job\_opening\_id      UUID NOT NULL REFERENCES job\_openings(id) ON DELETE CASCADE,

  -- Where they are in the pipeline
  current\_stage\_id    UUID REFERENCES pipeline\_stages(id) ON DELETE SET NULL,

  -- Application status
  status              TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'rejected', 'withdrawn', 'placed')),

  -- Rejection tracking (your searchable gold)
  rejection\_stage\_id  UUID REFERENCES pipeline\_stages(id) ON DELETE SET NULL,
  rejection\_reason    TEXT,              -- "Client said not enough ICS experience"

  -- Timestamps
  applied\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rejected\_at         TIMESTAMP WITH TIME ZONE,
  placed\_at           TIMESTAMP WITH TIME ZONE,
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created\_by          UUID REFERENCES profiles(id),

  -- Prevent duplicate: one candidate can only be applied to the same job once
  UNIQUE (candidate\_id, job\_opening\_id)
);

-- INDEXES

CREATE INDEX idx\_applications\_candidate ON candidate\_applications (candidate\_id);
CREATE INDEX idx\_applications\_job ON candidate\_applications (job\_opening\_id);
CREATE INDEX idx\_applications\_status ON candidate\_applications (status);

-- Full-text search on rejection reasons
CREATE INDEX idx\_applications\_rejection\_search
  ON candidate\_applications USING GIN (TO\_TSVECTOR('english', COALESCE(rejection\_reason, '')));
```

**Design decisions explained:**

* **`UNIQUE (candidate\_id, job\_opening\_id)`** prevents accidentally submitting the same candidate to the same job twice.
* **`rejection\_reason` is full-text searchable** — when you search "not enough ICS experience," this gets found. This is the "searchable gold" from the feature plan.
* **`rejection\_stage\_id`** records WHICH stage they were rejected at, so you know "they made it to the Technical Panel but got rejected there."

\---

## TABLE 8: application\_stage\_history

**Purpose:** Records every time a candidate moves between stages. This is the audit trail.
**Phase:** 3

```sql
CREATE TABLE application\_stage\_history (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  application\_id      UUID NOT NULL REFERENCES candidate\_applications(id) ON DELETE CASCADE,
  from\_stage\_id       UUID REFERENCES pipeline\_stages(id) ON DELETE SET NULL,
  to\_stage\_id         UUID REFERENCES pipeline\_stages(id) ON DELETE SET NULL,

  moved\_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  moved\_by            UUID REFERENCES profiles(id),
  notes               TEXT               -- Optional note when moving stages
);

-- INDEXES

CREATE INDEX idx\_stage\_history\_application ON application\_stage\_history (application\_id, moved\_at);

-- Example: When you drag a candidate from "Phone Screen" to "Technical Panel"
-- on the Kanban board, a row is created:
--   { application\_id: "xyz", from\_stage\_id: <phone\_screen>, to\_stage\_id: <tech\_panel>,
--     moved\_at: now(), moved\_by: <your\_user\_id> }
--
-- This lets you see: "Jane was in Phone Screen from Jan 5-12, then moved
-- to Technical Panel on Jan 12 by Mark."
```

\---

## TABLE 9: notes (Unified Notes Table)

**Purpose:** ALL notes in one table — candidate notes, company notes, contact notes, job opening notes. This is the heart of your search feature.
**Phase:** 1 (candidate notes), 2 (company/contact notes), 3 (job notes)
**Maps to:** Feature Plan Module 1.2, 2.1, 2.2, 3.1, 5.1

```sql
CREATE TABLE notes (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- What this note is attached to (polymorphic relationship)
  entity\_type         TEXT NOT NULL
              CHECK (entity\_type IN ('candidate', 'company', 'contact', 'job\_opening')),
  entity\_id           UUID NOT NULL,     -- The ID of the candidate, company, etc.

  -- Note content
  content             TEXT NOT NULL,      -- The actual note text
  note\_type           TEXT NOT NULL DEFAULT 'general'
              CHECK (note\_type IN (
                'phone\_call', 'email', 'interview\_feedback',
                'insight', 'general'
              )),
  -- 'insight' is for company intelligence/research notes

  -- Optional: link this note to a specific job opening
  -- (e.g., "this call was specifically about the Acme VP Sales role")
  linked\_job\_id       UUID REFERENCES job\_openings(id) ON DELETE SET NULL,

  -- Privacy
  is\_private          BOOLEAN DEFAULT FALSE,  -- If true, only creator + admin can see
  created\_by          UUID REFERENCES profiles(id),

  -- Timestamps
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Full-text search vector (THE most important index in the entire database)
  search\_vector       tsvector
);

-- INDEXES

-- THE critical index — this powers your "search Saudi Aramco across everything" feature
CREATE INDEX idx\_notes\_search ON notes USING GIN (search\_vector);

-- Find all notes for a specific entity quickly
CREATE INDEX idx\_notes\_entity ON notes (entity\_type, entity\_id);

-- Find notes by type
CREATE INDEX idx\_notes\_type ON notes (note\_type);

-- Find notes by date (for "show me notes from last week")
CREATE INDEX idx\_notes\_created ON notes (created\_at DESC);

-- Auto-update search vector when note content changes
CREATE OR REPLACE FUNCTION notes\_search\_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search\_vector := TO\_TSVECTOR('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes\_search\_trigger
  BEFORE INSERT OR UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION notes\_search\_update();

-- Auto-update last\_contacted\_at on the parent entity when a note is added
-- This is what keeps the "last contacted" date current on candidates and companies.
CREATE OR REPLACE FUNCTION update\_last\_contacted() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity\_type = 'candidate' THEN
    UPDATE candidates SET last\_contacted\_at = NOW(), updated\_at = NOW()
    WHERE id = NEW.entity\_id;
  ELSIF NEW.entity\_type = 'company' THEN
    UPDATE companies SET last\_contacted\_at = NOW(), updated\_at = NOW()
    WHERE id = NEW.entity\_id;
  ELSIF NEW.entity\_type = 'contact' THEN
    UPDATE company\_contacts SET last\_contacted\_at = NOW(), updated\_at = NOW()
    WHERE id = NEW.entity\_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes\_update\_last\_contacted
  AFTER INSERT ON notes
  FOR EACH ROW EXECUTE FUNCTION update\_last\_contacted();
```

**Why one notes table instead of four separate tables?**

This is a key design decision. We could have had `candidate\_notes`, `company\_notes`, `contact\_notes`, and `job\_notes` as separate tables. But your #1 feature is searching across ALL notes at once. With one table:

* **One search query** hits all notes regardless of type
* **One search index** to maintain
* **One set of code** for creating, displaying, and searching notes
* **Filtering by type** is still easy: `WHERE entity\_type = 'candidate'`

The tradeoff is that `entity\_id` isn't a traditional foreign key (it could point to any of 4 tables), so the database can't enforce referential integrity on it automatically. We handle this in the application code instead. This is a very common pattern called a "polymorphic association" and it's the right tradeoff for your use case.

\---

## TABLE 10: candidate\_documents

**Purpose:** Resumes, CVs, cover letters, and other files attached to candidates.
**Phase:** 5
**Maps to:** Feature Plan Module 1.3

```sql
CREATE TABLE candidate\_documents (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- Which candidate
  candidate\_id        UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,

  -- File info
  file\_name           TEXT NOT NULL,      -- "John\_Smith\_Resume\_2026.pdf"
  file\_type           TEXT NOT NULL DEFAULT 'resume'
              CHECK (file\_type IN ('resume', 'cv', 'cover\_letter', 'portfolio', 'other')),
  storage\_path        TEXT NOT NULL,      -- Path in Supabase Storage bucket
  file\_size\_bytes     INTEGER,
  mime\_type           TEXT,               -- 'application/pdf', 'application/vnd.openxmlformats...'

  -- Management
  is\_primary          BOOLEAN DEFAULT FALSE,  -- Which doc shows by default
  notes               TEXT,               -- "Updated version with Nozomi experience added"

  -- Tracking
  uploaded\_by         UUID REFERENCES profiles(id),
  uploaded\_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES

CREATE INDEX idx\_documents\_candidate ON candidate\_documents (candidate\_id);
CREATE INDEX idx\_documents\_primary ON candidate\_documents (candidate\_id)
  WHERE is\_primary = TRUE;

-- When setting a new primary document, unset the old one.
-- This function ensures only ONE document per candidate can be is\_primary = true.
CREATE OR REPLACE FUNCTION ensure\_single\_primary\_document() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is\_primary = TRUE THEN
    UPDATE candidate\_documents
    SET is\_primary = FALSE
    WHERE candidate\_id = NEW.candidate\_id
      AND id != NEW.id
      AND is\_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce\_single\_primary
  AFTER INSERT OR UPDATE OF is\_primary ON candidate\_documents
  FOR EACH ROW
  WHEN (NEW.is\_primary = TRUE)
  EXECUTE FUNCTION ensure\_single\_primary\_document();
```

**Design decisions explained:**

* **`storage\_path`** points to the file in Supabase Storage (a separate file storage system), not the database itself. The database stores metadata ABOUT the file, not the file itself. This keeps your 500MB database limit clean.
* **The `ensure\_single\_primary\_document` trigger** automatically handles the "only one primary" rule. When you mark a new document as primary, the old primary automatically gets unset. No application code needed.

\---

## TABLE 11: prospect\_pipeline\_history

**Purpose:** Tracks when a prospect company moves between pipeline stages.
**Phase:** 2

```sql
CREATE TABLE prospect\_pipeline\_history (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  company\_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from\_stage          TEXT,
  to\_stage            TEXT NOT NULL,
  moved\_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  moved\_by            UUID REFERENCES profiles(id)
);

-- INDEXES

CREATE INDEX idx\_prospect\_history\_company ON prospect\_pipeline\_history (company\_id, moved\_at);
```

\---

## TABLE 12: placements (Phase 6)

**Purpose:** Revenue tracking — records each successful placement.
**Phase:** 6
**Maps to:** Feature Plan Module 7.2

```sql
CREATE TABLE placements (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- What was placed
  candidate\_id        UUID NOT NULL REFERENCES candidates(id),
  job\_opening\_id      UUID NOT NULL REFERENCES job\_openings(id),
  company\_id          UUID NOT NULL REFERENCES companies(id),
  application\_id      UUID REFERENCES candidate\_applications(id),

  -- The money
  base\_salary         NUMERIC(12,2) NOT NULL,
  fee\_percentage      NUMERIC(5,2) NOT NULL,   -- Copied from company at time of placement
  fee\_amount          NUMERIC(12,2) NOT NULL,  -- Auto-calculated: base\_salary × fee\_percentage / 100

  -- Tracking
  placement\_date      DATE NOT NULL DEFAULT CURRENT\_DATE,
  start\_date          DATE,              -- When the candidate starts
  guarantee\_expires   DATE,              -- End of guarantee period (if applicable)

  -- Timestamps
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created\_by          UUID REFERENCES profiles(id)
);

-- INDEXES

CREATE INDEX idx\_placements\_date ON placements (placement\_date);
CREATE INDEX idx\_placements\_company ON placements (company\_id);

-- Example revenue query:
-- SELECT SUM(fee\_amount) FROM placements
-- WHERE placement\_date BETWEEN '2026-01-01' AND '2026-12-31';
-- → Returns total revenue for 2026
--
-- SELECT company\_id, SUM(fee\_amount) FROM placements
-- GROUP BY company\_id;
-- → Returns revenue per client
```

**Design decisions explained:**

* **`fee\_percentage` is COPIED from the company** at placement time, not looked up dynamically. This is important — if the company's fee agreement changes later (from 25% to 20%), the historical placement should still show the fee that was actually in effect when the placement happened.
* **`fee\_amount` is stored, not calculated on the fly.** Same reason — immutable historical record.

\---

## TABLE 13: follow\_ups (Phase 6)

**Purpose:** Reminders and follow-up tasks.
**Phase:** 6
**Maps to:** Feature Plan Module 6.2

```sql
CREATE TABLE follow\_ups (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- What this follow-up is about (polymorphic, same pattern as notes)
  entity\_type         TEXT NOT NULL
              CHECK (entity\_type IN ('candidate', 'company', 'contact', 'job\_opening')),
  entity\_id           UUID NOT NULL,

  -- Follow-up details
  title               TEXT NOT NULL,      -- "Follow up on interview feedback"
  description         TEXT,
  due\_date            DATE NOT NULL,
  is\_completed        BOOLEAN DEFAULT FALSE,
  completed\_at        TIMESTAMP WITH TIME ZONE,

  -- Assignment
  assigned\_to         UUID REFERENCES profiles(id),
  created\_by          UUID REFERENCES profiles(id),

  -- Timestamps
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES

CREATE INDEX idx\_followups\_due ON follow\_ups (due\_date, is\_completed)
  WHERE is\_completed = FALSE;
  -- This index ONLY covers incomplete follow-ups, making the
  -- "show me today's tasks" query extremely fast.

CREATE INDEX idx\_followups\_entity ON follow\_ups (entity\_type, entity\_id);
CREATE INDEX idx\_followups\_assigned ON follow\_ups (assigned\_to, due\_date)
  WHERE is\_completed = FALSE;
```

\---

## TABLE 14: activity\_log (Phase 6)

**Purpose:** Automatic audit trail of everything that happens.
**Phase:** 6
**Maps to:** Feature Plan Module 6.1

```sql
CREATE TABLE activity\_log (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  -- What entity was affected
  entity\_type         TEXT NOT NULL
              CHECK (entity\_type IN (
                'candidate', 'company', 'contact', 'job\_opening',
                'application', 'placement'
              )),
  entity\_id           UUID NOT NULL,

  -- What happened
  action              TEXT NOT NULL,
              -- Examples: 'created', 'updated', 'note\_added', 'stage\_changed',
              -- 'status\_changed', 'document\_uploaded', 'rejection\_recorded',
              -- 'placement\_created'
  description         TEXT,               -- Human-readable: "Moved from Phone Screen to Technical Panel"
  metadata            JSONB,              -- Machine-readable details (old\_value, new\_value, etc.)

  -- Who did it
  user\_id             UUID REFERENCES profiles(id),

  -- When
  created\_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES

CREATE INDEX idx\_activity\_entity ON activity\_log (entity\_type, entity\_id, created\_at DESC);
CREATE INDEX idx\_activity\_date ON activity\_log (created\_at DESC);
CREATE INDEX idx\_activity\_user ON activity\_log (user\_id, created\_at DESC);

-- This table will be populated by application code (or database triggers in Phase 6).
-- Every time you create a candidate, move someone in a pipeline, add a note,
-- record a rejection, etc., a row gets added here automatically.
```

\---

## GLOBAL SEARCH FUNCTION

**Purpose:** The single function that powers your "search everything" feature.
**Phase:** 4
**Maps to:** Feature Plan Module 5.1

```sql
-- This function searches across ALL searchable tables at once and returns
-- unified results grouped by type.

CREATE OR REPLACE FUNCTION global\_search(search\_query TEXT)
RETURNS TABLE (
  entity\_type   TEXT,
  entity\_id     UUID,
  entity\_name   TEXT,
  match\_source  TEXT,      -- 'candidate', 'company', 'note', etc.
  snippet       TEXT,      -- Preview of the matching text
  rank          REAL,      -- Relevance score (higher = better match)
  created\_at    TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  tsquery\_val TSQUERY;
BEGIN
  tsquery\_val := PLAINTO\_TSQUERY('english', search\_query);

  RETURN QUERY

  -- Search candidate records
  SELECT
    'candidate'::TEXT,
    c.id,
    (c.first\_name || ' ' || c.last\_name)::TEXT,
    'candidate\_record'::TEXT,
    TS\_HEADLINE('english', COALESCE(c.current\_title, '') || ' at ' || COALESCE(c.current\_company, ''),
                tsquery\_val, 'MaxWords=30, MinWords=15')::TEXT,
    TS\_RANK(c.search\_vector, tsquery\_val),
    c.created\_at
  FROM candidates c
  WHERE c.search\_vector @@ tsquery\_val

  UNION ALL

  -- Search company records
  SELECT
    'company'::TEXT,
    co.id,
    co.name::TEXT,
    'company\_record'::TEXT,
    TS\_HEADLINE('english', co.name || ' ' || COALESCE(co.industry, ''),
                tsquery\_val, 'MaxWords=30, MinWords=15')::TEXT,
    TS\_RANK(co.search\_vector, tsquery\_val),
    co.created\_at
  FROM companies co
  WHERE co.search\_vector @@ tsquery\_val

  UNION ALL

  -- Search notes (THE BIG ONE — your Saudi Aramco use case)
  SELECT
    n.entity\_type::TEXT,
    n.entity\_id,
    CASE
      WHEN n.entity\_type = 'candidate' THEN
        (SELECT first\_name || ' ' || last\_name FROM candidates WHERE id = n.entity\_id)
      WHEN n.entity\_type = 'company' THEN
        (SELECT name FROM companies WHERE id = n.entity\_id)
      WHEN n.entity\_type = 'contact' THEN
        (SELECT first\_name || ' ' || last\_name FROM company\_contacts WHERE id = n.entity\_id)
      WHEN n.entity\_type = 'job\_opening' THEN
        (SELECT title FROM job\_openings WHERE id = n.entity\_id)
    END::TEXT,
    ('note\_' || n.note\_type)::TEXT,
    TS\_HEADLINE('english', n.content, tsquery\_val,
                'MaxWords=35, MinWords=15, StartSel=\*\*, StopSel=\*\*')::TEXT,
    TS\_RANK(n.search\_vector, tsquery\_val),
    n.created\_at
  FROM notes n
  WHERE n.search\_vector @@ tsquery\_val
    AND (n.is\_private = FALSE OR n.created\_by = auth.uid())

  UNION ALL

  -- Search job openings
  SELECT
    'job\_opening'::TEXT,
    j.id,
    j.title::TEXT,
    'job\_record'::TEXT,
    TS\_HEADLINE('english', COALESCE(j.description, '') || ' ' || COALESCE(j.requirements, ''),
                tsquery\_val, 'MaxWords=30, MinWords=15')::TEXT,
    TS\_RANK(j.search\_vector, tsquery\_val),
    j.created\_at
  FROM job\_openings j
  WHERE j.search\_vector @@ tsquery\_val

  UNION ALL

  -- Search rejection reasons
  SELECT
    'candidate'::TEXT,
    ca.candidate\_id,
    (SELECT first\_name || ' ' || last\_name FROM candidates WHERE id = ca.candidate\_id)::TEXT,
    'rejection\_reason'::TEXT,
    TS\_HEADLINE('english', ca.rejection\_reason, tsquery\_val,
                'MaxWords=35, MinWords=15')::TEXT,
    TS\_RANK(TO\_TSVECTOR('english', ca.rejection\_reason), tsquery\_val),
    ca.created\_at
  FROM candidate\_applications ca
  WHERE ca.rejection\_reason IS NOT NULL
    AND TO\_TSVECTOR('english', ca.rejection\_reason) @@ tsquery\_val

  -- Sort by relevance
  ORDER BY rank DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage from your app:
-- SELECT \* FROM global\_search('Saudi Aramco');
-- Returns all matching candidates, companies, notes, jobs, and rejection reasons
-- sorted by relevance, with text snippets showing where the match was found.
```

**This is the most important piece of SQL in the entire project.** It's what makes your "search everything" feature work. When you type "Saudi Aramco" in the search bar, this function:

1. Searches candidate names, titles, and companies
2. Searches company names and domains
3. Searches ALL notes (candidate, company, contact, job) — respecting privacy settings
4. Searches job titles, descriptions, and requirements
5. Searches rejection reasons
6. Returns everything sorted by relevance with text snippets
7. All in one query, using GIN indexes so it's fast even with tens of thousands of records

\---

## SUPABASE STORAGE BUCKET

Not a database table, but needs to be set up:

```sql
-- Create a storage bucket for candidate documents (resumes, CVs, etc.)
-- This is done via Supabase dashboard or API, not SQL.
-- Bucket name: 'candidate-documents'
-- Public: No (files require authentication to access)
-- File size limit: 10MB per file
-- Allowed MIME types: application/pdf, application/msword,
--   application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

\---

## ROW LEVEL SECURITY (RLS) POLICIES

These control who can see and edit what. Applied to all tables.

```sql
-- Enable RLS on all tables
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company\_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job\_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline\_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate\_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application\_stage\_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate\_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect\_pipeline\_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow\_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity\_log ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read all records
-- (your decision: everything visible to everyone)
CREATE POLICY "Authenticated users can read all data"
  ON candidates FOR SELECT
  TO authenticated
  USING (TRUE);
-- (Repeat for all tables)

-- Policy: All authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can modify data"
  ON candidates FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);
-- (Repeat for all tables)

-- Special policy: Private notes only visible to creator and admins
CREATE POLICY "Private notes restricted"
  ON notes FOR SELECT
  TO authenticated
  USING (
    is\_private = FALSE
    OR created\_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

\---

## AUTO-UPDATE TIMESTAMPS

A trigger to automatically set `updated\_at` whenever a row is modified:

```sql
CREATE OR REPLACE FUNCTION update\_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated\_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated\_at
CREATE TRIGGER set\_updated\_at BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update\_timestamp();
CREATE TRIGGER set\_updated\_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update\_timestamp();
CREATE TRIGGER set\_updated\_at BEFORE UPDATE ON company\_contacts
  FOR EACH ROW EXECUTE FUNCTION update\_timestamp();
CREATE TRIGGER set\_updated\_at BEFORE UPDATE ON job\_openings
  FOR EACH ROW EXECUTE FUNCTION update\_timestamp();
CREATE TRIGGER set\_updated\_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update\_timestamp();
CREATE TRIGGER set\_updated\_at BEFORE UPDATE ON candidate\_applications
  FOR EACH ROW EXECUTE FUNCTION update\_timestamp();
```

\---

## TABLE CREATION ORDER

Because of foreign key dependencies, tables must be created in this order:

```
1. profiles               (no dependencies)
2. candidates             (depends on: profiles)
3. companies              (depends on: profiles)
4. company\_contacts       (depends on: companies, profiles, candidates)
   → Then: ALTER TABLE candidates ADD FK to company\_contacts
5. job\_openings           (depends on: companies, company\_contacts, profiles)
6. pipeline\_stages        (depends on: job\_openings)
7. candidate\_applications (depends on: candidates, job\_openings, pipeline\_stages, profiles)
8. application\_stage\_history (depends on: candidate\_applications, pipeline\_stages, profiles)
9. notes                  (depends on: job\_openings, profiles)
10. candidate\_documents   (depends on: candidates, profiles)
11. prospect\_pipeline\_history (depends on: companies, profiles)
12. placements            (depends on: candidates, job\_openings, companies, candidate\_applications, profiles)
13. follow\_ups            (depends on: profiles)
14. activity\_log          (depends on: profiles)
```

\---

## WHAT THIS SCHEMA DOES NOT INCLUDE (and why)

|Excluded|Reason|
|-|-|
|Skills/tags table|Using a skills TEXT field on the candidates table (included in search_vector) instead of a separate tags table.  A separate `tags` table with many-to-many joins can be added later if you need faceted filtering.|
|Email tracking|Excluded per feature plan|
|Calendar events|Excluded per feature plan|
|Pipeline templates|Phase 6+ feature — can be added as a `pipeline\_templates` table later without changing existing tables|
|Candidate merge logic|Phase 6+ — handled in application code, not schema|

\---

## NEXT STEP

Review this schema. For each table, verify:

1. Are there fields missing that you'd want to store?
2. Are there fields included that you'd never use?
3. Do the relationships (foreign keys) make sense?

Once approved, we can generate the actual migration SQL file ready to run in Supabase.

